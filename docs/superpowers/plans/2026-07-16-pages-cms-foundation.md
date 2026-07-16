# Pages CMS Foundation (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the content of the Roadmap, Changelog, Guides, Help and Reviews pages from Supabase instead of hardcoded arrays, behind an admin role gate.

**Architecture:** A new `public.profiles` table carries a `role` column with an `is_admin()` SQL helper. Six content tables (`roadmap_items`, `changelog_releases`, `changelog_items`, `guides`, `faq_items`, `reviews`) are seeded from the current hardcoded arrays; RLS exposes only `published` rows to the public and reserves writes for admins. A `src/lib/pages/` module holds pure row→shape mappers (unit-tested), thin Supabase fetch functions, and React Query hooks that the five pages consume in place of their inline arrays.

**Tech Stack:** Supabase (Postgres + RLS), React 18 + Vite, `@tanstack/react-query` (provider already mounted in `src/App.tsx`), Vitest for pure-function tests.

---

## File Structure

**Created:**
- `supabase/migrations/20260716120000_pages_cms_foundation.sql` — profiles, `is_admin()`, trigger, six content tables, RLS, seed.
- `src/lib/pages/types.ts` — canonical page-facing types (`RoadmapItem`, `RoadmapView`, `Release`, `ReleaseItem`, `Guide`, `FaqGroup`, `Review`) + DB row types.
- `src/lib/pages/mappers.ts` — pure mappers: `groupRoadmap`, `groupChangelog`, `mapGuide`, `groupFaq`, `mapReview`. No Supabase import (kept pure for tests).
- `src/lib/pages/repo.ts` — Supabase fetch functions returning mapped shapes.
- `src/lib/pages/hooks.ts` — React Query hooks: `useRoadmap`, `useChangelog`, `useGuides`, `useFaq`, `useReviews`.
- `src/lib/pages/__tests__/mappers.test.ts` — Vitest unit tests for the mappers.

**Modified:**
- `src/pages/Roadmap.tsx` — replace `COLUMNS`/`SHIPPED` with `useRoadmap()`.
- `src/pages/Changelog.tsx` — replace `RELEASES` with `useChangelog()`.
- `src/pages/Guides.tsx` — replace `GUIDES` with `useGuides()`.
- `src/pages/Help.tsx` — replace `FAQ_ITEMS` with `useFaq()`.
- `src/pages/Temoignages.tsx` — replace `REVIEWS` with `useReviews()`.

**Untouched in SP1:** `src/pages/Report.tsx` (depends on SP2 `reports` table), all `TYPES`/`SEVS`/`BARS`/`CHIPS` UI config arrays.

---

## Task 1: Migration — profiles, is_admin(), trigger, backfill

**Files:**
- Create: `supabase/migrations/20260716120000_pages_cms_foundation.sql`

- [ ] **Step 1: Write the profiles + admin foundation into the migration file**

Create the file with exactly this content:

```sql
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
```

- [ ] **Step 2: Apply the migration to the database**

Apply the file to your target database. Local (if the Supabase CLI stack is used): `supabase db reset` (re-runs all migrations). Prod: run the SQL through the Supabase Management API HTTPS query endpoint or the Studio SQL editor (port 5432 is firewalled — see `docs/.../prod-supabase-deploy-state`).

Expected: no error; `profiles` table and `is_admin()` function exist.

- [ ] **Step 3: Verify the schema and backfill**

Run this query against the same database:

```sql
select
  (select count(*) from public.profiles) as profile_count,
  (select count(*) from auth.users)      as user_count,
  public.is_admin()                      as am_i_admin_anon;
```

Expected: `profile_count = user_count` (backfill covered everyone), `am_i_admin_anon = false` (no admin set yet, and no auth context).

- [ ] **Step 4: Promote yourself to admin and re-verify**

Replace `<your-uuid>` with your `auth.users.id`:

```sql
update public.profiles set role = 'admin' where id = '<your-uuid>';
select role from public.profiles where id = '<your-uuid>';
```

Expected: one row, `role = 'admin'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716120000_pages_cms_foundation.sql
git commit -m "feat(db): profiles table, role, is_admin() helper"
```

---

## Task 2: Migration — content tables + RLS

**Files:**
- Modify: `supabase/migrations/20260716120000_pages_cms_foundation.sql` (append)

- [ ] **Step 1: Append the six content tables**

Append to the same migration file:

```sql
-- ── roadmap_items : one kanban card per row ────────────────────────────────
create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  col text not null check (col in ('idea','planned','dev','shipped')),
  category text not null,            -- builder|live|exams|analytics|integrations|orga|a11y
  title text not null,
  subtitle text not null default '',
  tags jsonb not null default '[]'::jsonb,   -- [{"label": "...", "eta": true?}]
  beta boolean not null default false,
  locked boolean not null default false,     -- "En développement" cards: vote locked on
  base_votes int not null default 0,
  shipped_label text,                        -- e.g. "Livré en juin"
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
```

