# Backend pages CMS — SP1 : Fondation & contenu (lecture)

**Date** : 2026-07-16
**Statut** : design validé
**Périmètre** : sous-projet 1 sur 3 du backend de gestion des pages `/report /roadmap /help /reviews /changelog /guides`.

## Contexte

Les 6 pages publiques (`Report`, `Roadmap`, `Changelog`, `Guides`, `Help`, `Temoignages`)
servent aujourd'hui du contenu **hardcodé** dans des arrays TypeScript en tête de chaque
composant. Objectif global (validé) : **Full CMS + interactions visiteur + UI admin in-app**,
avec :

- **Admin** identifié par une colonne `role` sur un profil (à créer — aucune table `profiles`
  n'existe encore ; les données user vivent dans `auth.user_metadata`).
- **Interactions visiteur** (vote, abonnement, report, avis) : **login requis** → RLS keyée sur
  `user_id`, pas d'edge function anti-abus.
- **UI admin** : route `/admin` gardée, dans la même app React.

Le projet est découpé en 3 sous-projets construits dans l'ordre :

- **SP1 (ce spec)** — Fondation : `profiles`/rôle + tables contenu + lecture des pages depuis la DB.
- **SP2** — Interactions visiteur en écriture (votes, idées, abonnés, reports, soumission d'avis).
- **SP3** — UI admin CMS (`/admin`) : CRUD contenu + modération.

SP1 débloque tout : le schéma et le gate admin sont les fondations de SP2 et SP3.

## Objectifs SP1

1. Créer `public.profiles` avec un champ `role` + helper `is_admin()`.
2. Créer les tables de contenu, seedées depuis les arrays hardcodés actuels.
3. RLS : lecture publique du contenu `published`, écriture réservée admin (utilisée en SP3).
4. Brancher les pages en **lecture** sur la DB via des hooks React Query, avec états
   loading / vide.

**Hors périmètre SP1** : toute écriture visiteur (SP2), toute UI admin (SP3), la page `Report`
(dépend de la table `reports` de SP2 — reste statique en SP1).

## Architecture

### 1. `profiles` + rôle admin

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- Auto-création du profil au signup (pattern Supabase standard)
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

-- Backfill des users déjà existants
insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

-- Helper admin : bypasse RLS, search_path figé
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

-- Owner lit sa propre ligne ; admin lit tout.
create policy profiles_read_self on public.profiles
  for select using (auth.uid() = id or public.is_admin());
-- Pas d'update client : la promotion admin passe par service_role / SQL uniquement.
```

**Sécurité** : aucune policy `update`/`insert` client sur `profiles` → un utilisateur ne peut
pas se promouvoir admin. Le premier admin (toi) est défini par un `update` SQL manuel :
`update public.profiles set role='admin' where id = '<ton-uuid>';`. `is_admin()` est
`security definer` avec `search_path` figé à `public` (anti hijack de résolution de fonctions).

### 2. Tables contenu

Convention commune à chaque table :

- `id uuid primary key default gen_random_uuid()`
- `status text not null default 'draft' check (status in ('draft','published'))`
- `sort int not null default 0` (ordre d'affichage)
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- trigger `touch_updated_at` (fonction déjà présente, migration `20260713120000`).

```sql
-- Roadmap : une carte = une ligne. La colonne kanban et la catégorie de filtre sont des champs.
create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  col text not null check (col in ('idea','planned','dev','shipped')),
  category text not null,          -- builder|live|exams|analytics|integrations|orga|a11y
  title text not null,
  subtitle text not null default '',
  tags jsonb not null default '[]'::jsonb,   -- [{label, eta?:bool}]
  eta text,                         -- ex: "ETA T4 2026" (redondant avec tags, gardé simple)
  beta boolean not null default false,
  base_votes int not null default 0,         -- offset d'affichage jusqu'à SP2
  shipped_label text,               -- ex: "Livré en juin"
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Changelog : release + items enfants
create table public.changelog_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,            -- "v2.15"
  title text not null,
  date_label text not null,         -- "10 juillet 2026" (libellé libre, pas de date typée)
  intro text,
  media text,                       -- emojis / illustration légère
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

-- Guides
create table public.guides (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '',
  cover_token text not null default '',      -- var CSS ex "--ap-quiz-soft"
  duration_label text not null default '',   -- "▶ 4:32" | "6 min"
  title text not null,
  level text not null check (level in ('deb','int','avc')),
  format text not null check (format in ('video','article')),
  url text,                          -- lien vidéo/article externe
  body text,                         -- HTML TipTap pour un guide article natif (optionnel)
  status text not null default 'draft' check (status in ('draft','published')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FAQ
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

-- Reviews : créée ici (seed + lecture). L'insert visiteur + statut 'pending' arrivent en SP2.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid references auth.users(id) on delete set null,  -- null pour le seed
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
```

Notes :

- **`reviews`** est créée en SP1 pour porter le seed et la lecture. En SP2 : ajout d'une policy
  `insert` visiteur (login requis), les soumissions arrivent en `status='pending'`, modérées en SP3.
- **`base_votes`** : le nombre de votes affiché sur la roadmap. En SP1 c'est une valeur seed
  statique ; SP2 introduira `roadmap_votes` et le compteur deviendra `base_votes + count(votes)`.
- **Décisions de simplicité (YAGNI)** : `date_label` est un texte libre (pas de date typée) car
  l'affichage est un libellé français rédigé ; `cover_token` stocke le nom de variable CSS existant
  pour ne pas retoucher le CSS ; `TICKETS`/`TYPES`/`SEVS`/`BARS`/`CHIPS` **ne sont pas** migrés
  (data user → SP2, ou config UI qui reste hardcodée).

### 3. RLS contenu

Même paire de policies sur `roadmap_items`, `changelog_releases`, `changelog_items`, `guides`,
`faq_items`, `reviews` (adapter la clause `published` à `changelog_items` via la release parente) :

```sql
alter table public.<table> enable row level security;

-- Lecture : contenu publié pour tous (y compris anon), tout pour admin.
create policy <table>_read_published on public.<table>
  for select using (status = 'published' or public.is_admin());

-- Écriture : admin only (utilisé en SP3).
create policy <table>_admin_write on public.<table>
  for all using (public.is_admin()) with check (public.is_admin());
```

Pour `changelog_items` (pas de colonne `status` propre), la lecture publique dépend du statut de
la release :

```sql
create policy changelog_items_read_published on public.changelog_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.changelog_releases r
      where r.id = release_id and r.status = 'published'
    )
  );
create policy changelog_items_admin_write on public.changelog_items
  for all using (public.is_admin()) with check (public.is_admin());
```

Pour `reviews`, la lecture publique se limite à `status='published'` (les `pending`/`rejected`
restent invisibles jusqu'à modération en SP3).

### 4. Seed

Le seed est **inclus dans la migration** (reproductible) : `insert` des arrays actuels avec
`status='published'` et `sort` croissant reflétant l'ordre d'affichage courant.

Source par table :

- `roadmap_items` ← `COLUMNS` (idea/planned/dev) + `SHIPPED` (col `shipped`) de `Roadmap.tsx`.
- `changelog_releases` + `changelog_items` ← `RELEASES` de `Changelog.tsx`.
- `guides` ← `GUIDES` de `Guides.tsx`.
- `faq_items` ← `FAQ_ITEMS` de `Help.tsx` (aplati : `category` répété par question).
- `reviews` ← `REVIEWS` de `Temoignages.tsx` (`author_user_id` null, `status='published'`).

### 5. Couche lecture front

- Nouveau module `src/lib/pages/` : types partagés + une fonction fetch Supabase par ressource.
- Hooks React Query (déjà dans le stack, `@tanstack/react-query`) :
  `useRoadmapItems()`, `useChangelog()`, `useGuides()`, `useFaq()`, `useReviews()`.
- Chaque hook **mappe les rows DB vers la shape exacte déjà attendue** par la page (types `Card`,
  `Release`, `Item`, etc.) → la réécriture des pages se limite à remplacer
  `const X = [...]` par `const { data, isLoading } = useX()`, plus un skeleton loading et un
  fallback « aucun contenu ».
- Pages branchées en lecture : `Roadmap`, `Changelog`, `Guides`, `Help`, `Temoignages`.
  `Report` **reste statique** en SP1.
- Les états d'interaction locaux (filtres par chips, toggles d'accordéon FAQ, quota de vote
  optimiste) restent côté client inchangés ; seul le **contenu source** devient asynchrone.

### 6. Déploiement

Deux cibles (cf. état prod : projet `quizz`, schéma hand-built, pas de tracking migration,
5432 firewallé) :

1. **Fichier migration local** `supabase/migrations/20260716xxxxxx_pages_cms_foundation.sql`
   (convention du repo, source de vérité versionnée).
2. **Application prod via Management API HTTPS** — même SQL exécuté sur le projet prod.

Après déploiement : `update public.profiles set role='admin'` sur ton compte pour valider
`is_admin()` (lecture des `draft` + préparation SP3).

## Découpage / unités testables

- **Migration SQL** : appliquée sur une base vierge → tables + policies + seed présents ;
  `is_admin()` renvoie `true`/`false` correctement selon le rôle.
- **Helper `is_admin()`** : testable isolément (2 users, un admin un non-admin).
- **RLS** : un client anon ne voit que les rows `published` ; un admin voit les `draft`.
- **Hooks front** : mockables (fetch → shape) et testables indépendamment des composants.
- **Pages** : rendu inchangé une fois les données chargées (parité visuelle avec l'existant).

## Critères de succès SP1

1. Les 5 pages de lecture affichent **le même contenu qu'avant**, mais servi depuis la DB.
2. Un contenu passé en `draft` disparaît des pages publiques ; un admin le voit encore.
3. `is_admin()` fonctionne en prod pour ton compte.
4. Migration rejouable, seed idempotent-friendly (ordre stable), déployée en local + prod.
5. Aucune régression visuelle sur les 5 pages (états loading/vide gérés proprement).

## Risques / points d'attention

- **Parité de shape** : le mapping DB→shape des pages doit être exact, sinon régression visuelle.
  Mitigation : conserver les types existants comme contrat du hook.
- **`security definer`** : `is_admin()` et `handle_new_user()` doivent figer `search_path=public`.
- **Drift local/prod** : le schéma prod est hand-built ; appliquer rigoureusement le **même** SQL
  aux deux cibles et le noter dans la mémoire projet.
- **`reviews` mi-chemin SP1/SP2** : table + seed + lecture en SP1 ; policy insert visiteur en SP2.
  Ne pas ajouter l'insert visiteur ici.
