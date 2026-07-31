-- ============================================================================
-- schema_full.sql — script unique de création de la base de données
-- ============================================================================
-- Généré à partir de la fusion de tous les fichiers dans supabase/migrations/
-- (branche main, du 2026-07-12 au 2026-07-25). Représente l'état FINAL du
-- schéma : les tables/fonctions/contraintes recréées ou modifiées plusieurs
-- fois par des migrations successives n'apparaissent ici que dans leur
-- dernière version (ex: create_session_atomic a été recréée 4 fois pour
-- ajouter des paramètres — seule la version à 6 paramètres est gardée).
--
-- Idempotent : chaque instruction peut être rejouée sans erreur sur une base
-- qui contient déjà tout ou partie du schéma (CREATE ... IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE POLICY, CREATE OR REPLACE, blocs DO gardés
-- par une vérification catalogue pour les contraintes/publications qui n'ont
-- pas de syntaxe IF NOT EXISTS native en Postgres).
--
-- Ordre des sections : respecte les dépendances (une table référencée par
-- une fonction/policy doit exister avant). handle_new_user() et son trigger
-- sont volontairement placés en toute dernière section car sa version finale
-- référence group_members/content_shares (créées en section M) — Postgres
-- valide le corps des fonctions PL/pgSQL à la création (check_function_bodies)
-- et échouerait si ces tables n'existaient pas encore.
-- ============================================================================


-- ============================================================================
-- PART A — Extensions
-- ============================================================================
create extension if not exists pgcrypto;


-- ============================================================================
-- PART B — profiles (identité + rôle + billing), is_admin()
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  -- billing (20260718120000_billing_profiles.sql) : non modifiable côté client,
  -- seuls handle_new_user (trigger) et l'edge function stripe-webhook (service-role) écrivent ces colonnes.
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'entreprise')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  -- identité publique pour recherche/invitations (20260725120000_course_sharing.sql)
  username text,
  created_at timestamptz not null default now()
);

-- Backfill des profils pour les users déjà existants (no-op sur une base vide).
insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

-- Backfill du username : préfère auth.users.user_metadata.username, sinon la
-- partie locale de l'email, en désambiguïsant les collisions avec un suffixe
-- numérique. Itératif (pas un simple UPDATE de masse) pour que chaque
-- candidat soit vérifié contre les usernames déjà attribués avant d'être
-- committé.
do $$
declare
  r record;
  candidate text;
  suffix int;
begin
  for r in
    select u.id, coalesce(nullif(u.raw_user_meta_data->>'username', ''), split_part(u.email, '@', 1)) as base
    from auth.users u
    order by u.id
  loop
    candidate := r.base;
    suffix := 1;
    while exists (select 1 from public.profiles where username = candidate and id <> r.id) loop
      suffix := suffix + 1;
      candidate := r.base || '-' || suffix;
    end loop;
    update public.profiles set username = candidate where id = r.id and (username is null or username <> candidate);
  end loop;
end $$;

alter table public.profiles alter column username set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_unique') then
    alter table public.profiles add constraint profiles_username_unique unique (username);
  end if;
end $$;

-- Admin check helper : bypasse RLS (security definer), search_path figé.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

-- Le propriétaire lit sa propre ligne ; l'admin lit tout. Aucun insert/update
-- côté client : le rôle n'est promu que via service_role / SQL direct.
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select using (auth.uid() = id or public.is_admin());