- [ ] **Step 2: Append RLS policies**

Append:

```sql
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

-- reviews: only 'published' is public (pending/rejected stay hidden until SP3).
create policy reviews_read on public.reviews
  for select using (status = 'published' or public.is_admin());
create policy reviews_write on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 3: Apply and verify tables exist**

Re-apply the migration (`supabase db reset`, or run the appended SQL on prod). Then:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('roadmap_items','changelog_releases','changelog_items','guides','faq_items','reviews')
order by table_name;
```

Expected: all six rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716120000_pages_cms_foundation.sql
git commit -m "feat(db): content tables + RLS for pages CMS"
```

---

## Task 3: Migration — seed from current hardcoded arrays

**Files:**
- Modify: `supabase/migrations/20260716120000_pages_cms_foundation.sql` (append)

The seed values below are transcribed 1:1 from the current page arrays. All rows are inserted with `status = 'published'` and an ascending `sort` matching current display order.

- [ ] **Step 1: Append the roadmap seed**

Source: `COLUMNS` (idea/planned/dev) and `SHIPPED` in `src/pages/Roadmap.tsx`.

```sql
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
```

- [ ] **Step 2: Append the changelog seed**

Source: `RELEASES` in `src/pages/Changelog.tsx`. Insert releases, then items via subselect on version.

```sql
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
```

- [ ] **Step 3: Append the guides seed**

Source: `GUIDES` in `src/pages/Guides.tsx`.

```sql
insert into public.guides (emoji, cover_token, duration_label, title, level, format, status, sort) values
 ('🎬','--ap-quiz-soft','▶ 4:32','Créer un quiz de A à Z','deb','video','published',10),
 ('🪄','--ap-brand-soft','6 min','Générer un quiz par IA depuis un PDF de cours','deb','article','published',20),
 ('🎯','--ap-pres-soft','8 min','Doser la difficulté : la règle des 70/20/10','int','article','published',30),
 ('🎬','--ap-poll-soft','▶ 7:15','Animer un groupe de 100+ : rythme, pauses, relances','int','video','published',40),
 ('🎓','--ap-flash-soft','12 min','Monter un examen blanc certifiant (fenêtres, barème, litiges)','avc','article','published',50),
 ('📊','--ap-pres-soft','10 min','Exploiter les analytics pour réviser son cours','avc','article','published',60),
 ('🧊','--ap-quiz-soft','5 min','10 icebreakers qui marchent (même à 8 h 30)','deb','article','published',70),
 ('🎬','--ap-brand-soft','▶ 5:48','Flashcards & répétition espacée : le mode d''emploi','int','video','published',80);
```

- [ ] **Step 4: Append the FAQ seed**

Source: `FAQ_ITEMS` in `src/pages/Help.tsx` (flattened: category repeated per question).

```sql
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
```

- [ ] **Step 5: Append the reviews seed**

Source: `REVIEWS` in `src/pages/Temoignages.tsx`.

```sql
insert into public.reviews (persona, stars, text, author_name, author_role, avatar_emoji, status, sort) values
 ('formateur',5,'Le lobby projeté fait son effet à chaque fois : les stagiaires dégainent leur téléphone avant même que j''aie fini d''expliquer. Zéro friction, zéro installation.','Karim T.','Formateur DevOps indépendant','🧔','published',10),
 ('entreprise',5,'On a remplacé notre ancien outil pour la conformité RGPD : hébergement UE, DPA signé en 48 h. Le service juridique a validé sans aller-retour — une première.','Claire D.','Responsable formation, ETI industrielle','🏢','published',20),
 ('enseignant',5,'Mes M2 réclament le quiz de fin de module. Le mode examen avec alertes de sortie d''onglet m''a évité deux litiges ce semestre : tout est tracé, horodaté, incontestable.','Julien P.','Enseignant vacataire, M2 cloud','👨‍🏫','published',30),
 ('formateur',4,'La génération IA depuis mes PDF me fait gagner une heure par module. Je retouche 20 % des questions, le reste est directement exploitable. Il manque juste les questions avec images.','Nadia B.','Formatrice Kubernetes','👩‍💻','published',40),
 ('enseignant',5,'Testé avec 160 étudiants en amphi : aucune latence, le podium final a déclenché une ovation. Je ne pensais pas dire ça d''un cours de réseaux à 8 h.','Sarah M.','Enseignante-chercheuse','👩‍🏫','published',50),
 ('entreprise',5,'Déployé pour 6 formateurs internes. La banque de questions partagée évite que chacun réinvente les mêmes QCM — on capitalise enfin sur nos contenus.','Marc L.','Directeur pédagogique, CFA','🏫','published',60);
