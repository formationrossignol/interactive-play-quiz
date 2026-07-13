# Fondation Supabase — Contenus + Dossiers imbriqués (Chantier 3) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrer tout le contenu (quiz/sondage/flashcard/examen/cours) et les dossiers de localStorage vers Supabase, via une table polymorphe `content` + une table `folders` récursive (`parent_id`), avec RLS par utilisateur et import automatique one-time des données localStorage existantes.

**Architecture:** Table polymorphe `content(type, data jsonb, folder_id)` calquée sur le modèle blob actuel. Une couche d'accès async (`contentRepo`, `foldersRepo`) remplace progressivement les `*Storage.ts` synchrones. L'import localStorage→Supabase se déclenche une fois au 1er login (flag idempotent). Chantier fondation dont dépendent le nesting/explorer (4) et les sondages async (5).

**Tech Stack:** Supabase (Postgres + RLS + CLI migrations), `@supabase/supabase-js` v2, React, vitest (mock client), TypeScript.

---

## Prérequis (à faire avant Task 1)

1. **Confirmer `.env.local`** contient `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (déjà présent — l'auth fonctionne).
2. **Récupérer le scaffolding CLI Supabase** : il existe sur la branche `feat/live-quiz-server-scoring` (`supabase/config.toml`, projet lié). Deux options :
   - Travailler sur une branche partant de `feat/live-quiz-server-scoring` (récupère config + migrations scoring), **recommandé** si ce chantier doit cohabiter avec le scoring serveur.
   - Sinon : `supabase init` puis `supabase link --project-ref <ref>` (ref dans `.worktrees/live-quiz-server-scoring/supabase/.temp/linked-project.json`).
3. **Vérifier la CLI** : `supabase --version` (installer via `brew install supabase/tap/supabase` si absent).
4. **⚠️ Contrainte env** : la machine est en pression mémoire sévère (~64 MB libres). Libérer de la RAM avant de lancer `supabase db push`, `npm test`, `vite`. Sinon les commandes thrashent.

**Non couvert par ce plan** (plans suivants séparés) :
- Chantier 4 : UI nesting + explorer sidebar (§ Outline).
- Chantier 5 : sondages async publics (§ Outline).

---

## Décision de schéma (verrouillée)

Table **polymorphe unique** `content` (choix user). `data jsonb` porte le blob actuel de chaque type. `type` discrimine. `folder_id` (null = racine). Dossiers récursifs via `folders.parent_id`.

---

### Task 1 : Migration SQL — tables `folders`, `content`, `poll_responses` + RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_content_and_folders.sql`

**Step 1 : Générer le fichier de migration**

Run: `supabase migration new content_and_folders`
Expected: crée `supabase/migrations/<timestamp>_content_and_folders.sql` vide.

**Step 2 : Écrire le schéma**

```sql
-- folders : arbre récursif par utilisateur et par type
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course')),
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index folders_user_type_idx on public.folders(user_id, type);
create index folders_parent_idx on public.folders(parent_id);

-- content : blob polymorphe
create table public.content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('quiz','poll','flashcard','exam','course')),
  folder_id uuid references public.folders(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  is_open boolean not null default false,      -- sondages async (chantier 5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_user_type_idx on public.content(user_id, type);
create index content_folder_idx on public.content(folder_id);

-- réponses de sondage async (chantier 5, table créée ici pour la fondation)
create table public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index poll_responses_content_idx on public.poll_responses(content_id);

-- RLS
alter table public.folders enable row level security;
alter table public.content enable row level security;
alter table public.poll_responses enable row level security;

-- folders : propriétaire seul
create policy folders_owner on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- content : propriétaire CRUD ; lecture publique si is_public OU is_open
create policy content_owner on public.content
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy content_public_read on public.content
  for select using (is_public = true or is_open = true);

-- poll_responses : insert anonyme uniquement si le sondage est ouvert ; lecture par le propriétaire du sondage
create policy poll_responses_insert_open on public.poll_responses
  for insert with check (
    exists (select 1 from public.content c
            where c.id = content_id and c.type = 'poll' and c.is_open = true)
  );
create policy poll_responses_owner_read on public.poll_responses
  for select using (
    exists (select 1 from public.content c
            where c.id = content_id and c.user_id = auth.uid())
  );

-- updated_at auto
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger content_touch before update on public.content
  for each row execute function public.touch_updated_at();
```

**Step 3 : Appliquer la migration**

