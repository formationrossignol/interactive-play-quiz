# Backend pages CMS — SP2 : Interactions visiteur (écriture)

**Date** : 2026-07-16
**Statut** : design validé
**Périmètre** : sous-projet 2 sur 3 du backend des pages `/report /roadmap /help /reviews /changelog /guides`.
**Dépend de** : SP1 (`profiles`/`is_admin()`, tables contenu, `reviews` déjà créée). Voir `2026-07-16-pages-cms-foundation-design.md`.

## Contexte

SP1 sert le contenu en lecture. SP2 ajoute les **écritures visiteur**, toutes **login requis**
(décidé) → RLS keyée sur `user_id`, pas d'edge function anti-abus, pas d'envoi d'email (décidé :
capture DB seule ; la delivery email est hors périmètre). Les soumissions modérables (avis, idées)
arrivent en `status='pending'` et restent invisibles jusqu'à la modération en SP3.

Interactions couvertes :

- **Roadmap** : voter (quota 3 votes globaux, 1 par carte, retirable) ; proposer une idée.
- **Changelog** : s'abonner aux nouveautés (toggle ; l'email vient du compte).
- **Report** : soumettre un ticket ; voir ses propres tickets (remplace le mock `TICKETS`).
- **Reviews** : soumettre un avis (→ `pending`).

## Objectifs SP2

1. Tables d'interaction + RLS user_id, trigger de quota de vote, vue de comptage.
2. Policy `insert` visiteur sur `reviews` (login requis, force `status='pending'`).
3. Couche front d'écriture (repo + hooks) et câblage des 4 pages.
4. Gate login : une action tentée sans session → redirection vers `/auth`.

**Hors périmètre** : UI/CRUD admin et modération (SP3) ; envoi d'emails ; notifications temps réel.

## Architecture

### 1. Nouvelle migration `supabase/migrations/2026xxxx_pages_cms_interactions.sql`

```sql
-- ── roadmap_votes : 1 vote par (user, item), quota global de 3 ──────────────
create table public.roadmap_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.roadmap_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index roadmap_votes_item_idx on public.roadmap_votes(item_id);

-- Quota : au plus 3 votes par utilisateur (fiabilité DB, pas seulement client).
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
create trigger roadmap_votes_quota before insert on public.roadmap_votes
  for each row execute function public.enforce_vote_quota();

-- ── roadmap_ideas : proposition libre, modérée en SP3 ───────────────────────
create table public.roadmap_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  status text not null default 'pending' check (status in ('pending','converted','rejected')),
  created_at timestamptz not null default now()
);
create index roadmap_ideas_user_idx on public.roadmap_ideas(user_id);

-- ── reports : ticket de support ─────────────────────────────────────────────
create table public.reports (
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
create index reports_user_idx on public.reports(user_id);
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- ── changelog_subscribers : toggle d'abonnement (email = compte) ────────────
create table public.changelog_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── vue de comptage des votes, lecture publique ─────────────────────────────
create view public.roadmap_vote_counts as
  select item_id, count(*)::int as votes
  from public.roadmap_votes
  group by item_id;
```

### 2. RLS

```sql
alter table public.roadmap_votes         enable row level security;
alter table public.roadmap_ideas         enable row level security;
alter table public.reports               enable row level security;
alter table public.changelog_subscribers enable row level security;

-- votes : lecture publique (comptage) ; insert/delete de ses propres votes ; admin lit tout.
create policy roadmap_votes_read on public.roadmap_votes for select using (true);
create policy roadmap_votes_insert on public.roadmap_votes
  for insert with check (auth.uid() = user_id);
create policy roadmap_votes_delete on public.roadmap_votes
  for delete using (auth.uid() = user_id);

-- ideas : le propriétaire gère/lit les siennes ; admin lit tout (modération SP3).
create policy roadmap_ideas_owner on public.roadmap_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy roadmap_ideas_admin_read on public.roadmap_ideas
  for select using (public.is_admin());

-- reports : propriétaire CRUD ses tickets ; admin lit/gère tout (SP3).
create policy reports_owner on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

-- subscribers : chacun gère sa propre ligne.
create policy changelog_subscribers_owner on public.changelog_subscribers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews (table créée en SP1) : insert visiteur, forcé en 'pending' et attribué au user.
create policy reviews_insert_self on public.reviews
  for insert with check (
    auth.uid() = author_user_id and status = 'pending'
  );
```

Note : la vue `roadmap_vote_counts` hérite de la lecture publique de `roadmap_votes`
(`roadmap_votes_read using (true)`), donc elle est lisible sans policy dédiée.

### 3. Compteur de votes (approche vue SQL — décidée)

