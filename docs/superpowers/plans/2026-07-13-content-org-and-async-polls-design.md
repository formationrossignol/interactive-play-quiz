# Design — Organisation du contenu (dossiers imbriqués + explorer), migration Supabase, sondages async, correctifs visuels

**Date :** 2026-07-13
**Statut :** Design validé (understanding lock confirmé « ok go »)
**Auteur :** brainstorming Claude + Loic

---

## 1. Understanding Summary

- **Quoi :** 5 chantiers — 2 correctifs visuels puis 3 features structurantes.
- **Pourquoi :** cohérence visuelle (vues cassées) + organisation/partage du contenu à l'échelle.
- **Pour qui :** formateurs gérant beaucoup de contenus ; répondants anonymes via lien (sondages async).
- **Contraintes clés :** migration localStorage → **Supabase** (dossiers + tous contenus), import auto one-time au 1er login. Nesting **profondeur illimitée**, **tous types**. Explorer **par page**, **remplace** la grille de dossiers, navigation au clic.
- **Non-goals :** pas d'explorer unifié cross-types ; pas de collaboration temps réel multi-éditeurs ; pas de garantie offline après migration.

## 2. Ordre d'implémentation (bugs d'abord)

1. **Bug A** — vue carte miroir déformée.
2. **Bug B** — vue examens alignée sur le design commun.
3. **Fondation Supabase** — schéma + RLS + import localStorage auto.
4. **Nesting + Explorer sidebar** — arbre récursif, navigation clic, remplace grille.
5. **Sondages async** — lien/QR public, réponses anonymes agrégées.

## 3. Assumptions