```

- [ ] **Step 6: Apply and verify the seed counts**

Re-apply the migration, then:

```sql
select
  (select count(*) from public.roadmap_items)      as roadmap,
  (select count(*) from public.changelog_releases) as releases,
  (select count(*) from public.changelog_items)    as changelog_items,
  (select count(*) from public.guides)             as guides,
  (select count(*) from public.faq_items)          as faq,
  (select count(*) from public.reviews)            as reviews;
```

Expected: `roadmap=12, releases=4, changelog_items=13, guides=8, faq=11, reviews=6`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260716120000_pages_cms_foundation.sql
git commit -m "feat(db): seed pages content from current hardcoded arrays"
```

---

## Task 4: Page types + row types

**Files:**
- Create: `src/lib/pages/types.ts`

- [ ] **Step 1: Write the types module**

```typescript
// Canonical shapes for the CMS-backed public pages.
// DB row types mirror the columns of the SP1 migration; view types are what
// the page components consume (kept close to the existing inline page types
// to minimize component rewrites).

// ── Roadmap ────────────────────────────────────────────────────────────────
export type RoadmapCol = 'idea' | 'planned' | 'dev' | 'shipped';
export interface RoadmapTag { label: string; eta?: boolean }

export interface RoadmapRow {
  id: string;
  col: RoadmapCol;
  category: string;
  title: string;
  subtitle: string;
  tags: RoadmapTag[];
  beta: boolean;
  locked: boolean;
  base_votes: number;
  shipped_label: string | null;
  shipped_link: boolean;
  sort: number;
}

export interface RoadmapCard {
  id: string;
  votes: number;
  title: string;
  sub: string;
  tags: RoadmapTag[];
  cat: string;
  locked: boolean;
  beta: boolean;
}
export interface ShippedCard {
  id: string;
  votes: number;
  title: string;
  sub: string;
  cat: string;
  link: boolean;
}
export interface RoadmapView {
  idea: RoadmapCard[];
  planned: RoadmapCard[];
  dev: RoadmapCard[];
  shipped: ShippedCard[];
}

// ── Changelog ──────────────────────────────────────────────────────────────
export type ChangelogKind = 'new' | 'imp' | 'fix';
export interface ReleaseRow {
  id: string;
  version: string;
  title: string;
  date_label: string;
  intro: string | null;
  media: string | null;
  sort: number;
}
export interface ChangelogItemRow {
  id: string;
  release_id: string;
  kind: ChangelogKind;
  text: string;
  from_votes: boolean;
  sort: number;
}
export interface ReleaseItem { t: ChangelogKind; text: string; fromVotes: boolean }
export interface Release {
  v: string;
  title: string;
  date: string;
  intro?: string;
  media?: string;
  items: ReleaseItem[];
}

// ── Guides ─────────────────────────────────────────────────────────────────
export interface GuideRow {
  id: string;
  emoji: string;
  cover_token: string;
  duration_label: string;
  title: string;
  level: 'deb' | 'int' | 'avc';
  format: 'video' | 'article';
  url: string | null;
  body: string | null;
  sort: number;
}
export interface Guide {
  id: string;
  emoji: string;
  cover: string;
  dur: string;
  title: string;
  lvl: 'deb' | 'int' | 'avc';
  fmt: 'video' | 'article';
  url: string | null;
}

// ── FAQ ────────────────────────────────────────────────────────────────────
export interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort: number;
}
export interface FaqGroup {
  category: string;
  questions: { q: string; a: string }[];
}

// ── Reviews ────────────────────────────────────────────────────────────────
export type ReviewPersona = 'formateur' | 'enseignant' | 'entreprise';
export interface ReviewRow {
  id: string;
  persona: ReviewPersona;
  stars: number;
  text: string;
  author_name: string;
  author_role: string;
  avatar_emoji: string;
  sort: number;
}
export interface Review {
  id: string;
  p: ReviewPersona;
  stars: number;
  text: string;
  av: string;
  name: string;
  role: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet, file compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pages/types.ts
git commit -m "feat(pages): canonical page + DB row types"
```

---

## Task 5: Pure mappers (TDD)