- `fetchRoadmap()` (SP1) : items publiés, avec `base_votes`.
- Nouveau `fetchVoteCounts()` : `select * from roadmap_vote_counts` → `Map<item_id, votes>`.
- Nouveau `fetchMyVotes()` : `select item_id from roadmap_votes where user_id = auth.uid()`
  → `Set<item_id>` (vide si non connecté).
- Assemblage côté hook `useRoadmap` (étendu) : pour chaque carte,
  `votes = base_votes + (counts.get(id) ?? 0)`, `voted = myVotes.has(id)`,
  et `remaining = 3 - myVotes.size`.

### 4. Front — repo + hooks

- `src/lib/pages/interactionsRepo.ts` :
  `castVote(itemId)`, `removeVote(itemId)`, `fetchVoteCounts()`, `fetchMyVotes()`,
  `submitIdea(text)`, `isSubscribed()`, `subscribe()`, `unsubscribe()`,
  `submitReport({type,severity,title,body})`, `fetchMyReports()`,
  `submitReview({persona,stars,text,authorName,authorRole})`.
- Hooks (React Query, mutations + invalidation de `['pages','roadmap']` etc.) :
  `useVote()`, `useSubmitIdea()`, `useChangelogSubscription()`, `useSubmitReport()`,
  `useMyReports()`, `useSubmitReview()`.
- `submitReview` remplit `author_user_id = user.id`, `author_name` défaut = `username` du compte,
  `status = 'pending'`.

### 5. Gate login (redirect `/auth`)

- Helper `requireAuth(navigate)` : si `getCurrentUser()` est nul → `navigate('/auth')` et retourne
  `false`, sinon `true`. Chaque handler d'action (`vote`, `submit…`) appelle ce garde en premier.
- (`getCurrentUser` et la route `/auth` existent déjà.)

### 6. Câblage des pages

- **Roadmap** : `toggleVote` appelle `useVote` (optimistic) avec quota réel ; le quota affiché
  (`remaining`, dots) vient de `useRoadmap` étendu ; l'input « Proposer l'idée » appelle
  `useSubmitIdea` (au lieu de `navigate('/contact')`), avec accusé visuel + reset.
- **Changelog** : le champ email libre est remplacé par un bouton toggle piloté par
  `useChangelogSubscription` (état abonné/non abonné du compte).
- **Report** : le formulaire (`type`, `severity`, `title`, description) appelle `useSubmitReport` ;
  la liste `TICKETS` hardcodée est remplacée par `useMyReports()` (tickets réels du user, statut,
  date) ; état vide « aucun ticket ».
- **Temoignages** : ajout d'un formulaire de soumission d'avis (`persona`, `stars`, `text`,
  `author_role`) appelant `useSubmitReview` → message « en attente de modération ». La liste
  publique reste `useReviews` (SP1, `published` seulement).

## Découpage / unités testables

- **Migration** : tables + RLS + trigger quota + vue, appliquée sur base vierge.
- **Trigger quota** : un 4ᵉ insert pour le même user échoue ; 3 réussissent ; retrait puis nouvel
  insert réussit.
- **RLS** : user A ne voit pas les reports/ideas de user B ; un anon ne peut pas insérer un vote ;
  un insert review avec `status != 'pending'` ou `author_user_id != auth.uid()` est refusé.
- **Assemblage vote count** : fonction pure `mergeVotes(view, counts, myVotes)` testable en Vitest
  (comme les mappers SP1).
- **Hooks** : mutations mockables.

## Critères de succès SP2

1. Voter/retirer fonctionne, quota 3 respecté (bloqué au 4ᵉ), compteur = base + votes réels.
2. Idée / report / avis soumis → lignes créées (avis & idée en `pending`).
3. Report : le user voit uniquement ses tickets ; abonnement changelog toggle persistant.
4. Action sans session → redirection `/auth`.
5. RLS étanche entre utilisateurs ; aucun email envoyé.
6. Tests verts, typecheck + lint clean ; migration déployée local + prod.

## Risques / points d'attention

- **Quota via trigger** : le message d'erreur remonte au client ; le front doit le traiter
  proprement (le garde `remaining === 0` évite l'appel, le trigger est le filet de sécurité).
- **Vue + RLS** : vérifier que `roadmap_vote_counts` est bien lisible publiquement (hérite de
  `roadmap_votes_read using (true)`).
- **`reviews_insert_self`** : le `with check` doit imposer `status='pending'` ET
  `author_user_id = auth.uid()` pour empêcher l'auto-publication.
- **Optimistic vote** : réconcilier en cas d'échec trigger (rollback de l'état optimiste).
- **Dépend du déploiement SP1** : les tables `roadmap_items`/`reviews` doivent exister en prod
  avant d'appliquer SP2.
```