-- ============================================================================
-- PART C — session_state (base pré-existante, schéma inféré) + session_quiz_answers
-- ============================================================================
-- session_state n'a jamais été créée par une migration : c'était une table
-- construite à la main en prod (cf. mémoire "schema hand-built"). Les
-- migrations ne font que lui ALTER des colonnes. On la crée ici avec le
-- schéma minimal déduit de tous les usages (create_session_atomic +
-- session_control + session_max_participants) pour que ce script tienne
-- debout sur une base neuve. Sur une base où elle existe déjà, IF NOT EXISTS
-- rend ce bloc inoffensif.
create table if not exists public.session_state (
  game_code text primary key,
  players jsonb not null default '[]'::jsonb,
  game_state text not null default 'waiting',
  current_question_index int not null default 0,
  time_left int not null default 0,
  question_started_at timestamptz,
  quiz_data jsonb not null default '{}'::jsonb,
  -- host-authoritative control state : lock de salle, mute global, kick list
  -- (20260717120000_session_control.sql)
  control jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Answer key des sessions live. Contient le quiz complet (réponses correctes
-- incluses) que submit-answer valide côté serveur. RLS activé sans policy :
-- anon/authenticated n'ont aucune ligne (deny par défaut), seul service_role
-- (Edge Functions) contourne RLS et y accède.
create table if not exists public.session_quiz_answers (
  game_code text primary key,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.session_quiz_answers enable row level security;


-- ============================================================================
-- PART D — create_session_atomic (version finale, 6 paramètres)
-- ============================================================================
-- Écrit atomiquement quiz_data public (session_state) + answer key privée
-- (session_quiz_answers) dans une seule transaction, pour qu'un échec en
-- cours d'écriture ne laisse jamais un quiz public périmé appairé à une
-- answer key privée fraîchement écrasée (ou manquante).
create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade',
  p_max_participants int default null
) returns void
language plpgsql
as $$
begin
  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, control, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object(
      'title', p_title, 'questions', p_public_questions,
      'ambianceId', p_ambiance_id, 'maxParticipants', p_max_participants
    ),
    '{}'::jsonb,
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        control = '{}'::jsonb,
        updated_at = now();
end;
$$;


-- ============================================================================
-- PART E — Helper trigger : touch_updated_at()
-- ============================================================================
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================================
-- PART F — Contenu : folders / content / poll_responses (polymorphique)
-- ============================================================================
-- Tous par utilisateur avec RLS. `content` est un blob JSON discriminé par
-- `type`, miroir du modèle localStorage existant (quiz/poll/flashcard/exam/
-- course/slide). Contraintes ci-dessous = état final (inclut 'slide',
-- ajouté par 20260722150000_content_slide_type.sql).

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course','slide')),
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  -- idempotency de l'import localStorage->Supabase (20260713140000)
  source_id text,
  created_at timestamptz not null default now()
);
create index if not exists folders_user_type_idx on public.folders(user_id, type);
create index if not exists folders_parent_idx on public.folders(parent_id);
create unique index if not exists folders_user_source_uidx
  on public.folders(user_id, source_id) where source_id is not null;

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course','slide')),
  folder_id uuid references public.folders(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  is_open boolean not null default false,      -- sondages async (chantier 5)
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_user_type_idx on public.content(user_id, type);
create index if not exists content_folder_idx on public.content(folder_id);
create unique index if not exists content_user_source_uidx
  on public.content(user_id, source_id) where source_id is not null;

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists poll_responses_content_idx on public.poll_responses(content_id);

alter table public.folders enable row level security;
alter table public.content enable row level security;
alter table public.poll_responses enable row level security;

drop policy if exists folders_owner on public.folders;
create policy folders_owner on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists content_owner on public.content;
create policy content_owner on public.content
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NB : content_public_read (lecture publique/partagée) est posée en PART M,
-- car sa version finale dépend de content_shares/group_members.

drop policy if exists poll_responses_insert_open on public.poll_responses;
create policy poll_responses_insert_open on public.poll_responses
  for insert with check (
    exists (select 1 from public.content c
            where c.id = content_id and c.type = 'poll' and c.is_open = true)
  );
drop policy if exists poll_responses_owner_read on public.poll_responses;
create policy poll_responses_owner_read on public.poll_responses
  for select using (
    exists (select 1 from public.content c
            where c.id = content_id and c.user_id = auth.uid())
  );

create or replace trigger content_touch before update on public.content
  for each row execute function public.touch_updated_at();


-- ============================================================================
-- PART G — static_pages (pages légales/marketing éditables par l'admin)
-- ============================================================================
create table if not exists public.static_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger static_pages_touch before update on public.static_pages
  for each row execute function public.touch_updated_at();

alter table public.static_pages enable row level security;

drop policy if exists static_pages_read on public.static_pages;
create policy static_pages_read on public.static_pages
  for select using (status = 'published' or public.is_admin());
drop policy if exists static_pages_write on public.static_pages;
create policy static_pages_write on public.static_pages
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- PART H — site_settings (clé/valeur jsonb, ex: liens sociaux du footer)
-- ============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- PART I — Pages CMS SP1 : roadmap / changelog / guides / faq / reviews
-- ============================================================================
create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  col text not null check (col in ('idea','planned','dev','shipped')),
  category text not null,
  title text not null,
  subtitle text not null default '',
  tags jsonb not null default '[]'::jsonb,
  beta boolean not null default false,
  locked boolean not null default false,
  base_votes int not null default 0,
  shipped_label text,
  shipped_link boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.changelog_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  date_label text not null,
  intro text,
  media text,
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.changelog_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.changelog_releases(id) on delete cascade,
  kind text not null check (kind in ('new','imp','fix')),
  text text not null,
  from_votes boolean not null default false,
  sort int not null default 0
);
create index if not exists changelog_items_release_idx on public.changelog_items(release_id);

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '',
  cover_token text not null default '',
  duration_label text not null default '',
  title text not null,
  level text not null check (level in ('deb','int','avc')),
  format text not null check (format in ('video','article')),
  url text,
  body text,
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid references auth.users(id) on delete set null,
  persona text not null check (persona in ('formateur','enseignant','entreprise')),
  stars int not null check (stars between 1 and 5),
  text text not null,
  author_name text not null,
  author_role text not null default '',
  avatar_emoji text not null default '',
  status text not null default 'published' check (status in ('pending','published','rejected')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create or replace trigger roadmap_items_touch before update on public.roadmap_items
  for each row execute function public.touch_updated_at();
create or replace trigger changelog_releases_touch before update on public.changelog_releases
  for each row execute function public.touch_updated_at();
create or replace trigger guides_touch before update on public.guides
  for each row execute function public.touch_updated_at();
create or replace trigger faq_items_touch before update on public.faq_items
  for each row execute function public.touch_updated_at();

alter table public.roadmap_items       enable row level security;
alter table public.changelog_releases  enable row level security;
alter table public.changelog_items     enable row level security;
alter table public.guides              enable row level security;
alter table public.faq_items           enable row level security;
alter table public.reviews             enable row level security;

drop policy if exists roadmap_items_read on public.roadmap_items;
create policy roadmap_items_read on public.roadmap_items
  for select using (status = 'published' or public.is_admin());
drop policy if exists roadmap_items_write on public.roadmap_items;
create policy roadmap_items_write on public.roadmap_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists changelog_releases_read on public.changelog_releases;
create policy changelog_releases_read on public.changelog_releases
  for select using (status = 'published' or public.is_admin());
drop policy if exists changelog_releases_write on public.changelog_releases;
create policy changelog_releases_write on public.changelog_releases
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists changelog_items_read on public.changelog_items;
create policy changelog_items_read on public.changelog_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.changelog_releases r
      where r.id = release_id and r.status = 'published'
    )
  );
