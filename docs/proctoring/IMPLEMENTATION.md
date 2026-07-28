# Plan d’implémentation — proctoring

## Phase 1 — Modèle et configuration

- [x] Ajouter les quatre niveaux de surveillance.
- [x] Ajouter une configuration typée et des valeurs par défaut rétrocompatibles.
- [x] Ajouter la rubrique « Surveillance » au créateur d’examen.
- [x] Stocker les clés SEB séparément des données publiques.

## Phase 2 — Contrôle préalable candidat

- [x] Afficher l’information préalable et la durée de conservation.
- [x] Vérifier SEB, sa version et ses clés côté serveur.
- [x] Demander le plein écran.
- [x] Tester la caméra et afficher un aperçu.
- [x] Tester le microphone.
- [x] Demander le partage d’écran lorsque les captures sont actives.
- [x] Refuser le démarrage si un contrôle obligatoire échoue.

## Phase 3 — Surveillance active

- [x] Journaliser onglet, focus, plein écran, redimensionnement et réseau.
- [x] Bloquer copier/coller, clic droit et raccourcis configurés aux niveaux standard et renforcé.
- [x] Détecter l’arrêt des flux caméra, micro et écran.
- [x] Gérer les captures manuelles, périodiques et sur événement.
- [x] Appliquer les seuils et l’arrêt automatique optionnel.
- [x] Présenter l’état actif au candidat.

## Phase 4 — Données, rapports et validation

- [x] Créer les tables d’événements, alertes, captures, rapports et accès.
- [x] Calculer un rapport indicatif par tentative.
- [x] Ajouter le tableau de bord enseignant.
- [x] Permettre une décision conforme / à vérifier / non conforme.
- [x] Tracer la consultation et la validation.
- [x] Générer des URL signées courtes pour les médias.

## Phase 5 — Conservation et exploitation

- [x] Affecter une date d’expiration à chaque donnée.
- [x] Ajouter une purge physique des objets Storage et des métadonnées.
- [x] Documenter l’API et le déploiement.
- [x] Ajouter les tests de rétrocompatibilité et des presets.

## Validation

- `npm run typecheck --workspace=app`
- `npm run test --workspace=app`
- `npm run lint --workspace=app`
- `npm run build --workspace=app`
- `deno check supabase/functions/proctoring-api/index.ts supabase/functions/save-exam/index.ts`