Run: `supabase db push`
Expected: migration appliquée, tables créées. Vérifier dans le dashboard Supabase (Table editor) que `folders`, `content`, `poll_responses` existent avec RLS activé.

**Step 4 : Smoke test RLS (SQL editor Supabase, en tant qu'utilisateur authentifié)**

Insérer une ligne `content` avec un `user_id` ≠ `auth.uid()` doit échouer ; avec le sien doit réussir. Documenter le résultat.

**Step 5 : Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): content + folders + poll_responses tables with RLS"
```

---

### Task 2 : Types partagés + client typé

**Files:**
- Create: `src/lib/content/types.ts`
- Test: `src/lib/content/__tests__/types.test.ts`

**Step 1 : Écrire le test (forme des types)**

```ts
import { describe, it, expect } from 'vitest';
import { CONTENT_TYPES, isContentType } from '../types';

describe('content types', () => {
  it('reconnaît les 5 types', () => {
    expect(CONTENT_TYPES).toEqual(['quiz','poll','flashcard','exam','course']);
  });
  it('isContentType rejette un type inconnu', () => {
    expect(isContentType('quiz')).toBe(true);
    expect(isContentType('foo')).toBe(false);
  });
});
```

**Step 2 : Run test → FAIL**

Run: `npx vitest run src/lib/content/__tests__/types.test.ts`
Expected: FAIL (module introuvable).

**Step 3 : Implémenter**

```ts
export const CONTENT_TYPES = ['quiz','poll','flashcard','exam','course'] as const;
export type ContentType = typeof CONTENT_TYPES[number];
export const isContentType = (v: string): v is ContentType =>
  (CONTENT_TYPES as readonly string[]).includes(v);