drop policy if exists changelog_items_write on public.changelog_items;
create policy changelog_items_write on public.changelog_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists guides_read on public.guides;
create policy guides_read on public.guides
  for select using (status = 'published' or public.is_admin());
drop policy if exists guides_write on public.guides;
create policy guides_write on public.guides
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists faq_items_read on public.faq_items;
create policy faq_items_read on public.faq_items
  for select using (status = 'published' or public.is_admin());
drop policy if exists faq_items_write on public.faq_items;
create policy faq_items_write on public.faq_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select using (status = 'published' or public.is_admin());
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ── seed : transcrit 1:1 depuis les tableaux de pages actuels ──────────────
-- Idempotent : ne seed que si les tables sont vides (évite les doublons si
-- ce script est rejoué sur une base déjà seedée).
insert into public.roadmap_items (col, category, title, subtitle, tags, beta, locked, base_votes, shipped_label, shipped_link, status, sort)
select * from (values
 ('idea','builder','Questions avec images et schémas','Insérer un visuel dans l''énoncé et les réponses.','[{"label":"Builder"}]'::jsonb,false,false,64,null,false,'published',10),
 ('idea','live','Mode hors-ligne pour l''hôte','Animer une session sans réseau fiable en salle.','[{"label":"Sessions live"}]'::jsonb,false,false,41,null,false,'published',20),
 ('idea','builder','Co-édition de quiz à plusieurs','Travailler un même quiz en équipe de formateurs.','[{"label":"Builder"}]'::jsonb,false,false,27,null,false,'published',30),
 ('idea','a11y','Sous-titres live pour l''accessibilité','Transcription des questions lues à voix haute.','[{"label":"Accessibilité"}]'::jsonb,false,false,19,null,false,'published',40),
 ('planned','integrations','Intégration Moodle / LMS (SCORM)','Exporter quiz et résultats vers votre LMS.','[{"label":"Intégrations"},{"label":"ETA T4 2026","eta":true}]'::jsonb,false,false,98,null,false,'published',50),
 ('planned','analytics','Rapports analytics automatiques par email','Le débrief de session dans votre boîte mail.','[{"label":"Analytics"},{"label":"ETA T4 2026","eta":true}]'::jsonb,false,false,73,null,false,'published',60),
 ('planned','orga','Banque de questions partagée en équipe','Un référentiel commun pour plusieurs formateurs.','[{"label":"Organisation"},{"label":"ETA T1 2027","eta":true}]'::jsonb,false,false,55,null,false,'published',70),
 ('dev','live','Mode équipes','Scores cumulés par table pour les ateliers en sous-groupes.','[{"label":"Sessions live"}]'::jsonb,true,true,143,null,false,'published',80),
 ('dev','exams','Correction manuelle des réponses libres','Interface de correction copie par copie pour les examens.','[{"label":"Examens"}]'::jsonb,false,true,87,null,false,'published',90),
 ('shipped','builder','Génération de quiz par IA','Livré en juin · ','[]'::jsonb,false,false,126,'Livré en juin',true,'published',100),
 ('shipped','exams','Alertes de sortie d''onglet (examens)','Livré en mai','[]'::jsonb,false,false,84,'Livré en mai',false,'published',110),
 ('shipped','analytics','Export PDF des résultats','Livré en avril','[]'::jsonb,false,false,61,'Livré en avril',false,'published',120)
) as v(col, category, title, subtitle, tags, beta, locked, base_votes, shipped_label, shipped_link, status, sort)
where not exists (select 1 from public.roadmap_items);

