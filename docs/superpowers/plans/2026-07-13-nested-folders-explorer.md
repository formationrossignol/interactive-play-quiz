# Dossiers imbriqués + Explorer sidebar (Chantier 4) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development to implement this plan task-by-task.

**Goal:** Remplacer la grille de dossiers plate par un explorer sidebar récursif (arbre pliable, navigation au clic, DnD, profondeur illimitée) alimenté par Supabase, sur les pages Mes Quiz / Sondages / Flashcards / Examens / Cours.

**Architecture:** Un composant réutilisable `FolderExplorer` rend l'arbre issu de `foldersRepo.buildTree`. Chaque page charge son contenu via `contentRepo.listContent(userId, type)` et ses dossiers via `foldersRepo.listFolders`, filtre localement favoris/corbeille depuis le blob `data`, et gère navigation/CRUD/déplacement. Pilote sur Mes Quiz, puis généralisation.

**Tech Stack:** React, TypeScript, `@dnd-kit`, Supabase repos (`foldersRepo`, `contentRepo`), Arcade Pop tokens, vitest (CI).

---

## Prérequis / dépendances (déjà faites)
- `foldersRepo` : `buildTree`, `getDescendantIds`, `wouldCreateCycle`, `listFolders`, `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`. ✅
- `contentRepo` : `listContent`, `getContent`, `createContent`, `updateContent`, `removeContent`, `moveContent`, `setPublic`, `setOpen`. ✅
- Import localStorage→Supabase au login (`content_migrated_v1`). ✅ **Vérifier qu'il a peuplé `content`/`folders` avant de commencer** (sinon explorer vide).

## Contraintes de scope (décisions)
- **D-A** : favoris (`data.isFavorite`), corbeille (`data.deletedAt`), note (`data.rating`), tags/catégorie/titre/description restent DANS `data` jsonb. Les pages filtrent/trient côté client après `listContent` (échelle faible → OK). Pas de nouvelles colonnes.
- **D-B** : `is_public` est une colonne (déjà) → utiliser `setPublic`. Le reste passe par `updateContent(id, { data })` (read-modify-write du blob).
- **D-C** : l'onglet « public » / ratings inter-utilisateurs est HORS scope de ce chantier (nécessite lecture cross-user ; garder l'existant ou masquer temporairement). Se concentrer sur « mes » contenus + dossiers.

---

### Task 1 : Adapter le hook de filtres au contenu Supabase

**Files:** Create `src/lib/content/contentView.ts` ; Test `src/lib/content/__tests__/contentView.test.ts`

Fonctions PURES (node-testables) mappant un `ContentRow` vers les champs d'affichage tirés de `data`, et filtrant :
- `toDisplay(row: ContentRow): { id; title; description; tags; category; isFavorite; isPublic; deletedAt; rating; createdAt; updatedAt; folderId; type; data }` — lit `row.data` pour titre/description/tags/etc., `row.is_public`/`row.folder_id`/timestamps depuis les colonnes.
- `filterActive(items)` = pas de `deletedAt`. `filterTrashed(items)` = a `deletedAt`. `filterFavorites(items)`.
- `applySearchSort(items, {search, category, sort})` — même logique que `useCollectionFilters` mais sur la forme `toDisplay`.

**Verify:** node throwaway sur `toDisplay`/filtres/tri (vitest hang local → CI). Commit `feat: content view mapping + filters`.

---

### Task 2 : Composant `FolderExplorer`

**Files:** Create `src/components/FolderExplorer.tsx` ; Test `src/components/__tests__/FolderExplorer.test.tsx`