**Files:**
- Create: `src/lib/pages/mappers.ts`
- Test: `src/lib/pages/__tests__/mappers.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { groupRoadmap, groupChangelog, mapGuide, groupFaq, mapReview } from '../mappers';
import type { RoadmapRow, ReleaseRow, ChangelogItemRow, GuideRow, FaqRow, ReviewRow } from '../types';

describe('groupRoadmap', () => {
  const rows: RoadmapRow[] = [
    { id: '1', col: 'idea', category: 'builder', title: 'A', subtitle: 'sa', tags: [{ label: 'Builder' }], beta: false, locked: false, base_votes: 64, shipped_label: null, shipped_link: false, sort: 10 },
    { id: '2', col: 'dev', category: 'live', title: 'B', subtitle: 'sb', tags: [], beta: true, locked: true, base_votes: 143, shipped_label: null, shipped_link: false, sort: 80 },
    { id: '3', col: 'shipped', category: 'builder', title: 'C', subtitle: 'sc', tags: [], beta: false, locked: false, base_votes: 126, shipped_label: 'Livré en juin', shipped_link: true, sort: 100 },
  ];
  it('splits rows into kanban columns', () => {
    const v = groupRoadmap(rows);
    expect(v.idea).toHaveLength(1);
    expect(v.dev).toHaveLength(1);
    expect(v.shipped).toHaveLength(1);
    expect(v.planned).toHaveLength(0);
  });
  it('maps a card with votes from base_votes and cat from category', () => {
    const card = groupRoadmap(rows).idea[0];
    expect(card).toEqual({ id: '1', votes: 64, title: 'A', sub: 'sa', tags: [{ label: 'Builder' }], cat: 'builder', locked: false, beta: false });
  });
  it('maps a shipped card with link flag', () => {
    const s = groupRoadmap(rows).shipped[0];
    expect(s).toEqual({ id: '3', votes: 126, title: 'C', sub: 'Livré en juin', cat: 'builder', link: true });
  });
});

describe('groupChangelog', () => {
  const releases: ReleaseRow[] = [
    { id: 'r1', version: 'v2.15', title: 'T15', date_label: '10 juillet 2026', intro: 'intro', media: '🏆', sort: 10 },
    { id: 'r2', version: 'v2.14', title: 'T14', date_label: '24 juin 2026', intro: null, media: null, sort: 20 },
  ];
  const items: ChangelogItemRow[] = [
    { id: 'i1', release_id: 'r1', kind: 'new', text: 'feat', from_votes: true, sort: 10 },
    { id: 'i2', release_id: 'r1', kind: 'fix', text: 'bug', from_votes: false, sort: 20 },
    { id: 'i3', release_id: 'r2', kind: 'imp', text: 'imp', from_votes: false, sort: 10 },
  ];
  it('nests items under their release, preserving order', () => {
    const out = groupChangelog(releases, items);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      v: 'v2.15', title: 'T15', date: '10 juillet 2026', intro: 'intro', media: '🏆',
      items: [
        { t: 'new', text: 'feat', fromVotes: true },
        { t: 'fix', text: 'bug', fromVotes: false },
      ],
    });
    expect(out[1].intro).toBeUndefined();
    expect(out[1].media).toBeUndefined();
    expect(out[1].items).toHaveLength(1);
  });
});

describe('mapGuide', () => {
  it('renames columns to the page shape', () => {
    const row: GuideRow = { id: 'g1', emoji: '🎬', cover_token: '--ap-quiz-soft', duration_label: '▶ 4:32', title: 'Créer', level: 'deb', format: 'video', url: null, body: null, sort: 10 };
    expect(mapGuide(row)).toEqual({ id: 'g1', emoji: '🎬', cover: '--ap-quiz-soft', dur: '▶ 4:32', title: 'Créer', lvl: 'deb', fmt: 'video', url: null });
  });
});

describe('groupFaq', () => {
  it('groups questions by category, preserving first-seen order', () => {
    const rows: FaqRow[] = [
      { id: 'f1', category: 'Démarrage', question: 'q1', answer: 'a1', sort: 10 },
      { id: 'f2', category: 'Démarrage', question: 'q2', answer: 'a2', sort: 20 },
      { id: 'f3', category: 'Données', question: 'q3', answer: 'a3', sort: 30 },
    ];
    expect(groupFaq(rows)).toEqual([
      { category: 'Démarrage', questions: [{ q: 'q1', a: 'a1' }, { q: 'q2', a: 'a2' }] },
      { category: 'Données', questions: [{ q: 'q3', a: 'a3' }] },
    ]);
  });
});

describe('mapReview', () => {
  it('renames columns to the page shape', () => {
    const row: ReviewRow = { id: 'v1', persona: 'formateur', stars: 5, text: 'great', author_name: 'Karim T.', author_role: 'Formateur', avatar_emoji: '🧔', sort: 10 };
    expect(mapReview(row)).toEqual({ id: 'v1', p: 'formateur', stars: 5, text: 'great', av: '🧔', name: 'Karim T.', role: 'Formateur' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pages/__tests__/mappers.test.ts`
Expected: FAIL — cannot resolve `../mappers`.

- [ ] **Step 3: Write the mappers**