insert into public.changelog_releases (version, title, date_label, intro, media, status, sort)
select * from (values
 ('v2.15','Le mode équipes entre en bêta','10 juillet 2026','La fonctionnalité la plus votée de l''histoire de la roadmap (143 voix) arrive : jouez par tables, scores cumulés, podium d''équipes.','🏆🤝','published',10),
 ('v2.14','Analytics : le rapport PDF fait peau neuve','24 juin 2026',null,null,'published',20),
 ('v2.13','Génération de quiz par IA','5 juin 2026','Déposez un PDF de cours, obtenez une proposition de quiz calibrée — chaque question reste validée par vous avant publication.',null,'published',30),
 ('v2.12','Examens : surveillance renforcée','12 mai 2026',null,null,'published',40)
) as v(version, title, date_label, intro, media, status, sort)
where not exists (select 1 from public.changelog_releases);

insert into public.changelog_items (release_id, kind, text, from_votes, sort)
select r.id, v.kind, v.text, v.from_votes, v.sort from public.changelog_releases r
join (values
 ('v2.15','new','Mode équipes en session live : jusqu''à 12 équipes, répartition automatique ou par choix des joueurs.',true,10),
 ('v2.15','imp','Le lobby affiche désormais un compte à rebours de lancement paramétrable (10-60 s).',false,20),
 ('v2.15','fix','Le podium n''affichait pas les ex æquo dans le bon ordre au-delà de la 3ᵉ place.',false,30),
 ('v2.14','new','Rapport PDF par session : réussite par question, questions à retravailler, classement — prêt à joindre à votre bilan de formation.',true,10),
 ('v2.14','imp','L''export CSV inclut désormais le temps de réponse moyen par question.',false,20),
 ('v2.14','imp','Les noms longs ne sont plus tronqués dans les exports (merci au ticket #1246 !).',false,30),
 ('v2.13','new','Génération IA depuis PDF, DOCX et Markdown : 5 générations/mois en Gratuit, illimité en Pro.',true,10),
 ('v2.13','new','Réglage du niveau de difficulté cible avant génération (règle 70/20/10 appliquée par défaut).',false,20),
 ('v2.13','fix','Les caractères accentués s''affichaient mal dans les questions importées depuis certains CSV.',false,30),
 ('v2.12','new','Alertes de sortie d''onglet horodatées, visibles dans le détail de chaque copie.',false,10),
 ('v2.12','new','Blocage automatique de la connexion simultanée depuis un second appareil.',false,20),
 ('v2.12','imp','La fenêtre de passage accepte désormais les fuseaux horaires — utile pour les candidats à distance.',false,30),
 ('v2.12','fix','L''auto-soumission à la fin du temps pouvait perdre la dernière réponse saisie.',false,40)
) as v(version, kind, text, from_votes, sort) on v.version = r.version
where not exists (select 1 from public.changelog_items);

insert into public.guides (emoji, cover_token, duration_label, title, level, format, status, sort)
select * from (values
 ('🎬','--ap-quiz-soft','▶ 4:32','Créer un quiz de A à Z','deb','video','published',10),
 ('🪄','--ap-brand-soft','6 min','Générer un quiz par IA depuis un PDF de cours','deb','article','published',20),
 ('🎯','--ap-pres-soft','8 min','Doser la difficulté : la règle des 70/20/10','int','article','published',30),
 ('🎬','--ap-poll-soft','▶ 7:15','Animer un groupe de 100+ : rythme, pauses, relances','int','video','published',40),
 ('🎓','--ap-flash-soft','12 min','Monter un examen blanc certifiant (fenêtres, barème, litiges)','avc','article','published',50),
 ('📊','--ap-pres-soft','10 min','Exploiter les analytics pour réviser son cours','avc','article','published',60),
 ('🧊','--ap-quiz-soft','5 min','10 icebreakers qui marchent (même à 8 h 30)','deb','article','published',70),
 ('🎬','--ap-brand-soft','▶ 5:48','Flashcards & répétition espacée : le mode d''emploi','int','video','published',80)
) as v(emoji, cover_token, duration_label, title, level, format, status, sort)
where not exists (select 1 from public.guides);

