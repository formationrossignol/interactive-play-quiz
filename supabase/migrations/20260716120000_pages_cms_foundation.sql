-- Pages CMS foundation (SP1): profiles/role, is_admin(), content tables, RLS, seed.

-- ── profiles : one row per auth user, carries the admin role ────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row on signup (standard Supabase pattern).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist.
insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

-- Admin check helper: bypasses RLS (security definer), pinned search_path.
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

-- Owner reads its own row; admin reads all. No client insert/update: role is
-- promoted only via service_role / SQL (anti self-promotion).
create policy profiles_read_self on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- ── roadmap_items : one kanban card per row ────────────────────────────────
create table public.roadmap_items (
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

-- ── changelog_releases + changelog_items ───────────────────────────────────
create table public.changelog_releases (
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
create table public.changelog_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.changelog_releases(id) on delete cascade,
  kind text not null check (kind in ('new','imp','fix')),
  text text not null,
  from_votes boolean not null default false,
  sort int not null default 0
);
create index changelog_items_release_idx on public.changelog_items(release_id);

-- ── guides ─────────────────────────────────────────────────────────────────
create table public.guides (
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

-- ── faq_items ──────────────────────────────────────────────────────────────
create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── reviews : seeded + read here; visitor insert (pending) lands in SP2 ─────
create table public.reviews (
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

-- updated_at trigger reuses public.touch_updated_at() (migration 20260713120000).
create trigger roadmap_items_touch before update on public.roadmap_items
  for each row execute function public.touch_updated_at();
create trigger changelog_releases_touch before update on public.changelog_releases
  for each row execute function public.touch_updated_at();
create trigger guides_touch before update on public.guides
  for each row execute function public.touch_updated_at();
create trigger faq_items_touch before update on public.faq_items
  for each row execute function public.touch_updated_at();

-- ── RLS : published content is world-readable; writes are admin-only ───────
alter table public.roadmap_items       enable row level security;
alter table public.changelog_releases  enable row level security;
alter table public.changelog_items     enable row level security;
alter table public.guides              enable row level security;
alter table public.faq_items           enable row level security;
alter table public.reviews             enable row level security;

create policy roadmap_items_read on public.roadmap_items
  for select using (status = 'published' or public.is_admin());
create policy roadmap_items_write on public.roadmap_items
  for all using (public.is_admin()) with check (public.is_admin());

create policy changelog_releases_read on public.changelog_releases
  for select using (status = 'published' or public.is_admin());
create policy changelog_releases_write on public.changelog_releases
  for all using (public.is_admin()) with check (public.is_admin());

create policy changelog_items_read on public.changelog_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.changelog_releases r
      where r.id = release_id and r.status = 'published'
    )
  );
create policy changelog_items_write on public.changelog_items
  for all using (public.is_admin()) with check (public.is_admin());

create policy guides_read on public.guides
  for select using (status = 'published' or public.is_admin());
create policy guides_write on public.guides
  for all using (public.is_admin()) with check (public.is_admin());

create policy faq_items_read on public.faq_items
  for select using (status = 'published' or public.is_admin());
create policy faq_items_write on public.faq_items
  for all using (public.is_admin()) with check (public.is_admin());

create policy reviews_read on public.reviews
  for select using (status = 'published' or public.is_admin());
create policy reviews_write on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ── seed : transcribed 1:1 from current page arrays, all status='published' ─
insert into public.roadmap_items (col, category, title, subtitle, tags, beta, locked, base_votes, shipped_label, shipped_link, status, sort) values
 ('idea','builder','Questions avec images et schémas','Insérer un visuel dans l''énoncé et les réponses.','[{"label":"Builder"}]',false,false,64,null,false,'published',10),
 ('idea','live','Mode hors-ligne pour l''hôte','Animer une session sans réseau fiable en salle.','[{"label":"Sessions live"}]',false,false,41,null,false,'published',20),
 ('idea','builder','Co-édition de quiz à plusieurs','Travailler un même quiz en équipe de formateurs.','[{"label":"Builder"}]',false,false,27,null,false,'published',30),
 ('idea','a11y','Sous-titres live pour l''accessibilité','Transcription des questions lues à voix haute.','[{"label":"Accessibilité"}]',false,false,19,null,false,'published',40),
 ('planned','integrations','Intégration Moodle / LMS (SCORM)','Exporter quiz et résultats vers votre LMS.','[{"label":"Intégrations"},{"label":"ETA T4 2026","eta":true}]',false,false,98,null,false,'published',50),
 ('planned','analytics','Rapports analytics automatiques par email','Le débrief de session dans votre boîte mail.','[{"label":"Analytics"},{"label":"ETA T4 2026","eta":true}]',false,false,73,null,false,'published',60),
 ('planned','orga','Banque de questions partagée en équipe','Un référentiel commun pour plusieurs formateurs.','[{"label":"Organisation"},{"label":"ETA T1 2027","eta":true}]',false,false,55,null,false,'published',70),
 ('dev','live','Mode équipes','Scores cumulés par table pour les ateliers en sous-groupes.','[{"label":"Sessions live"}]',true,true,143,null,false,'published',80),
 ('dev','exams','Correction manuelle des réponses libres','Interface de correction copie par copie pour les examens.','[{"label":"Examens"}]',false,true,87,null,false,'published',90),
 ('shipped','builder','Génération de quiz par IA','Livré en juin · ','[]',false,false,126,'Livré en juin',true,'published',100),
 ('shipped','exams','Alertes de sortie d''onglet (examens)','Livré en mai','[]',false,false,84,'Livré en mai',false,'published',110),
 ('shipped','analytics','Export PDF des résultats','Livré en avril','[]',false,false,61,'Livré en avril',false,'published',120);

insert into public.changelog_releases (version, title, date_label, intro, media, status, sort) values
 ('v2.15','Le mode équipes entre en bêta','10 juillet 2026','La fonctionnalité la plus votée de l''histoire de la roadmap (143 voix) arrive : jouez par tables, scores cumulés, podium d''équipes.','🏆🤝','published',10),
 ('v2.14','Analytics : le rapport PDF fait peau neuve','24 juin 2026',null,null,'published',20),
 ('v2.13','Génération de quiz par IA','5 juin 2026','Déposez un PDF de cours, obtenez une proposition de quiz calibrée — chaque question reste validée par vous avant publication.',null,'published',30),
 ('v2.12','Examens : surveillance renforcée','12 mai 2026',null,null,'published',40);

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
) as v(version, kind, text, from_votes, sort) on v.version = r.version;