```typescript
import type {
  RoadmapRow, RoadmapCard, ShippedCard, RoadmapView,
  ReleaseRow, ChangelogItemRow, Release,
  GuideRow, Guide,
  FaqRow, FaqGroup,
  ReviewRow, Review,
} from './types';

export function groupRoadmap(rows: RoadmapRow[]): RoadmapView {
  const view: RoadmapView = { idea: [], planned: [], dev: [], shipped: [] };
  for (const r of rows) {
    if (r.col === 'shipped') {
      const card: ShippedCard = {
        id: r.id, votes: r.base_votes, title: r.title,
        sub: r.shipped_label ?? r.subtitle, cat: r.category, link: r.shipped_link,
      };
      view.shipped.push(card);
    } else {
      const card: RoadmapCard = {
        id: r.id, votes: r.base_votes, title: r.title, sub: r.subtitle,
        tags: r.tags, cat: r.category, locked: r.locked, beta: r.beta,
      };
      view[r.col].push(card);
    }
  }
  return view;
}

export function groupChangelog(releases: ReleaseRow[], items: ChangelogItemRow[]): Release[] {
  return releases.map((r) => {
    const release: Release = {
      v: r.version, title: r.title, date: r.date_label,
      items: items
        .filter((it) => it.release_id === r.id)
        .map((it) => ({ t: it.kind, text: it.text, fromVotes: it.from_votes })),
    };
    if (r.intro) release.intro = r.intro;
    if (r.media) release.media = r.media;
    return release;
  });
}

export function mapGuide(row: GuideRow): Guide {
  return {
    id: row.id, emoji: row.emoji, cover: row.cover_token, dur: row.duration_label,
    title: row.title, lvl: row.level, fmt: row.format, url: row.url,
  };
}

export function groupFaq(rows: FaqRow[]): FaqGroup[] {
  const groups: FaqGroup[] = [];
  const byCategory = new Map<string, FaqGroup>();
  for (const r of rows) {
    let group = byCategory.get(r.category);
    if (!group) {
      group = { category: r.category, questions: [] };
      byCategory.set(r.category, group);
      groups.push(group);
    }
    group.questions.push({ q: r.question, a: r.answer });
  }
  return groups;
}

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id, p: row.persona, stars: row.stars, text: row.text,
    av: row.avatar_emoji, name: row.author_name, role: row.author_role,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pages/__tests__/mappers.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pages/mappers.ts src/lib/pages/__tests__/mappers.test.ts
git commit -m "feat(pages): pure row->view mappers with tests"
```

---

## Task 6: Supabase fetch functions + React Query hooks

**Files:**
- Create: `src/lib/pages/repo.ts`
- Create: `src/lib/pages/hooks.ts`

- [ ] **Step 1: Write the repo fetch functions**

```typescript
import { supabase } from '@/lib/supabase';
import type {
  RoadmapRow, RoadmapView, ReleaseRow, ChangelogItemRow, Release,
  GuideRow, Guide, FaqRow, FaqGroup, ReviewRow, Review,
} from './types';
import { groupRoadmap, groupChangelog, mapGuide, groupFaq, mapReview } from './mappers';

// RLS returns only status='published' rows to anon/non-admin callers.

export async function fetchRoadmap(): Promise<RoadmapView> {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id,col,category,title,subtitle,tags,beta,locked,base_votes,shipped_label,shipped_link,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return groupRoadmap((data ?? []) as RoadmapRow[]);
}

export async function fetchChangelog(): Promise<Release[]> {
  const [releasesRes, itemsRes] = await Promise.all([
    supabase.from('changelog_releases')
      .select('id,version,title,date_label,intro,media,sort')
      .order('sort', { ascending: true }),
    supabase.from('changelog_items')
      .select('id,release_id,kind,text,from_votes,sort')
      .order('sort', { ascending: true }),
  ]);
  if (releasesRes.error) throw releasesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  return groupChangelog((releasesRes.data ?? []) as ReleaseRow[], (itemsRes.data ?? []) as ChangelogItemRow[]);
}

export async function fetchGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('guides')
    .select('id,emoji,cover_token,duration_label,title,level,format,url,body,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GuideRow[]).map(mapGuide);
}

export async function fetchFaq(): Promise<FaqGroup[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('id,category,question,answer,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return groupFaq((data ?? []) as FaqRow[]);
}

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,persona,stars,text,author_name,author_role,avatar_emoji,sort')
    .eq('status', 'published')
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ReviewRow[]).map(mapReview);
}
```

- [ ] **Step 2: Write the React Query hooks**

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchRoadmap, fetchChangelog, fetchGuides, fetchFaq, fetchReviews } from './repo';

export const useRoadmap = () =>
  useQuery({ queryKey: ['pages', 'roadmap'], queryFn: fetchRoadmap });

export const useChangelog = () =>
  useQuery({ queryKey: ['pages', 'changelog'], queryFn: fetchChangelog });

