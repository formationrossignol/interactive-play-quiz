# Implémentation — Import H5P

## Architecture

```text
Fichier .h5p
    │ validation + décompression (JSZip)
    ▼
Supabase Storage / h5p-packages
    │ /h5p-content/* en production
    ▼
H5pPlayer dans la leçon
    ├── événements xAPI ──► score / statut / progression
    ├── getCurrentState ──► reprise
    └── temps actif ──────► durée de secours
                               │
                               ▼
                 localStorage + public.h5p_tracking
```

## Modèle de leçon

Le type `Lesson` accepte désormais `type: "h5p"` et conserve :

- `h5pPackageId` ;
- `h5pOwnerId` ;
- `h5pTitle` ;
- `h5pMainLibrary` ;
- `h5pOriginalName` ;
- `h5pImportedAt`.

`h5pOwnerId` est distinct du propriétaire du cours afin qu’un collaborateur
puisse importer un paquet dans un cours partagé.

## Parcours auteur

1. Ajouter ou ouvrir une leçon.
2. Choisir « Activité H5P ».
3. Sélectionner un `.h5p`.
4. Suivre l’avancement de l’envoi.
5. Contrôler la prévisualisation.
6. Enregistrer le cours pour publier la référence du paquet dans la leçon.

Retirer un paquet de la leçon ne supprime pas immédiatement les ressources du
bucket. Cette décision évite de casser une autre version ou duplication du
cours qui référencerait encore le même paquet.

## Parcours apprenant

Le lecteur recharge le dernier état disponible. La barre de suivi affiche :

- le statut ;
- la progression ;
- le score ;
- le temps passé.

Une activité `passed` ou `completed` marque automatiquement la leçon comme
terminée. Une activité `failed` reste distincte et ne valide pas la leçon.

## Base de données et sécurité

La migration `20260729100000_h5p_support.sql` crée :

- le bucket `h5p-packages` ;
- les politiques d’écriture limitées au dossier de l’utilisateur ;
- la lecture publique des ressources nécessaires au lecteur ;
- `h5p_tracking` avec unicité apprenant/cours/leçon ;
- les politiques RLS permettant à l’apprenant de gérer son propre suivi et au
  propriétaire du cours de lire les résultats.

## Fichiers principaux

- `apps/app/src/lib/h5pImport.ts` — validation, extraction et envoi ;
- `apps/app/src/lib/h5pTracking.ts` — normalisation xAPI et persistance ;
- `apps/app/src/components/h5p/H5pPlayer.tsx` — lecteur, autosauvegarde et UI ;
- `apps/app/src/pages/CourseBuilder.tsx` — import et prévisualisation ;
- `apps/app/src/pages/CourseViewer.tsx` — lecture et validation de la leçon.

## Vérification

```bash
npm test -w app -- --run \
  src/lib/__tests__/h5pImport.test.ts \
  src/lib/__tests__/h5pTracking.test.ts \
  src/lib/__tests__/courseStorage.test.ts
npm run typecheck -w app
npm run build -w app
```