insert into public.faq_items (category, question, answer, status, sort)
select * from (values
 ('Démarrage','Comment créer mon premier quiz ?','Cliquez sur « Créer gratuitement » depuis l''accueil, choisissez le type de contenu (Quiz, Sondage, Flashcard ou Présentation), puis construisez vos questions. Vous pouvez aussi partir d''un modèle prêt à l''emploi.','published',10),
 ('Démarrage','Faut-il un compte pour utiliser l''application ?','Vous pouvez créer et lancer du contenu sans compte, mais un compte permet de sauvegarder vos créations, d''accéder à vos statistiques et de retrouver vos résultats depuis n''importe quel appareil.','published',20),
 ('Démarrage','L''application est-elle gratuite ?','Oui, les fonctionnalités essentielles sont entièrement gratuites. Des options avancées (personnalisation avancée, export, analytics détaillées) sont disponibles dans les plans supérieurs.','published',30),
 ('Quiz & Sondages en direct','Comment les participants rejoignent-ils une session ?','Partagez le code à 6 chiffres affiché à l''écran, ou le lien QR Code généré automatiquement. Les participants ouvrent l''application sur leur smartphone et saisissent le code, aucune inscription requise.','published',40),
 ('Quiz & Sondages en direct','Combien de participants peut-on accueillir simultanément ?','Il n''y a pas de limite stricte côté application. En pratique, les sessions fonctionnent très bien jusqu''à plusieurs centaines de participants. La synchronisation repose sur Supabase Realtime.','published',50),
 ('Quiz & Sondages en direct','Les réponses des sondages sont-elles sauvegardées ?','Oui. Dès que vous lancez un sondage, les réponses des participants sont collectées en temps réel et accessibles dans la page « Résultats » du sondage, avec des graphiques par question.','published',60),
 ('Quiz & Sondages en direct','Peut-on relancer un même quiz plusieurs fois ?','Absolument. Depuis « Mes Quiz », cliquez sur « Lancer », chaque lancement crée une nouvelle session avec un code unique. Les sessions précédentes restent dans l''historique.','published',70),
 ('Flashcards & Présentations','Comment fonctionne le mode Flashcard ?','Les flashcards s''affichent une par une en mode révision : recto (question ou terme) puis verso (réponse ou définition). Idéal pour mémoriser du vocabulaire, des formules ou des concepts clés.','published',80),
 ('Flashcards & Présentations','Puis-je insérer des images dans mes slides ?','Oui, chaque diapositive et chaque question peut inclure une image (URL ou upload). Les images sont affichées en pleine largeur dans le mode présentation.','published',90),
 ('Données & Confidentialité','Où sont stockées mes données ?','Les contenus créés sont stockés localement dans votre navigateur (localStorage) et, lorsqu''un compte est actif, synchronisés via Supabase (hébergé en Europe). Aucune donnée n''est vendue à des tiers.','published',100),
 ('Données & Confidentialité','Comment supprimer mes créations ?','Dans les pages « Mes Quiz », « Mes Sondages » ou « Mes Flashcards », cliquez sur l''icône corbeille de la carte concernée, puis confirmez la suppression.','published',110)
) as v(category, question, answer, status, sort)
where not exists (select 1 from public.faq_items);

