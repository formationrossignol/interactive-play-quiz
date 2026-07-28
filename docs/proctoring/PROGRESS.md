# Progression — proctoring

## Statut

Implémentation applicative terminée, en attente du déploiement de la migration et des Edge Functions sur l’environnement Supabase cible.

## Livré

- configuration par examen et quatre niveaux ;
- vérification SEB serveur sans exposition des clés ;
- contrôle préalable candidat ;
- surveillance navigateur et périphériques ;
- captures privées horodatées ;
- journal, alertes et rapport par tentative ;
- validation enseignant modifiable ;
- rétention et purge ;
- API serveur unique ;
- tests et build validés.

## Décisions d’architecture

- Le proctoring est désactivé par défaut, y compris pour les examens existants.
- Les participants anonymes n’écrivent jamais directement dans les tables ou le bucket.
- Les médias sont privés et servis par URL signée de cinq minutes.
- Une alerte automatique ne produit jamais directement « non conforme » ; ce statut est réservé à l’enseignant.
- La purge reçoit un secret dédié et doit être appelée par un ordonnanceur.

## Mise en production

1. Appliquer `20260728170000_exam_proctoring.sql`.
2. Déployer `save-exam` et `proctoring-api`.
3. Définir `PROCTORING_CLEANUP_SECRET`.
4. Planifier un appel quotidien à `proctoring-api` avec :

   ```json
   { "action": "purge-expired" }
   ```

   et l’en-tête `X-Proctoring-Cleanup-Secret`.

5. Vérifier les en-têtes Permissions Policy (`camera`, `microphone`, `display-capture`) et HTTPS.
6. Tester une configuration SEB réelle sur Windows et macOS.
7. Faire valider les textes d’information et durées de conservation par l’organisation.

## API

Point d’entrée : `POST /functions/v1/proctoring-api`.

Actions :

- `verify-environment` : vérifie SEB, la version et les hashes ;
- `record-event` : ajoute un événement et crée une alerte si nécessaire ;
- `upload-capture` : stocke une capture privée et ses métadonnées ;
- `get-overview` : renvoie journal, alertes, captures signées et rapport au propriétaire ;
- `review-report` : enregistre la décision de l’enseignant ;
- `purge-expired` : supprime les fichiers et données arrivés à expiration.
