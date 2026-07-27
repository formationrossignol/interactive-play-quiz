# interactive-play-quiz — Consignes globales

Monorepo Turborepo : `apps/app` (Vite/React, l'application), `apps/marketing` (Next.js, site marketing), `packages/ui` (styles/tokens partagés).

## États de chargement (skeleton loading)

Toute interface qui affiche un état de chargement — page, contenu, liste, tableau, profil — DOIT utiliser le système de skeleton loading. Pas de texte "Chargement…"/"Loading…", pas de spinner de page.

- **Primitif** : `apps/app/src/components/ui/skeleton.tsx` (`Skeleton`). Le shimmer vient de la classe `.ap-skeleton-shimmer`, définie une fois dans `packages/ui/components.css` et partagée par tous les thèmes de site.
- **Templates composites** : `apps/app/src/components/ui/skeletons/` — `PageSkeleton` (fallback de page/route), `CardSkeleton` (carte média + titre), `ListSkeleton` (lignes avatar/icône + texte), `TableSkeleton` (grille de lignes/colonnes), `ProfileSkeleton` (avatar + bio). Utiliser un template existant avant de recomposer un skeleton à la main ; si la forme ne correspond pas exactement, étendre le template (nouvelle prop) plutôt que dupliquer sa structure ailleurs.
- **Boutons en cours d'action** : utiliser la prop `loading` de `Button` (`apps/app/src/components/ui/button.tsx`), ou `ButtonShimmerLabel` (exporté depuis `components/ui/skeleton.tsx`) pour les boutons bruts en classes `.ap-btn`. Jamais de `LoaderCircle`/`animate-spin` isolé comme seul retour visuel d'un bouton.
- **Exception admise** : un spinner reste acceptable pour une action déjà accompagnée d'un vrai indicateur de progression (barre déterminée/indéterminée) — pas comme substitut au skeleton/shimmer.

Avant d'ajouter un nouvel état de chargement dans le code, vérifier d'abord si un template dans `components/ui/skeletons/` correspond au layout visé.