insert into public.reviews (persona, stars, text, author_name, author_role, avatar_emoji, status, sort)
select * from (values
 ('formateur',5,'Le lobby projeté fait son effet à chaque fois : les stagiaires dégainent leur téléphone avant même que j''aie fini d''expliquer. Zéro friction, zéro installation.','Karim T.','Formateur DevOps indépendant','🧔','published',10),
 ('entreprise',5,'On a remplacé notre ancien outil pour la conformité RGPD : hébergement UE, DPA signé en 48 h. Le service juridique a validé sans aller-retour — une première.','Claire D.','Responsable formation, ETI industrielle','🏢','published',20),
 ('enseignant',5,'Mes M2 réclament le quiz de fin de module. Le mode examen avec alertes de sortie d''onglet m''a évité deux litiges ce semestre : tout est tracé, horodaté, incontestable.','Julien P.','Enseignant vacataire, M2 cloud','👨‍🏫','published',30),
 ('formateur',4,'La génération IA depuis mes PDF me fait gagner une heure par module. Je retouche 20 % des questions, le reste est directement exploitable. Il manque juste les questions avec images.','Nadia B.','Formatrice Kubernetes','👩‍💻','published',40),
 ('enseignant',5,'Testé avec 160 étudiants en amphi : aucune latence, le podium final a déclenché une ovation. Je ne pensais pas dire ça d''un cours de réseaux à 8 h.','Sarah M.','Enseignante-chercheuse','👩‍🏫','published',50),
 ('entreprise',5,'Déployé pour 6 formateurs internes. La banque de questions partagée évite que chacun réinvente les mêmes QCM — on capitalise enfin sur nos contenus.','Marc L.','Directeur pédagogique, CFA','🏫','published',60)
) as v(persona, stars, text, author_name, author_role, avatar_emoji, status, sort)
where not exists (select 1 from public.reviews);


-- ============================================================================
-- PART J — Pages CMS SP2 : votes / idées / signalements / abonnés
-- ============================================================================
create table if not exists public.roadmap_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.roadmap_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists roadmap_votes_item_idx on public.roadmap_votes(item_id);

create or replace function public.enforce_vote_quota()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.roadmap_votes where user_id = new.user_id) >= 3 then
    raise exception 'vote quota exceeded' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create or replace trigger roadmap_votes_quota before insert on public.roadmap_votes
  for each row execute function public.enforce_vote_quota();

create table if not exists public.roadmap_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  status text not null default 'pending' check (status in ('pending','converted','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists roadmap_ideas_user_idx on public.roadmap_ideas(user_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug','question','billing')),
  severity int not null check (severity in (1,2,3)),
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reports_user_idx on public.reports(user_id);
create or replace trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

create table if not exists public.changelog_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace view public.roadmap_vote_counts as
  select item_id, count(*)::int as votes
  from public.roadmap_votes
  group by item_id;

alter table public.roadmap_votes         enable row level security;
alter table public.roadmap_ideas         enable row level security;
alter table public.reports               enable row level security;
alter table public.changelog_subscribers enable row level security;

drop policy if exists roadmap_votes_read on public.roadmap_votes;
create policy roadmap_votes_read on public.roadmap_votes for select using (true);
drop policy if exists roadmap_votes_insert on public.roadmap_votes;
create policy roadmap_votes_insert on public.roadmap_votes
  for insert with check (auth.uid() = user_id);
drop policy if exists roadmap_votes_delete on public.roadmap_votes;
create policy roadmap_votes_delete on public.roadmap_votes
  for delete using (auth.uid() = user_id);

drop policy if exists roadmap_ideas_owner on public.roadmap_ideas;
create policy roadmap_ideas_owner on public.roadmap_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists roadmap_ideas_admin_read on public.roadmap_ideas;
create policy roadmap_ideas_admin_read on public.roadmap_ideas
  for select using (public.is_admin());

drop policy if exists reports_owner on public.reports;
create policy reports_owner on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists changelog_subscribers_owner on public.changelog_subscribers;
create policy changelog_subscribers_owner on public.changelog_subscribers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews (créée en PART I) : insertion visiteur, forcée en pending et attribuée à soi-même.
drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_insert_self on public.reviews
  for insert with check (auth.uid() = author_user_id and status = 'pending');


-- ============================================================================
-- PART K — Examens async : exams / exam_attempts / exam_messages
-- ============================================================================
-- Tier 1 : le client calcule toujours le score (comme la version localStorage
-- actuelle). Le scoring tamper-proof côté serveur est délibérément différé.
create table if not exists public.exams (
  id uuid primary key,                     -- généré client (genExamId()), même id que le miroir `content`.source_id
  host_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  title text not null,
  description text not null default '',
  open_at timestamptz not null,
  close_at timestamptz not null,
  duration_minutes integer,
  max_attempts integer not null default 1,
  shuffle_questions boolean not null default false,
  shuffle_answers boolean not null default false,
  passing_score integer not null default 70,
  show_results_policy text not null default 'immediately',
  show_detail_policy text not null default 'score-correction',
  score_retention_policy text not null default 'best',
  status text not null default 'draft' check (status in ('draft','archived','scheduled','open','closed')),
  join_code text not null unique,
  max_participants integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exams_host_idx on public.exams(host_id);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  participant_id text not null,            -- id client (sessionStorage), pas auth.uid()
  participant_name text not null,
  participant_email text not null default '',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  time_used_seconds integer not null default 0,
  question_order jsonb not null default '[]',
  answers jsonb not null default '{}',
  score integer,
  percentage integer,
  passed boolean,
  submission_mode text,
  status text not null default 'in-progress',
  logs jsonb not null default '[]'
);
create index if not exists exam_attempts_exam_idx on public.exam_attempts(exam_id);
create index if not exists exam_attempts_participant_idx on public.exam_attempts(exam_id, participant_id);