- Échelle individuelle/petite équipe (centaines d'items/user) → perf non-critique.
- RLS Supabase par `user_id` ; sondage async = insert anonyme autorisé seulement sur sondages ouverts (comme le flux anonyme JoinQuiz/JoinExam existant).
- Bugs A/B = correctifs UI purs, livrables **avant** toute migration Supabase.
- Migration import déclenchée une fois, idempotente (flag « migré »), non destructive du localStorage source.
- Répondants sondage async = anonymes (Q1, défaut retenu).
- Cours (CourseBuilder) inclus dans nesting + migration (Q2, « tous types »).

## 4. État actuel (constats code)

- **Contenu 100 % localStorage** : `quizStorage`, `examStorage`, `courseStorage`, `folderStorage`, `pollResults`. `supabase.ts` = client nu ; seul l'auth est sur Supabase (+ worktree WIP `live-quiz-server-scoring` pour le scoring de session). Aucune table de contenu serveur.
- **Dossiers plats** : `Folder { id, name, userId, type: 'quiz'|'poll'|'flashcard', createdAt }` — **pas de `parentId`**, pas de type exam/course. Items portent `folderId` (1 niveau). `moveToFolder` n'agit que sur `quizStorage`.
- **Design liste partagé** : `useCollectionFilters(items: SavedQuiz[])` (recherche/tri/catégorie/pagination) + `MyQuizzes` (shadcn/Tailwind : Tabs my/favorites/public/trash, toggle grille/liste, FolderCard, DnD, Pagination). C'est la **référence design**.
- **MyExams diverge** : styles inline + tokens Arcade Pop, type `Exam`, **aucune** barre recherche/tri/toggle/onglets/dossiers/pagination — simple flex-list.

## 5. Décisions (Decision Log)

| # | Décision | Alternatives | Raison |
|---|----------|--------------|--------|
| D1 | Bugs avant features | features d'abord / plan unique | Gains visibles rapides, correctifs sans dépendance Supabase |
| D2 | Nesting profondeur illimitée, tous types | 2 niveaux / types actuels | Choix user ; `parentId` récursif |
| D3 | Migrer contenu vers Supabase | garder localStorage | Choix user ; sync multi-appareils |
| D4 | Import auto localStorage→Supabase au 1er login | repartir de zéro / double-écriture | Préserve le travail, non destructif |
| D5 | Sondage async = lien public, réponse à tout moment, agrégation continue | fenêtre de dates / les deux | Choix user |
| D6 | Explorer par page, remplace la grille | complète / unifié cross-types | Choix user |
| D7 | Bug A fix = `w-full` sur racine `FlashcardPreview` | refactor panneau | Cause = collapse min-content dans aside `align-items:center` |
| D8 | Bug B = rebâtir MyExams sur le pattern MyQuizzes | patch cosmétique | Alignement réel recherche/tri/grille-liste |

## 6. Design par chantier

### Bug A — Vue carte miroir déformée
**Cause :** `QuizBuilder.tsx:1246` — l'`<aside>` droit est `display:flex; flexDirection:column; alignItems:center`. Le div racine de `FlashcardPreview` (`flex h-full items-center justify-center p-8`, **sans largeur**) rétrécit à sa largeur min-content → bandelette verticale. `SlidePreview` ne collapse pas (sizing intrinsèque différent).
**Fix :** ajouter `w-full` (et hauteur définie/`min-h`) à la racine de `FlashcardPreview` pour qu'elle remplisse la largeur du panneau. Vérifier rendu recto/verso + flip.
**Test :** ouvrir un flashcard dans le builder, panneau miroir affiche une carte lisible pleine largeur, clic = flip.

### Bug B — Vue examens alignée
**Cible :** reproduire le layout `MyQuizzes` pour `MyExams` : barre de recherche, tri, toggle grille/liste, (option onglets), cartes cohérentes shadcn.
**Difficulté :** `useCollectionFilters` est typé `SavedQuiz` (title/description/tags/category/createdAt/questions). `Exam` n'a pas la même forme.
**Approche recommandée :** généraliser `useCollectionFilters` en générique `<T>` avec accesseurs (`getTitle`, `getDate`, `getCategory`, `getSearchText`), ou adapter les exams en un shape compatible côté page. Réutiliser les composants de toolbar de MyQuizzes.
**Test :** MyExams affiche recherche/tri/toggle fonctionnels, design identique aux autres pages.

### Fondation Supabase (chantier 3)
- **Tables** (par user, RLS `auth.uid() = user_id`) : `folders(id, user_id, type, name, parent_id nullable, created_at)`, et tables contenu `quizzes`, `polls`, `flashcard_decks`, `exams`, `courses` (ou une table `content` polymorphe `type` + `data jsonb` — à trancher en D-schema). `folder_id nullable` sur le contenu.
- **Sondage async** : `poll_responses(id, poll_id, answers jsonb, created_at)` avec RLS insert anonyme si `poll.is_open`.
- **Import migration** : au 1er login, si flag `migrated_v1` absent → lire localStorage, upsert vers Supabase, poser le flag. Idempotent, non destructif.
- **Couche d'accès** : remplacer les fonctions `*Storage.ts` par des équivalents Supabase (async), en gardant la même signature autant que possible pour limiter le blast-radius UI.

### Nesting + Explorer sidebar (chantier 4)
- **Data :** `folders.parent_id` → arbre récursif. Helpers : `getTree(userId, type)`, `getBreadcrumb(folderId)`, garde anti-cycle sur move.
- **UI :** sidebar gauche par page = arbre pliable ; clic dossier = navigue (met `currentFolderId`), fil d'ariane en haut de la liste. **Remplace** la grille FolderCard. Le contenu du dossier courant s'affiche à droite (grille/liste existante).
- **Move :** DnD item→dossier et dossier→dossier (avec garde cycle).

### Sondages async (chantier 5)
- **Lancement :** bouton « Mode asynchrone » sur un sondage → crée un lien/QR public permanent, `is_open = true`.
- **Réponse :** page publique (comme JoinQuiz) sans compte, insert dans `poll_responses`.
- **Résultats :** `PollResults` lit l'agrégat en continu (poll/refetch ou realtime Supabase).
- **Fermeture :** toggle `is_open` (D5 = lien permanent ; fermeture manuelle possible en bonus).

## 7. Risques & open questions

- **R1 — Migration destructive :** import mal testé = doublons/pertes. Mitigation : idempotence + flag + garder localStorage.
- **R2 — Refactor storage async :** passer sync→async casse potentiellement beaucoup d'appelants UI. Mitigation : phaser par type de contenu, tests.
- **R3 — RLS anonyme sondage :** ouvrir l'insert public sans abus (rate limit / captcha hors scope v1).
- **Q schema :** tables par type vs table `content` polymorphe — à trancher au début du chantier 3.

## 8. Prochaine étape

Handoff implémentation, **bugs d'abord** (A puis B), livrables indépendants de Supabase. Puis plan détaillé séparé pour les chantiers 3→5 (gros, à écrire avec le skill writing-plans).