export interface ContentRow {
  id: string;
  user_id: string;
  type: ContentType;
  folder_id: string | null;
  data: Record<string, unknown>;
  is_public: boolean;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderRow {
  id: string;
  user_id: string;
  type: ContentType;
  name: string;
  parent_id: string | null;
  created_at: string;
}
```

**Step 4 : Run test → PASS** — `npx vitest run src/lib/content/__tests__/types.test.ts`

**Step 5 : Commit** — `git commit -am "feat: content type definitions"`

---

### Task 3 : `foldersRepo` — CRUD async + helpers d'arbre (parent_id)

**Files:**
- Create: `src/lib/content/foldersRepo.ts`
- Test: `src/lib/content/__tests__/foldersRepo.test.ts`

**Step 1 : Test des helpers d'arbre (pur, sans réseau)**

Tester `buildTree(folders)` (liste plate → arbre), `getDescendantIds(tree, id)`, `wouldCreateCycle(folders, id, newParentId)`.

```ts
import { describe, it, expect } from 'vitest';
import { buildTree, wouldCreateCycle } from '../foldersRepo';

const flat = [
  { id:'a', parent_id:null, name:'A' },
  { id:'b', parent_id:'a', name:'B' },
  { id:'c', parent_id:'b', name:'C' },
] as any;

describe('folder tree', () => {
  it('construit un arbre imbriqué', () => {
    const tree = buildTree(flat);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });
  it('détecte un cycle (déplacer A sous C)', () => {
    expect(wouldCreateCycle(flat, 'a', 'c')).toBe(true);
    expect(wouldCreateCycle(flat, 'c', null)).toBe(false);
  });
});
```

**Step 2 : Run → FAIL.**

**Step 3 : Implémenter** `buildTree`, `getDescendantIds`, `wouldCreateCycle` (fonctions pures) + CRUD async (`listFolders(userId,type)`, `createFolder`, `renameFolder`, `moveFolder` (garde anti-cycle), `deleteFolder` (réassigne enfants+contenu à `parent_id`/racine)). Les CRUD utilisent `supabase.from('folders')`.

**Step 4 : Run → PASS** (helpers). Les CRUD réseau seront couverts par un test avec client mocké (Task 5 pattern).

**Step 5 : Commit** — `feat: foldersRepo with recursive tree helpers`

---

### Task 4 : `contentRepo` — CRUD async polymorphe

**Files:**
- Create: `src/lib/content/contentRepo.ts`
- Test: `src/lib/content/__tests__/contentRepo.test.ts` (client Supabase mocké)

**Pattern de mock** (s'inspirer de `.worktrees/live-quiz-server-scoring/supabase/functions/_shared/scoring.test.ts`).

**API** : `list(userId, type, folderId?)`, `get(id)`, `create(userId, type, data, folderId?)`, `update(id, patch)`, `remove(id)`, `move(id, folderId)`, `setPublic(id, bool)`, `setOpen(id, bool)`.

TDD : test que `create` appelle `.from('content').insert(...)` avec `{ user_id, type, data }` ; que `list` filtre `user_id`+`type`(+`folder_id`). Mock le client, asserte les appels + mappe la réponse en `ContentRow`.

**Commit** — `feat: contentRepo async CRUD (polymorphic)`

---

### Task 5 : Import localStorage → Supabase (one-time, idempotent)

**Files:**
- Create: `src/lib/content/migrateLocalToSupabase.ts`
- Test: `src/lib/content/__tests__/migrate.test.ts`

**Flag idempotent** : ligne `content` non utilisée — préférer une colonne/flag serveur. Simple : table `user_meta(user_id pk, migrated_v1 bool)` OU champ dans le profil existant. **Décider** : ajouter une mini-migration `user_meta` (recommandé, découplé).

**Logique** : `migrateIfNeeded(userId)` →
1. Si `user_meta.migrated_v1` true → return (idempotent).
2. Lire localStorage : quizzes (`quizStorage`), polls, flashcards, exams (`examStorage`), courses (`courseStorage`), folders (`folderStorage`).
3. Mapper folders (plats) → insert dans `folders` (parent_id null), garder map oldId→newId.
4. Mapper chaque item → `content` avec `folder_id` remappé, `data` = blob, `is_public` depuis l'item.
5. Poser `migrated_v1 = true`.
6. **Non destructif** : ne pas effacer le localStorage.

**Tests** (données localStorage simulées + client mocké) :
- 2e appel = no-op quand flag posé.
- folders + items insérés avec bon remapping `folder_id`.
- item public → `is_public=true`.

**Commit** — `feat: one-time localStorage→Supabase import`

---

### Task 6 : Cutover d'une page pilote (MyQuizzes) vers le repo

**Files:**
- Modify: `src/pages/MyQuizzes.tsx`
- Modify: `src/App.tsx` (déclencher `migrateIfNeeded` post-login)

**But** : prouver la couche de bout en bout sur UNE page avant de migrer les autres. Remplacer les appels `getUserQuizzes`/`getFolders`/`moveToFolder` par `contentRepo`/`foldersRepo` (async → `useEffect` + état). Garder l'UI identique.

**Vérif (runtime, skill verify)** : login → MyQuizzes charge depuis Supabase, créer/renommer un dossier, déplacer un quiz → persiste après reload et sur un autre appareil.

**Commit** — `feat: MyQuizzes reads/writes via Supabase repo`

---

### Cutover restant (tâches répétées, un commit par page)

Répéter le pattern Task 6 pour : `MyPolls`, `MyFlashcards`, `MyExams`, `MyCourses`, et les builders (`QuizBuilder` save/load, `ExamBuilder`, `CourseBuilder`). Chaque page = une tâche TDD-légère + vérif runtime + commit. Retirer les `*Storage.ts` seulement quand plus aucun appelant (grep de vérif).

---

## Outline — Chantier 4 (nesting UI + explorer sidebar) [plan séparé]

- Sidebar arbre par page (`buildTree`), pliage, clic = navigation (`currentFolderId`), fil d'ariane.
- Remplace la grille `FolderCard`.
- DnD item→dossier et dossier→dossier avec `wouldCreateCycle`.
- Composant réutilisable `FolderExplorer` partagé entre les 5 pages.

## Outline — Chantier 5 (sondages async) [plan séparé]

- Bouton « Mode asynchrone » → `setOpen(pollId, true)` + lien/QR public permanent.
- Page publique de réponse (façon `JoinQuiz`, sans compte) → `poll_responses.insert` (RLS ouvert).
- `PollResults` : agrégation continue (poll/refetch ou Supabase realtime).
- Fermeture manuelle : `setOpen(false)`.

---

## Risques

- **R1 Migration destructive** → idempotence + flag `user_meta` + localStorage conservé.
- **R2 Blast radius sync→async** → cutover page par page (Task 6+), pas de big-bang.
- **R3 RLS anonyme sondage** → policy `poll_responses_insert_open` limitée aux `type='poll' and is_open`. Rate-limit/anti-abus = hors scope v1.
- **R4 Mémoire machine** → libérer RAM avant `db push`/`vitest`/`vite`.
```