alter table public.exams enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists exams_public_read on public.exams;
create policy exams_public_read on public.exams for select using (true);
drop policy if exists exams_owner_insert on public.exams;
create policy exams_owner_insert on public.exams for insert with check (host_id = auth.uid());
drop policy if exists exams_owner_update on public.exams;
create policy exams_owner_update on public.exams for update using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists exam_attempts_insert_open on public.exam_attempts;
create policy exam_attempts_insert_open on public.exam_attempts
  for insert with check (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and now() < e.close_at
            and e.status not in ('draft','archived'))
  );

drop policy if exists exam_attempts_update_own on public.exam_attempts;
create policy exam_attempts_update_own on public.exam_attempts
  for update using (status = 'in-progress') with check (true);

-- dashboard host : lecture complète des tentatives de ses examens (host_message
-- one-shot d'origine a été remplacé par exam_messages ; policy ici couvre aussi
-- l'annulation d'une tentative déjà soumise).
drop policy if exists exam_attempts_host_read on public.exam_attempts;
create policy exam_attempts_host_read on public.exam_attempts
  for select using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));
drop policy if exists exam_attempts_host_update on public.exam_attempts;
create policy exam_attempts_host_update on public.exam_attempts
  for update
  using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));

drop policy if exists exam_attempts_read_published on public.exam_attempts;
create policy exam_attempts_read_published on public.exam_attempts
  for select using (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and e.status not in ('draft','archived'))
  );

-- content : le participant d'un examen lit le quiz mirroré (questions + bonnes
-- réponses) — même exposition que la version localStorage.
drop policy if exists content_exam_quiz_read on public.content;
create policy content_exam_quiz_read on public.content
  for select using (
    type = 'quiz' and exists (
      select 1 from public.exams e
      where e.quiz_id = content.source_id
        and e.host_id = content.user_id
        and now() >= e.open_at
        and e.status not in ('draft','archived')
    )
  );

create or replace trigger exams_touch before update on public.exams
  for each row execute function public.touch_updated_at();

-- Chat persistant host <-> participant.
create table if not exists public.exam_messages (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  sender text not null check (sender in ('host','participant')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists exam_messages_attempt_idx on public.exam_messages(attempt_id, created_at);

alter table public.exam_messages enable row level security;

drop policy if exists exam_messages_host_read on public.exam_messages;
create policy exam_messages_host_read on public.exam_messages
  for select using (exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()));
drop policy if exists exam_messages_host_insert on public.exam_messages;
create policy exam_messages_host_insert on public.exam_messages
  for insert with check (
    sender = 'host'
    and exists (select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid())
  );

drop policy if exists exam_messages_participant_read on public.exam_messages;
create policy exam_messages_participant_read on public.exam_messages
  for select using (
    exists (select 1 from public.exams e where e.id = exam_id
            and now() >= e.open_at and e.status not in ('draft','archived'))
  );
drop policy if exists exam_messages_participant_insert on public.exam_messages;
create policy exam_messages_participant_insert on public.exam_messages
  for insert with check (
    sender = 'participant'
    and exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.status = 'in-progress')
  );

-- Realtime : RLS ne suffit pas, la table doit aussi être ajoutée à la
-- publication supabase_realtime pour que postgres_changes se déclenche.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'exam_attempts'
  ) then
    alter publication supabase_realtime add table public.exam_attempts;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'exam_messages'
  ) then
    alter publication supabase_realtime add table public.exam_messages;
  end if;
end $$;


-- ============================================================================
-- PART L — Storage : bucket presentation-media (uploads image/vidéo éditeur)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('presentation-media', 'presentation-media', true)
on conflict (id) do nothing;

drop policy if exists presentation_media_owner_write on storage.objects;
create policy presentation_media_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists presentation_media_owner_update on storage.objects;
create policy presentation_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists presentation_media_owner_delete on storage.objects;
create policy presentation_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists presentation_media_public_read on storage.objects;
create policy presentation_media_public_read on storage.objects
  for select using (bucket_id = 'presentation-media');