export const useGuides = () =>
  useQuery({ queryKey: ['pages', 'guides'], queryFn: fetchGuides });

export const useFaq = () =>
  useQuery({ queryKey: ['pages', 'faq'], queryFn: fetchFaq });

export const useReviews = () =>
  useQuery({ queryKey: ['pages', 'reviews'], queryFn: fetchReviews });
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pages/repo.ts src/lib/pages/hooks.ts
git commit -m "feat(pages): supabase fetch functions + react-query hooks"
```

---

## Task 7: Wire Roadmap page

**Files:**
- Modify: `src/pages/Roadmap.tsx`

- [ ] **Step 1: Replace the hardcoded data with the hook**

In `src/pages/Roadmap.tsx`:

1. Remove the `Card` type (lines 19-28), the `COLUMNS` constant (lines 30-67), and the `SHIPPED` constant (lines 69-73).
2. Add import at the top: `import { useRoadmap } from "@/lib/pages/hooks";` and `import type { RoadmapCard } from "@/lib/pages/types";`
3. Inside the component, after `const [filter, setFilter] = useState<Cat>("all");`, add:

```tsx
  const { data: view, isLoading } = useRoadmap();
```

4. Replace the static `COLUMNS` render block. The three interactive columns are now driven by `view`. Define the column metadata (head label + style) locally and pull cards from `view`:

```tsx
  const COLS: { key: 'idea' | 'planned' | 'dev'; head: string; headStyle: React.CSSProperties }[] = [
    { key: 'idea', head: "👀 À l'étude", headStyle: { background: "var(--ap-paper-2)", borderColor: "var(--ap-line-2)", color: "var(--ap-muted)" } },
    { key: 'planned', head: "🗓 Planifié", headStyle: { background: "var(--ap-poll-soft)", borderColor: "var(--ap-poll)", color: "var(--ap-poll-deep)" } },
    { key: 'dev', head: "🔨 En développement", headStyle: { background: "var(--ap-flash-soft)", borderColor: "var(--ap-flash)", color: "var(--ap-flash-deep)" } },
  ];
