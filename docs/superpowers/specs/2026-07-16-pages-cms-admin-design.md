# Backend pages CMS — SP3 : UI admin `/admin`

**Date** : 2026-07-16
**Statut** : design validé
**Périmètre** : sous-projet 3 sur 3 du backend des pages. Termine le programme.
**Dépend de** : SP1 (tables contenu, `is_admin()`, RLS write admin) + SP2 (reviews/ideas/reports + policies admin). Voir specs `pages-cms-foundation` et `pages-cms-interactions`.

## Contexte

SP1 sert le contenu, SP2 collecte les écritures visiteur (dont des soumissions `pending`
invisibles au public). SP3 fournit l'**interface d'administration in-app** pour éditer le contenu
et modérer les soumissions — sans SQL.

**La RLS supporte déjà l'admin** : `*_read using (status='published' OR is_admin())` et
`*_write using (is_admin())` (SP1) ; policies admin sur `reviews`/`roadmap_ideas`/`reports` (SP2).
Donc **SP3 est quasi 100% front** : une couche repo/hooks admin + une page `/admin` à onglets.

Décisions validées :
- Périmètre **complet** en un lot : CRUD roadmap/changelog/guides/FAQ + modération
  reviews/idées/reports + abonnés.
- UI = **une page `/admin` à onglets** (Contenu · Modération · Abonnés).
- Onglet Abonnés : **count + dates seulement** (pas d'email — `auth.users` non lisible client,
  aucun SQL ajouté).
- Éditeur riche **TipTap** (composant existant `RichTextEditor`) pour `guides.body` **et**
  `changelog_releases.intro` → l'intro devient du HTML, rendu sanitizé côté public.

## Objectifs SP3

1. Gate admin client : `useIsAdmin()`, redirection des non-admins, lien conditionnel.
2. Couche `adminRepo` + hooks : lectures incluant draft/pending, mutations CRUD + statut.
3. Page `/admin` à onglets avec les 3 sections.
4. Rendre `changelog.intro` en HTML sanitizé sur la page publique (conséquence du choix TipTap).

**Hors périmètre** : gestion des rôles admin via UI (reste SQL) ; emails abonnés ; envoi d'emails ;
rendu public d'un article de guide (`guides.body` éditable mais pas de page article publique).

## Architecture

### 1. Gate admin

```typescript
// src/lib/pages/useIsAdmin.ts
export function useIsAdmin() {
  // React Query: select role from profiles where id = current user (RLS: own row).
  // returns { isAdmin: boolean, isLoading: boolean }
}
```

- Repo `fetchMyRole(): Promise<'user'|'admin'|null>` : `select role from profiles eq id = uid`.
- Page `Admin.tsx` : `isLoading` → spinner ; `!isAdmin` → `<Navigate to="/" replace />`.
- `Header` : lien « Admin » affiché seulement si `useIsAdmin().isAdmin`.

### 2. Route

```tsx
<Route path="/admin" element={<Admin />} />   // lazy, dans src/App.tsx
```

Fichiers `src/pages/admin/` :
- `Admin.tsx` — gate + `<Tabs>` (Contenu / Modération / Abonnés).
- `ContentTab.tsx` — sous-sélecteur de ressource + tables + formulaires.
- `ModerationTab.tsx` — 3 files (reviews, idées, reports).
- `SubscribersTab.tsx` — count + table.
- Petits éditeurs par ressource (voir §4) dans des sous-fichiers pour garder chaque fichier focalisé.

### 3. Couche data admin — `src/lib/pages/adminRepo.ts` + `adminHooks.ts`

Lectures admin (incluent draft/pending grâce à `is_admin()` dans la RLS) et mutations. Toutes les
mutations invalident **et** la clé publique correspondante (`['pages','roadmap']`, etc.) **et** la
clé admin, pour que public + admin reflètent le changement.

Contenu (par ressource `roadmap_items`, `changelog_releases`, `changelog_items`, `guides`,
`faq_items`) :
- `adminList<Res>()` — tous les rows (tous statuts), triés par `sort`.
- `create<Res>(input)`, `update<Res>(id, patch)`, `remove<Res>(id)`.
- `setStatus<Res>(id, 'draft'|'published')`.
- Réordonnancement : `update` du champ `sort`.
- Changelog : `adminListReleases()` + `adminListItems(releaseId)` ; CRUD items enfants.

Modération :
- `adminListReviews(status?)`, `setReviewStatus(id, 'published'|'rejected')`.
- `adminListIdeas(status?)`, `setIdeaStatus(id, 'converted'|'rejected')`,
  `convertIdeaToRoadmap(id, {col, category, title, subtitle})` → insert `roadmap_items` (draft) +
  passe l'idée en `converted`.
- `adminListReports(status?)`, `setReportStatus(id, ReportStatus)`.

Abonnés :
- `adminListSubscribers()` → `{ user_id, created_at }[]` + `count`.

