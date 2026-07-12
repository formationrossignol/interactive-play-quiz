# Spec — Notation serveur pour le quiz live

**Date** : 2026-07-12
**Sous-projet** : 1/4 du chantier backend issu de l'audit (`AUDIT_CODE.md`). Corrige C-1 (notation calculée et validée uniquement côté client) et H-6 (réponses correctes livrées au client dans `quiz_data` avant la fin).

## Contexte

- Aujourd'hui, toute la logique de quiz/sondage/cours/examen vit en `localStorage` ; seule l'infra live (`session_state` table Supabase + Realtime) existe côté serveur, pour synchroniser host/joueurs.
- Aucun schéma Supabase n'est versionné dans le repo — `session_state` et les RPCs (`upsert_session_player`, `remove_session_player`) existent uniquement côté dashboard Supabase, hors du code source.
- Le host écrit le quiz complet (questions + corrigés) dans `session_state.quiz_data`. Le joueur lit cette colonne intégralement, calcule sa propre correction en JS (`PlayerView.tsx:447-478`), et écrit son score via la RPC `upsert_session_player` — sans validation serveur. Un joueur peut lire le corrigé dans les DevTools avant de répondre, ou poster un score arbitraire en appelant directement la RPC.
- Ce spec traite uniquement la notation du **quiz/sondage live** (host + joueurs synchrones sur la même partie). Les examens à distance (H-1/H-2), la persistance générale du contenu (C-4) et le durcissement RLS des game codes (C-2) sont des sous-projets séparés, hors scope ici.

## Architecture

**Flux actuel** : host écrit `quiz_data` complet (avec corrigés) → joueur lit tout, calcule sa correction en JS, écrit son score directement via RPC.

**Flux cible** :
1. Host démarre une partie → appelle l'Edge Function `create-session`, qui reçoit le quiz complet et écrit, de façon atomique : les données publiques (énoncés/options, zéro corrigé) dans `session_state.quiz_data`, et le quiz complet (avec corrigés) dans la nouvelle table `session_quiz_answers`.
2. Host avance la question → appelle l'Edge Function `advance-question`, qui écrit `question_started_at` (horloge serveur) au moment exact où la question démarre pour tout le monde.
3. Joueur répond → appelle l'Edge Function `submit-answer` avec `{ game_code, player_id, question_index, answer }`, au lieu d'écrire directement son score.
4. `submit-answer` (rôle `service_role`, jamais exposé au client) : lit `session_quiz_answers` pour cette question, calcule correct/faux + points (9 types de questions, y compris `drag-drop`/`hotspot` qui n'avaient jamais eu de logique de correction), calcule le bonus de vitesse à partir de `question_started_at` (horloge serveur, pas une valeur envoyée par le client), fait l'upsert atomique dans `session_state.players`.
5. L'Edge Function renvoie `{ correct, earnedPoints, correctAnswer }` (le corrigé, révélé seulement en réponse à la soumission — jamais avant, comme aujourd'hui). Le client affiche un feedback instantané optimiste (décoratif) dès la soumission ; à la réception de la réponse serveur, l'UI se corrige silencieusement en cas de divergence (log `console.warn`, jamais visible utilisateur) — c'est toujours la valeur serveur qui compte pour le score/leaderboard.
6. Le canal Realtime existant (`subscribeToSessionState`) continue de pousser l'état à tout le monde — inchangé.

**Ce qui ne change pas** : `session_state` reste la table de synchronisation live, le polling/Realtime existant, l'UI du host (`QuizSession.tsx`), la structure `SharedPlayer`.

**Ce qui change** : `PlayerView.tsx` n'écrit plus directement son score — elle appelle `submit-answer`. Le host n'écrit plus `quiz_data`/l'état de jeu en direct avec la clé anon — il appelle `create-session`/`advance-question`.

## Modèle de données

**Nouvelle table `session_quiz_answers`** :

| Colonne | Type | Note |
|---|---|---|
| `game_code` | `text` PK | correspond au `game_code` de `session_state` |
| `questions` | `jsonb` | quiz complet original, avec `correctAnswer`, `correctOrder`, `correctMatches`, `blanks[].correctAnswer`, `correctValue`, `points`, `timeLimit` par question |
| `created_at` | `timestamptz` | |

**RLS sur `session_quiz_answers`** : aucune policy pour `anon`/`authenticated`. Lecture/écriture réservées au rôle `service_role`, utilisé uniquement à l'intérieur des Edge Functions — jamais exposé au client.

**`session_state.quiz_data`** : reste `jsonb`, mais désormais strictement dépouillé de tout champ `correct*`. RLS existante (lecture par `game_code`) inchangée.

**`session_state`** : ajout du champ `question_started_at` (`timestamptz`), écrit uniquement par `advance-question`.

## Edge Functions