```

5. In the `.rboard` block, render loading and empty states, then map `COLS` reading `view[col.key]`, and the shipped column reading `view.shipped`. Keep the existing `.rcard` / `.vote` markup unchanged; only the data source changes. Replace the `{COLUMNS.map(...)}` and shipped `{SHIPPED...}` blocks with:

```tsx
            {isLoading || !view ? (
              <div className="rcol" style={{ opacity: 0.5 }}>Chargement…</div>
            ) : (
              <>
                {COLS.map((col) => {
                  const cards = view[col.key].filter((c) => match(c.cat));
                  return (
                    <div className="rcol" key={col.key}>
                      <div className="rcol-head" style={col.headStyle}>
                        {col.head}
                        <span className="cnt">{cards.length}</span>
                      </div>
                      {cards.map((card: RoadmapCard) => {
                        const on = card.locked || !!voted[card.id];
                        return (
                          <div className="card rcard" key={card.id}
                            style={col.key === "dev" ? { borderColor: "var(--ap-flash)" } : undefined}>
                            <button className={`vote${on ? " on" : ""}`} disabled={card.locked}
                              onClick={() => !card.locked && toggleVote(card.id)}
                              style={shake === card.id ? { animation: "lq-shake .24s" } : undefined}>
                              <ChevronUp size={13} strokeWidth={3} />
                              <span>{card.votes + (voted[card.id] ? 1 : 0)}</span>
                            </button>
                            <div className="rt">
                              <b>{card.title}</b>
                              <small>{card.sub}</small>
                              {card.tags.length > 0 && (
                                <div className="rtags">
                                  {card.tags.map((t, i) => (
                                    <span key={i} className={`rtag${t.eta ? " rtag--eta" : ""}`}>{t.label}</span>
                                  ))}
                                  {card.beta && <span className="betapill">Bêta ouverte</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="rcol">
                  <div className="rcol-head" style={{ background: "var(--ap-pres-soft)", borderColor: "var(--ap-pres)", color: "var(--ap-pres-deep)" }}>
                    ✅ Livré
                    <span className="cnt">{view.shipped.filter((s) => match(s.cat)).length}</span>
                  </div>
                  {view.shipped.filter((s) => match(s.cat)).map((s) => (
                    <div className="card rcard" key={s.id}>
                      <span className="shipvote">✓<span style={{ fontSize: "11px" }}>{s.votes}</span></span>
                      <div className="rt">
                        <b>{s.title}</b>
                        <small>
                          {s.sub}
                          {s.link && (
                            <a href="/changelog" onClick={(e) => { e.preventDefault(); navigate("/changelog"); }}>voir la nouveauté →</a>
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No remaining references to `COLUMNS`, `SHIPPED`, or the old `Card` type.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `/roadmap`. Expected: the four columns (À l'étude / Planifié / En développement / Livré) render the same cards as before, votes shown, chips filter still work.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Roadmap.tsx
git commit -m "feat(pages): serve Roadmap from Supabase via useRoadmap"
```

---

## Task 8: Wire Changelog page

**Files:**
- Modify: `src/pages/Changelog.tsx`

- [ ] **Step 1: Replace the hardcoded data with the hook**

In `src/pages/Changelog.tsx`:

1. Remove the `Item` and `Release` type aliases (lines 22-23) and the `RELEASES` constant (lines 25-70).
2. Add imports: `import { useChangelog } from "@/lib/pages/hooks";` and `import type { Release } from "@/lib/pages/types";`
3. Inside the component, after `const [filter, setFilter] = useState<Kind>("all");`, add:

```tsx
  const { data: releases, isLoading } = useChangelog();
```

4. Replace `RELEASES.filter(releaseVisible)` usage. Update `releaseVisible` to take the fetched list and guard for loading. Replace the `.changelog` block:

```tsx
          <div className="changelog">
            {isLoading || !releases ? (
              <div style={{ opacity: 0.5, padding: "24px 0" }}>Chargement…</div>
            ) : (
              releases.filter(releaseVisible).map((r) => (
                <div className="release" key={r.v}>
                  <div className="card rel-card">
                    <div className="rel-head">
                      <span className="vtag">{r.v}</span>
                      <h3>{r.title}</h3>
                      <span className="rel-date">{r.date}</span>
                    </div>
                    {r.intro && <p>{r.intro}</p>}
                    {r.media && <div className="rel-media">{r.media}</div>}
                    {r.items
                      .filter((it) => filter === "all" || it.t === filter)
                      .map((it, i) => (
                        <div className="rel-item" key={i}>
                          <span className={`reltag ${KIND_LABEL[it.t].cls}`}>{KIND_LABEL[it.t].label}</span>
                          <span>
                            {it.text}
                            {it.fromVotes && <span className="fromvotes">▲ issue de vos votes</span>}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
```

5. Keep `releaseVisible` but retype its parameter: `const releaseVisible = (r: Release) => filter === "all" || r.items.some((it) => it.t === filter);`

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No remaining references to `RELEASES`.

- [ ] **Step 3: Verify in the browser**

Open `/changelog`. Expected: four releases (v2.15 → v2.12) render with their items; the ✦/↑/🔧 chips still filter.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Changelog.tsx
git commit -m "feat(pages): serve Changelog from Supabase via useChangelog"
```

---

## Task 9: Wire Guides page

**Files:**
- Modify: `src/pages/Guides.tsx`

- [ ] **Step 1: Inspect the current render block**

Run: `sed -n '40,111p' src/pages/Guides.tsx` to see how `GUIDES` is mapped into cards (the exact JSX below the constants).

- [ ] **Step 2: Replace the hardcoded data with the hook**

In `src/pages/Guides.tsx`:

1. Remove the `GUIDES` constant (lines 10-19).
2. Add imports: `import { useGuides } from "@/lib/pages/hooks";` and `import type { Guide } from "@/lib/pages/types";`
3. Inside the component, after the `useState<Filter>` line, add:

```tsx
  const { data: guides, isLoading } = useGuides();
```

4. In the JSX, wherever the code iterates `GUIDES` (identified in Step 1), replace the source with the fetched `guides`, guarding for loading. The card markup stays identical; only the iteration source changes. If the current filter logic is `GUIDES.filter(...)`, change it to:

```tsx
  const visible = (guides ?? []).filter((g: Guide) =>
    filter === "all" ? true : filter === "video" ? g.fmt === "video" : g.lvl === filter,
  );
```

and render `isLoading ? <div style={{ opacity: 0.5 }}>Chargement…</div> : visible.map(...)` using the same card JSX as before (fields: `g.emoji`, `g.cover`, `g.dur`, `g.title`, `g.lvl`, `g.fmt`).

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No remaining references to `GUIDES`.

- [ ] **Step 4: Verify in the browser**

Open `/guides`. Expected: eight guide cards render, level/video chips still filter.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Guides.tsx
git commit -m "feat(pages): serve Guides from Supabase via useGuides"
```

---

## Task 10: Wire Help (FAQ) page

**Files:**
- Modify: `src/pages/Help.tsx`

- [ ] **Step 1: Inspect the current render block**

Run: `sed -n '104,173p' src/pages/Help.tsx` to see how `FAQ_ITEMS` is iterated (categories → `FAQItem` components).

- [ ] **Step 2: Replace the hardcoded data with the hook**

In `src/pages/Help.tsx`:

1. Remove the `FAQ_ITEMS` constant (lines 8-73). Keep the `FAQItem` component (lines 75-102) unchanged.
2. Add imports: `import { useFaq } from "@/lib/pages/hooks";` and `import type { FaqGroup } from "@/lib/pages/types";`
3. Inside the `Help` component, add:

```tsx
  const { data: faq, isLoading } = useFaq();
```

4. Where the JSX maps `FAQ_ITEMS` (from Step 1), swap the source to `faq`, guarding for loading. The grouping shape is identical (`{ category, questions: [{ q, a }] }`), so the inner markup is unchanged:

```tsx
  {isLoading || !faq ? (
    <div style={{ opacity: 0.5 }}>Chargement…</div>
  ) : (
    faq.map((group: FaqGroup) => (
      /* keep the existing per-category markup, iterating group.questions
         and rendering <FAQItem q={item.q} a={item.a} /> exactly as before */
    ))
  )}
```

Preserve the existing category heading markup and `FAQItem` usage from Step 1 verbatim; only `FAQ_ITEMS` → `faq` changes.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No remaining references to `FAQ_ITEMS`.

- [ ] **Step 4: Verify in the browser**

Open `/help`. Expected: four categories with their questions; accordion open/close still works.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Help.tsx
git commit -m "feat(pages): serve Help FAQ from Supabase via useFaq"
```

---

## Task 11: Wire Reviews (Temoignages) page

**Files:**
- Modify: `src/pages/Temoignages.tsx`

- [ ] **Step 1: Inspect the current render block**

Run: `sed -n '39,130p' src/pages/Temoignages.tsx` to see how `REVIEWS` is filtered by `persona` and rendered.

- [ ] **Step 2: Replace the hardcoded data with the hook**

In `src/pages/Temoignages.tsx`:

1. Remove the `REVIEWS` constant (lines 25-32). Keep `BARS`, `CHIPS`, the `Persona` type, and the `stars` helper unchanged (`BARS` stays hardcoded — it is UI config, not CMS content).
2. Add imports: `import { useReviews } from "@/lib/pages/hooks";` and `import type { Review } from "@/lib/pages/types";`
3. Inside the component, add:

```tsx
  const { data: reviews, isLoading } = useReviews();
```

4. Where the JSX maps `REVIEWS` (from Step 1), swap the source to `reviews`, guarding for loading. The fetched `Review` shape matches the fields the page already reads (`p`, `stars`, `text`, `av`, `name`, `role`):

```tsx
  const visible = (reviews ?? []).filter((r: Review) => persona === "all" || r.p === persona);
```

Render `isLoading ? <div style={{ opacity: 0.5 }}>Chargement…</div> : visible.map(...)` with the existing review-card markup.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. No remaining references to `REVIEWS`.

- [ ] **Step 4: Verify in the browser**

Open `/reviews`. Expected: six testimonials render, persona chips still filter, rating bars unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Temoignages.tsx
git commit -m "feat(pages): serve Reviews from Supabase via useReviews"
```

---

## Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS, including `src/lib/pages/__tests__/mappers.test.ts`.

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual draft-visibility check**

In the database, flip one row to draft and confirm it disappears for the public:

```sql
update public.guides set status = 'draft' where title = '10 icebreakers qui marchent (même à 8 h 30)';
```

Reload `/guides` while logged out (or as a non-admin). Expected: seven guides now (the drafted one is hidden). Revert:

```sql
update public.guides set status = 'published' where title = '10 icebreakers qui marchent (même à 8 h 30)';
```

- [ ] **Step 4: Deploy the migration to prod**

Apply `supabase/migrations/20260716120000_pages_cms_foundation.sql` to the prod project via the Supabase Management API HTTPS query endpoint (5432 is firewalled). Re-run the count query from Task 3 Step 6 against prod. Expected: same counts. Set your prod account to admin (Task 1 Step 4).

- [ ] **Step 5: Update project memory**

Note in the deploy-state memory that SP1 (pages CMS foundation) tables + seed are deployed to prod, and that `profiles.role`/`is_admin()` now exist (SP2/SP3 depend on them).

---

## Self-Review Notes

- **Spec coverage:** profiles/role + is_admin (Task 1) ✓; six content tables + RLS (Tasks 2) ✓; seed (Task 3) ✓; read layer hooks (Tasks 4-6) ✓; five pages wired, Report excluded (Tasks 7-11) ✓; dual local+prod deploy (Task 12) ✓; loading/empty states (each page task) ✓.
- **Report page** intentionally untouched (spec: depends on SP2 `reports`).
- **`reviews` insert policy** intentionally deferred to SP2 (spec).
- **BARS on Reviews** stays hardcoded (spec: UI config).
- **Type consistency:** hook return types (`RoadmapView`, `Release[]`, `Guide[]`, `FaqGroup[]`, `Review[]`) match mapper outputs and page consumption.