-- ============================================================================
-- PART M — Partage de cours : groups / group_members / content_shares
-- ============================================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists groups_owner_idx on public.groups(owner_id);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, pending_email) = 1),
  unique (group_id, user_id),
  unique (group_id, pending_email)
);
create index if not exists group_members_group_idx on public.group_members(group_id);
create index if not exists group_members_user_idx on public.group_members(user_id);

create table if not exists public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  shared_with_group_id uuid references public.groups(id) on delete cascade,
  pending_email text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(shared_with_user_id, shared_with_group_id, pending_email) = 1),
  unique (content_id, shared_with_user_id),
  unique (content_id, shared_with_group_id),
  unique (content_id, pending_email)
);
create index if not exists content_shares_content_idx on public.content_shares(content_id);
create index if not exists content_shares_user_idx on public.content_shares(shared_with_user_id);
create index if not exists content_shares_group_idx on public.content_shares(shared_with_group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.content_shares enable row level security;

drop policy if exists groups_owner on public.groups;
create policy groups_owner on public.groups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists group_members_owner on public.group_members;
create policy group_members_owner on public.group_members
  for all using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

drop policy if exists group_members_self_read on public.group_members;
create policy group_members_self_read on public.group_members
  for select using (user_id = auth.uid());

drop policy if exists content_shares_owner on public.content_shares;
create policy content_shares_owner on public.content_shares
  for all using (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid())
    and (shared_with_group_id is null or exists (select 1 from public.groups g where g.id = shared_with_group_id and g.owner_id = auth.uid()))
  );

drop policy if exists content_shares_read_own on public.content_shares;
create policy content_shares_read_own on public.content_shares
  for select using (shared_with_user_id = auth.uid());

drop policy if exists content_shares_group_read on public.content_shares;
create policy content_shares_group_read on public.content_shares
  for select using (
    shared_with_group_id in (select group_id from public.group_members where user_id = auth.uid())
  );

-- content : version finale de la lecture publique, étendue au partage direct/groupe.
drop policy if exists content_public_read on public.content;
create policy content_public_read on public.content
  for select using (
    is_public = true or is_open = true
    or exists (
      select 1 from public.content_shares cs
      where cs.content_id = content.id
        and (cs.shared_with_user_id = auth.uid()
             or cs.shared_with_group_id in (select group_id from public.group_members where user_id = auth.uid()))
    )
  );

-- ── fonctions liées au partage ──────────────────────────────────────────────
create or replace function public.search_profiles_by_username(prefix text)
returns table(id uuid, username text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.username ilike prefix || '%'
    and p.id <> auth.uid()
  order by p.username
  limit 10;
$$;

create or replace function public.usernames_by_ids(ids uuid[])
returns table(id uuid, username text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select p.id, p.username
    from public.profiles p
    where p.id = any(ids);
end;
$$;

create or replace function public.resolve_content_share(p_content_id uuid, p_email text)
returns public.content_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.content_shares;
begin
  if not exists (select 1 from public.content where id = p_content_id and user_id = auth.uid()) then
    raise exception 'Not the owner of this content';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.content_shares (content_id, shared_with_user_id)
    values (p_content_id, target_user_id)
    on conflict (content_id, shared_with_user_id) do nothing
    returning * into result;
  else
    insert into public.content_shares (content_id, pending_email)
    values (p_content_id, p_email)
    on conflict (content_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.resolve_group_member(p_group_id uuid, p_email text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  result public.group_members;
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Not the owner of this group';
  end if;

  select u.id into target_user_id from auth.users u where u.email = p_email;

  if target_user_id is not null then
    insert into public.group_members (group_id, user_id)
    values (p_group_id, target_user_id)
    on conflict (group_id, user_id) do nothing
    returning * into result;
  else
    insert into public.group_members (group_id, pending_email)
    values (p_group_id, p_email)
    on conflict (group_id, pending_email) do nothing
    returning * into result;
  end if;

  return result;
end;
$$;


-- ============================================================================
-- PART N — handle_new_user() (version finale) + trigger
-- ============================================================================
-- Placé en dernier : référence group_members/content_shares (PART M), et
-- Postgres valide le corps PL/pgSQL à la création (check_function_bodies),
-- donc ces tables doivent déjà exister.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  candidate text := base_username;
  suffix int := 1;
begin
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '-' || suffix;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;

  update public.group_members set user_id = new.id, pending_email = null where pending_email = new.email;
  update public.content_shares set shared_with_user_id = new.id, pending_email = null where pending_email = new.email;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