Props :
```ts
interface FolderExplorerProps {
  tree: FolderNode[];                 // foldersRepo.buildTree(folders)
  currentFolderId: string | null;     // null = racine
  counts: Record<string, number>;     // folderId -> nb items directs (optionnel)
  onNavigate: (folderId: string | null) => void;
  onCreate: (parentId: string | null, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder: (id: string, newParentId: string | null) => void;   // garde cycle côté page
}
```
Comportement :
- Item racine « Tous » (folderId null) toujours en haut.
- Chaque nœud : chevron pliable (état d'expansion local, persisté par page dans localStorage `explorer-expanded-<type>`), icône dossier, nom, count optionnel. Indentation par profondeur.
- Clic sur le nom = `onNavigate(id)` ; surbrillance si `currentFolderId === id`.
- Bouton « + Nouveau dossier » (au niveau courant) ; menu contextuel (renommer/supprimer) via `ItemContextMenu` ou un petit menu.
- **DnD** : chaque nœud est une drop-zone (`@dnd-kit` `useDroppable`) acceptant un item de contenu OU un autre dossier ; le drag d'un dossier utilise `useDraggable`. Le drop appelle `onMoveFolder`/(le move de contenu est géré par la page).
- Style : tokens Arcade Pop (`--ap-*`), cohérent avec la sidebar existante.

**Verify:** rendu + interactions dans l'app (Task 5). Unit test du rendu d'arbre (structure/indent) si vitest CI. Commit `feat: FolderExplorer recursive sidebar component`.

---

### Task 3 : Hook page `useContentCollection(type)`

**Files:** Create `src/hooks/useContentCollection.ts`

Encapsule pour une page : chargement async (folders + content depuis les repos), état (`items`, `folders`, `tree`, `currentFolderId`, loading), et actions (`createFolder`, `renameFolder`, `deleteFolder`, `moveFolder` avec garde `wouldCreateCycle`, `moveContent`, `toggleFavorite` via updateContent, `trash` via updateContent set `data.deletedAt`, `remove`). Recharge après mutation. Filtres via `contentView`.

**Verify:** consommé par la page pilote (Task 4). Commit `feat: useContentCollection hook`.

---

### Task 4 : Cutover pilote — Mes Quiz

**Files:** Modify `src/pages/MyQuizzes.tsx`

- Remplacer `getUserQuizzes`/`getFolders`/`moveToFolder`/`createFolder`… (localStorage) par `useContentCollection('quiz')`.
- Remplacer la grille `FolderCard` par `<FolderExplorer>` dans une sidebar gauche ; le contenu du dossier courant s'affiche à droite (garder les cartes/rows existants, alimentés par `toDisplay`).
- Fil d'ariane en haut de la liste (chemin via `foldersRepo` parent chain).
- Garder recherche/tri/toggle grille-liste (via `contentView.applySearchSort`).
- Favoris/corbeille : filtrés depuis `data`.

**Verify (RUNTIME, skill verify) :** login → Mes Quiz charge depuis Supabase ; créer dossier + sous-dossier ; naviguer au clic ; glisser un quiz dans un dossier ; renommer/supprimer ; reload → persiste ; vérifier sur un 2e appareil/onglet. Commit `feat: MyQuizzes uses Supabase repos + FolderExplorer`.

---

### Task 5 : Généralisation (une tâche + commit par page)

Répéter Task 4 pour `MyPolls('poll')`, `MyFlashcards('flashcard')`, `MyExams('exam')`, `MyCourses('course')`. Examens/cours gagnent les dossiers pour la première fois. Chaque page : vérif runtime + commit.

---

### Task 6 : Nettoyage

- Retirer les usages morts de `folderStorage.ts` / getters localStorage une fois toutes les pages migrées (grep de vérif : plus aucun import).
- Garder les fonctions localStorage tant qu'un appelant subsiste. Commit `chore: drop localStorage folder/content usage after cutover`.

---

## Risques
- **R1** : `updateContent(id,{data})` = read-modify-write non atomique (toggles concurrents rares) → acceptable échelle faible.
- **R2** : DnD dossier→dossier doit refuser les cycles (page appelle `wouldCreateCycle` avant `moveFolder`, qui re-checke aussi).
- **R3** : import non vérifié = explorer vide ; **valider l'import d'abord**.
- **R4** : onglet public/ratings hors scope — ne pas casser l'existant (masquer ou laisser lire localStorage en lecture seule si nécessaire).
- **R5** : perf — `listContent` ramène tout le type puis filtre client ; OK à l'échelle visée, à indexer/paginer plus tard si besoin.