Hooks React Query : un `useAdmin<Res>()` (query + mutations) par ressource, `useModerationX()`,
`useSubscribers()`.

### 4. UI par onglet

**Contenu** (`ContentTab`) :
- `<Select>` de ressource : Roadmap · Changelog · Guides · FAQ.
- `<Table>` des rows : colonnes clés + `<Badge>` de statut (draft/published), actions
  Éditer / Publier↔Dépublier / Supprimer (`<AlertDialog>` de confirmation). Bouton « Nouveau ».
- Édition en `<Dialog>` :
  - Roadmap : `col` (Select), `category` (Select), `title`, `subtitle`, `tags` (éditeur simple
    label+eta), `beta`/`locked` (`<Switch>`), `base_votes`, `shipped_label`/`shipped_link`.
  - Changelog : release (`version`, `title`, `date_label`, `media`, **intro via
    `RichTextEditor`**) + gestion des items enfants (kind Select, text, from_votes Switch, sort).
  - Guides : `emoji`, `cover_token` (Select des tokens `--ap-*`), `duration_label`, `title`,
    `level`/`format` (Select), `url`, **`body` via `RichTextEditor`**.
  - FAQ : `category`, `question`, `answer` (Textarea).

**Modération** (`ModerationTab`) :
- Reviews `pending` : carte (persona, ★, texte, auteur) → **Publier** / **Rejeter**.
- Idées `pending` : texte + auteur → **Convertir** (Dialog pré-rempli créant une carte roadmap
  draft) / **Rejeter**.
- Reports : table (type, gravité, titre, statut) → `<Select>` de statut
  (open/in_progress/waiting/resolved).

**Abonnés** (`SubscribersTab`) :
- Grand compteur + `<Table>` (`user_id` tronqué, date d'abonnement). Pas d'email.

### 5. Conséquence publique : intro changelog en HTML

- `changelog_releases.intro` passe de texte brut à HTML (TipTap). La page publique
  `src/pages/Changelog.tsx` doit rendre l'intro via `dangerouslySetInnerHTML` avec
  `sanitizeHtml(r.intro)` (util existant `src/lib/sanitizeHtml.ts`) au lieu de `<p>{r.intro}</p>`.
- Le seed SP1 stocke du texte brut : il reste valide (le texte brut est du HTML inerte, rendu tel
  quel après sanitize).

### 6. Réutilisation

- shadcn existants : `Dialog`, `AlertDialog`, `Tabs`, `Table`, `Select`, `Switch`, `Textarea`,
  `Badge`, `Button`, `Input` (`src/components/ui`).
- `RichTextEditor` (`src/components/RichTextEditor.tsx`, props `{ value, onChange, placeholder? }`).
- `sanitizeHtml` (`src/lib/sanitizeHtml.ts`).
- Aucune nouvelle table ; aucune migration (RLS admin déjà en place).

## Découpage / unités testables

- **`useIsAdmin` / gate** : non-admin redirigé, admin voit la page (testable via mock du repo).
- **adminRepo** : fonctions pures là où possible ; les mutations sont mockables.
- **`convertIdeaToRoadmap`** : crée bien une carte draft + passe l'idée `converted` (logique
  testable en isolant l'insert/update).
- **Rendu intro sanitizée** : `sanitizeHtml` déjà testé ; vérifier l'intégration.
- Chaque onglet est un composant isolé, testable indépendamment.

## Critères de succès SP3

1. Un non-admin sur `/admin` est redirigé ; un admin voit les 3 onglets.
2. CRUD complet fonctionne sur roadmap/changelog/guides/FAQ ; publier/dépublier reflété en public.
3. Modération : publier un avis le rend visible sur `/reviews` ; convertir une idée crée une carte
   roadmap draft ; changer le statut d'un report se voit côté user.
4. Abonnés : compteur + liste corrects.
5. Intro changelog éditée en riche s'affiche correctement (sanitizée) en public.
6. Tests verts, typecheck + lint clean. (Aucun déploiement DB — RLS déjà en prod.)

## Risques / points d'attention

- **Volume UI** : découper en composants focalisés (un fichier par onglet + sous-éditeurs) pour
  rester maintenable.
- **Invalidation croisée** : chaque mutation admin doit invalider la clé publique concernée, sinon
  l'admin voit le changement mais pas les pages publiques (jusqu'au prochain refetch).
- **Sécurité** : le gate client est cosmétique — la vraie barrière est la RLS `is_admin()`. Ne
  jamais supposer que masquer l'UI suffit ; toute mutation passe par la RLS de toute façon.
- **HTML intro** : toujours passer par `sanitizeHtml` au rendu public (anti-XSS), l'admin étant la
  seule source d'écriture mais la défense en profondeur reste requise.
- **`convertIdeaToRoadmap`** : les deux écritures (insert carte + update idée) devraient idéalement
  être atomiques ; en l'absence de RPC, faire l'update seulement après l'insert réussi et invalider.