### `create-session`
- Reçoit le quiz complet (questions + corrigés) depuis le host authentifié.
- Sépare en public (→ `session_state.quiz_data`) / privé (→ `session_quiz_answers.questions`), écrit les deux dans une transaction (si l'une échoue, aucune ne persiste).
- Remplace l'appel direct actuel du host à `ensureSessionInSupabase`/`resetSessionForNewRun` avec la clé anon.

### `advance-question`
- Écrit `question_started_at = now()` et `current_question_index`/`gameState` dans `session_state`, au moment où le host avance à la question suivante.
- Remplace l'écriture directe actuelle par `patchSessionState`.

### `submit-answer`
**Requête** :
```ts
POST /functions/v1/submit-answer
{
  game_code: string;
  player_id: string;
  question_index: number;
  answer: number | string | null;
}
```

**Traitement** :
1. Lit `session_quiz_answers.questions[question_index]` pour ce `game_code`. Absent → 404.
2. Anti-doublon/anti-rejeu : si ce `player_id` a déjà une réponse enregistrée pour ce `question_index` (`session_state.players[].lastAnswerQuestionIndex`), renvoie le résultat déjà enregistré sans recalculer ni écraser.
3. Calcule `correct` — logique portée fidèlement de `PlayerView.tsx:447-478` pour les 7 types déjà implémentés (`multiple-choice`/`single-choice`, `true-false`, `short-answer`, `slider`, `fill-blank`, `ranking`, `matching`), plus une implémentation neuve pour `drag-drop` et `hotspot` (jamais notés correctement nulle part avant ce spec — leur format de données exact `answer` sera vérifié dans les composants `question-types/` correspondants pendant le plan, avant d'écrire la comparaison).
4. Calcule `earnedPoints` : `elapsed = now() - question_started_at` (côté serveur) ; `earnedPoints = base * max(0, 1 - elapsed/timeLimit)`, borné à 0, jamais négatif. `client_time_left` envoyé par le client n'est plus utilisé pour le calcul (affichage local uniquement).
5. Réponse après expiration du temps (`elapsed > timeLimit`) : toujours acceptée pour la validité de la réponse (bonne/mauvaise comptée). Le calcul actuel garantit déjà un plancher de 10 % des points de base si `correct` (`Math.max(base * ratio, base * 0.1)`, logique existante de `PlayerView.tsx`) — ce plancher s'applique aussi quand `elapsed` dépasse légèrement `timeLimit` à cause de la latence réseau de l'aller-retour serveur (le client a répondu avant son propre minuteur local, le serveur voit juste un peu plus tard). `elapsed` n'est jamais négatif ni ne dépasse jamais ce plancher vers le bas : le ratio de vitesse est clampé à `[0, 1]` avant application du plancher.
6. Upsert atomique dans `session_state.players` (reprend la logique de la RPC `upsert_session_player` existante, appelée en interne avec le rôle `service_role`).
7. Renvoie `{ correct, earnedPoints, correctAnswer }` — le corrigé n'est révélé qu'en réponse à la soumission du joueur (jamais avant), ce qui correspond au comportement actuel de l'écran de reveal (`PlayerView.tsx`, phase "answer-distribution" : affiche le corrigé quand le joueur s'est trompé). Aucune notion de politique par quiz n'existe aujourd'hui dans le code — ce spec ne l'invente pas, il se contente de déplacer côté serveur un affichage qui existe déjà côté client.

## Gestion d'erreurs

- **Edge Function indisponible/timeout** : le client retry une fois (backoff court ~1s), affiche "réponse non confirmée, réessai...", puis retente une dernière fois au changement de `gameState` — ne bloque jamais indéfiniment.
- **Double soumission** (retry réseau ou vraie 2e réponse) : couverte par l'idempotence (étape 2 de `submit-answer`).
- **Host avance la question avant réception de toutes les réponses** : comportement inchangé — les réponses en vol acceptées si elles arrivent pour la question encore en cours, rejetées silencieusement (0 point) si le `question_index` a déjà changé.
- **`session_quiz_answers` absente pour un `game_code`** (session pré-migration, ou host n'a pas utilisé `create-session`) : 404 explicite, message d'erreur générique côté client invitant à recharger. Pas de fallback vers l'ancienne notation client — pas de double logique de scoring en production.

## Tests

- **Unit** (Edge Function) : les 9 types de correction avec cas limites (réponse vide/null, casse/espaces sur `short-answer`, ordre partiel sur `ranking`, blanks incomplets sur `fill-blank`) ; idempotence (2e soumission même question) ; bonus vitesse à `t=0`, `t=timeLimit`, après `timeLimit`.
- **Intégration** : `create-session` atomique (échec partiel = rollback complet) ; `submit-answer` sur session inexistante → 404 propre ; RLS vérifiée par un test qui tente une lecture anon directe sur `session_quiz_answers` et confirme le refus.
- **Non-régression** : `npm test` (suite Vitest existante) inchangée ; comportement `session_state`/Realtime côté host (leaderboard, détection de déconnexion) vérifié manuellement en local après implémentation.

## Rollout

- Pas de rétrocompatibilité à maintenir : les parties live sont éphémères (durée de vie = une partie), aucune ne survit à un déploiement. Pas de feature flag ni de double-run nécessaires.
- Ordre de déploiement : (1) migration SQL (`session_quiz_answers` + RLS + colonne `question_started_at`), (2) déploiement des 3 Edge Functions, (3) déploiement du code client — dans cet ordre pour qu'aucune fenêtre n'expose un client à un backend absent.
- Rollback : revert du code client + Edge Functions ; `session_quiz_answers` peut rester en place (inoffensive, inutilisée) jusqu'à correction.

## Hors scope (sous-projets séparés)

- Examens à distance (H-1, H-2) — partage tentative/résultat host↔participant, anti-triche tentatives/timer.
- Persistance générale du contenu (C-4) — migration quiz/cours/flashcards/sondages de `localStorage` vers Postgres.
- Durcissement RLS + entropie des game codes existants (C-2).