insert into public.guides (emoji, cover_token, duration_label, title, level, format, status, sort) values
 ('🎬','--ap-quiz-soft','▶ 4:32','Créer un quiz de A à Z','deb','video','published',10),
 ('🪄','--ap-brand-soft','6 min','Générer un quiz par IA depuis un PDF de cours','deb','article','published',20),
 ('🎯','--ap-pres-soft','8 min','Doser la difficulté : la règle des 70/20/10','int','article','published',30),
 ('🎬','--ap-poll-soft','▶ 7:15','Animer un groupe de 100+ : rythme, pauses, relances','int','video','published',40),
 ('🎓','--ap-flash-soft','12 min','Monter un examen blanc certifiant (fenêtres, barème, litiges)','avc','article','published',50),
 ('📊','--ap-pres-soft','10 min','Exploiter les analytics pour réviser son cours','avc','article','published',60),
 ('🧊','--ap-quiz-soft','5 min','10 icebreakers qui marchent (même à 8 h 30)','deb','article','published',70),
 ('🎬','--ap-brand-soft','▶ 5:48','Flashcards & répétition espacée : le mode d''emploi','int','video','published',80);

insert into public.faq_items (category, question, answer, status, sort) values
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
 ('Données & Confidentialité','Comment supprimer mes créations ?','Dans les pages « Mes Quiz », « Mes Sondages » ou « Mes Flashcards », cliquez sur l''icône corbeille de la carte concernée, puis confirmez la suppression.','published',110);

insert into public.reviews (persona, stars, text, author_name, author_role, avatar_emoji, status, sort) values
 ('formateur',5,'Le lobby projeté fait son effet à chaque fois : les stagiaires dégainent leur téléphone avant même que j''aie fini d''expliquer. Zéro friction, zéro installation.','Karim T.','Formateur DevOps indépendant','🧔','published',10),
 ('entreprise',5,'On a remplacé notre ancien outil pour la conformité RGPD : hébergement UE, DPA signé en 48 h. Le service juridique a validé sans aller-retour — une première.','Claire D.','Responsable formation, ETI industrielle','🏢','published',20),
 ('enseignant',5,'Mes M2 réclament le quiz de fin de module. Le mode examen avec alertes de sortie d''onglet m''a évité deux litiges ce semestre : tout est tracé, horodaté, incontestable.','Julien P.','Enseignant vacataire, M2 cloud','👨‍🏫','published',30),
 ('formateur',4,'La génération IA depuis mes PDF me fait gagner une heure par module. Je retouche 20 % des questions, le reste est directement exploitable. Il manque juste les questions avec images.','Nadia B.','Formatrice Kubernetes','👩‍💻','published',40),
 ('enseignant',5,'Testé avec 160 étudiants en amphi : aucune latence, le podium final a déclenché une ovation. Je ne pensais pas dire ça d''un cours de réseaux à 8 h.','Sarah M.','Enseignante-chercheuse','👩‍🏫','published',50),
 ('entreprise',5,'Déployé pour 6 formateurs internes. La banque de questions partagée évite que chacun réinvente les mêmes QCM — on capitalise enfin sur nos contenus.','Marc L.','Directeur pédagogique, CFA','🏫','published',60);
