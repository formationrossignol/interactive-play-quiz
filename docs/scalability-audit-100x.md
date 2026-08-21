# Audit de scalabilité — charge ×100

Date : 2026-08-21. Périmètre : DB (`supabase/migrations/`, 123 fichiers, ~19 500 lignes SQL), edge functions (`supabase/functions/`, 39 fonctions), frontend (`apps/app/src`, ~479 fichiers ; `apps/marketing`).

Méthode : pour chaque zone, on suppose un trafic et/ou volume de données ×100 par rapport à aujourd'hui, et on identifie le mécanisme précis de ce qui casse en premier — pas des recommandations génériques ("ajouter un index"), mais la chaîne causale réelle (scan séquentiel, verrou de ligne, boucle N+1, transaction monolithique, etc.).

Non audité (à couvrir dans une passe ultérieure) : 15 edge functions non ouvertes (`create-checkout-session`, `create-portal-session`, `create-quiz-purchase-session`, `lti-create-line-item`, `lti-deep-linking-response`, `lti-generate-key`, `lti-test-connection`, `saml-login`, `saml-acs`, `saml-metadata`, `sso-login`, `sso-discover-oidc`, `send-welcome-email`) ; les composants live `LiveEventRoom.tsx`, `LiveEngagement.tsx`, `LivePresenterScreen.tsx` (probablement même forme que `QuizSession.tsx`, non vérifié).

---

## Tier 1 — casse en premier

### 1. Boucle de jeu live : verrouillage de ligne + collision de debounce cross-joueur

C'est le chemin produit central de l'app — le point le plus directement exposé à "×100 joueurs concurrents", puisque c'est littéralement la définition d'une session de quiz à grande échelle.

- **`supabase/functions/submit-answer/index.ts:174-192`** — `upsert_session_player` fait un `SELECT ... FOR UPDATE` + réécriture complète du tableau JSON `session_state.players` (une ligne par partie). Le coût par soumission de réponse croît avec le nombre total de joueurs de la session, et les soumissions concurrentes dans la même session se sérialisent sur le verrou d'une seule ligne. **Casse en premier à ×100 joueurs concurrents dans une session live.**
  Fix : sharder l'état joueur par ligne-par-joueur plutôt qu'un tableau JSON unique par session, ou passer à une écriture incrémentale/delta.

- **`apps/app/src/lib/sessionState.ts:165-199`** — la map `pendingPlayerWrites` de debounce est keyée uniquement par `gameCode`, pas par id joueur. Toute écriture non urgente (heartbeat) d'*un* joueur annule le timer en attente et le remplace par le seul payload de ce joueur — c'est last-write-wins entre joueurs différents, pas un batch par joueur. À ×100 joueurs concurrents, la plupart des heartbeats n'atteignent jamais Supabase (annulés silencieusement par l'écriture du joueur suivant dans la fenêtre de 800ms) → faux "déconnexion" en masse, présence cassée. **Bug de correction qui empire strictement avec le nombre de joueurs concurrents dans la même session.**
  Fix : keyer la map (et le payload en attente) par `${gameCode}:${player.id}`, ou batcher tous les joueurs en attente dans un seul appel RPC par flush.

- **`apps/app/src/components/QuizSession.tsx:625-660`** — l'hôte poll `session_state.select('players')` toutes les 800ms pendant la phase question, mais récupère le tableau **entier** de joueurs à chaque tick, indépendamment de la taille de session. Coût de lecture O(joueurs/session), fréquence de poll fixe. Se cumule avec l'abonnement realtime déjà actif en parallèle sur la même table (`subscribeToSessionState`, `sessionState.ts:398-430`) — poll ET realtime tournent ensemble, ce n'est pas un fallback, c'est une charge redondante.
  Fix : sélectionner seulement les champs modifiés/un delta (ou une colonne `updated_at`/count) plutôt que le tableau complet, ou supprimer le poll maintenant que `postgres_changes` livre déjà les mises à jour de ligne.

### 2. Trois files de dispatch, même anti-pattern, systémique

Boucle séquentielle ligne-par-ligne, 5+ aller-retours DB ou 1 appel Admin-API + 1 appel HTTP par ligne, plafond de lot codé en dur, zéro concurrence. Trois files indépendantes touchent ce mur chacune sur son propre volume d'événements — ce n'est pas un cas isolé, c'est le patron par défaut de tout le sous-système de dispatch.

- **`supabase/functions/dispatch-webhooks/index.ts:59-136`** — boucle for séquentielle, `limit(50)` codé en dur (ligne 52), aucun timeout sur le `fetch` sortant vers l'endpoint externe (un récepteur lent bloque tout le lot).
- **`supabase/functions/dispatch-lti-ags-scores/index.ts:59-190`** — même forme.
- **`supabase/functions/dispatch-automation-emails/index.ts:55-76`** — même forme.

Fix : paralléliser avec concurrence bornée (`Promise.all` sur des lots de 10), factoriser dans un helper de drain partagé, ajouter `AbortSignal.timeout()` sur les fetchs sortants.

### 3. Jobs nocturnes : scans non-sargables, index manquant, transaction monolithique

Ces jobs empirent avec le **volume de données historiques**, indépendamment du trafic concurrent — donc "×100" ici veut dire ×100 lignes accumulées, pas ×100 utilisateurs simultanés.

- **`supabase/migrations/20260813070000_automation_execution_engine.sql:214-290`** (`_automation_trigger_candidates`) — `UNION ALL` à 8 branches scannant `learning_events`/`assignments+targets+lateral`/`risk_signals`/`grade_results`/`competency_mastery_history`, appelée une fois par règle d'automatisation dans une boucle par org, elle-même dans une boucle sur **toutes** les orgs. 6 des 8 branches filtrent avec `col::date = p_day` — cast non-sargable, annule tout index sur ces colonnes, force un scan complet de l'historique par prédicat, par org, par règle, chaque nuit. Coût = O(orgs × règles × lignes_historiques_totales), entièrement séquentiel.
  Fix : réécrire chaque `col::date = p_day` en `col >= p_day and col < p_day + 1` ; scinder l'union en 8 fonctions SQL stables séparées, appelées seulement pour le `trigger_type` correspondant.

- **`effective_assignment_due_at()`** (`supabase/migrations/20260811040000_accommodation_effective_dates.sql:25-30`) — `plpgsql`, pas de marqueur `stable`/`immutable` (défaut `volatile`), appelée **deux fois par ligne candidate** dans les branches `due_soon` et `overdue` ci-dessus (4 appels/ligne au total), chacune avec 2-3 sous-requêtes internes. `volatile` dans un `WHERE` force une ré-exécution scalaire par ligne, sans cache, sans plan parallèle. S'empile sur le point précédent.
  Fix : marquer `stable`, calculer une fois par ligne via un `lateral join` plutôt que deux appels inline.

- **`_run_daily_analytics_rollup_internal`** (`supabase/migrations/20260812020000_scheduler.sql:36-80`) — même cast non-sargable `::date =` ×3. Pire pour `competency_evidence` : son seul index est `(competency_id, learner_id, occurred_at desc)` — **aucune colonne `org_id` dans un index** — donc `where ev.org_id = p_org_id` est un scan séquentiel complet garanti, à chaque org, chaque nuit. Appelée depuis `for v_org in select id from organizations loop` (ligne 356) **sans commit par org** — tout le run nocturne pour toutes les orgs est une seule transaction top-level lancée par `pg_cron` ; un timeout/crash en cours de route annule tout ce qui a déjà été traité cette nuit-là, pas seulement l'org en échec.
  Fix : ajouter `competency_evidence_org_idx`, corriger les casts en prédicats de plage, découper la boucle d'orgs sur plusieurs ticks cron (ou `dblink`/background workers) pour qu'un échec partiel ne perde pas tout le run.

- **`run_scheduled_lms_analytics_jobs`** (`supabase/migrations/20260813070000_automation_execution_engine.sql:346-370`) — boucle série simple sur les orgs, aucun parallélisme, aucun batching cross-tick. Scale linéairement avec le nombre d'orgs, aucun chemin de scale horizontal ; si la fenêtre nocturne est fixe, le job finit simplement par ne plus terminer avant le run du lendemain.
  Fix : même remède que le point précédent — découper/paginer la boucle d'orgs.

### 4. `emit_webhook_event()` — fan-out synchrone dans la transaction d'écriture métier

**`supabase/migrations/20260821070000_public_api_webhooks.sql:176-295`** — tourne *dans* les triggers enrollment/submission/grade/completion/certificate/publish/mastery, `security definer`, même transaction que l'écriture métier. Chaque insertion d'inscription, chaque publication de note paie : scan de `webhook_endpoints` pour matcher org+event, insertion de N lignes `webhook_deliveries`, avant que l'écriture originale puisse commit. À ×100 trafic LMS de base (pas trafic webhook — usage normal de la plateforme), cette taxe touche les chemins d'écriture les plus chauds de l'app. C'est celui qui a le plus de chances de dégrader des flux produit non liés aux webhooks.
Fix : déplacer le fan-out vers `pg_notify`/replication logique/pattern outbox, lu par un worker séparé, hors du chemin de commit synchrone.

### 5. `scim-users` — lecture non bornée sur tout le projet

**`supabase/functions/scim-users/index.ts:92-93`** — le chemin de conflit du POST SCIM appelle `auth.admin.listUsers()` sans filtre, chargeant **tous les utilisateurs de tout le projet Supabase** en mémoire pour trouver une correspondance d'email. Coût O(utilisateurs_plateforme_totaux), pas O(cette org) — pire lecture non bornée de toute la surface auditée à ×100 utilisateurs plateforme.
Fix : filtrer côté serveur (recherche d'email par index) plutôt que lister-puis-scanner.

### 6. `proctoring-api` — recalcul O(n²) par événement

**`supabase/functions/proctoring-api/index.ts:312-341`** (`refreshReport`) — tourne après chaque insertion d'événement/alerte/capture de proctoring, re-fetche tous les events/alerts/captures de la tentative pour recalculer des compteurs à chaque fois. Coût par événement O(événements_jusqu'ici), coût total sur une tentative O(n²).
Fix : maintenir des compteurs incrémentaux plutôt qu'une ré-agrégation complète par événement.

---

## Tier 2 — dégrade fortement

- **Aucune politique de rétention/purge sur toute la base**, repo-wide. Vérifié sur `learning_events`, `enrollment_history`, `competency_mastery_history`, `manual_grade_history`, `lti_log`, `saml_log`, `sso_log`, `accommodation_access_log`, `attendance_events`, `live_events`, `planning_events`, `webhook_deliveries`, `automation_runs`, `report_runs`, `oneroster_sync_runs`, `lti_nrps_sync_runs`, `api_request_log` — aucun `DELETE`/archivage nulle part dans les 123 migrations, un seul `cron.schedule(...)` dans tout l'historique. Tout est insert-only, non borné. Ceci compose directement avec le Tier 1 §3 : plus l'historique s'accumule, plus les scans nocturnes ralentissent — les deux problèmes s'alimentent mutuellement.
  Fix : politique de rétention + cron de purge par table (ou partitionnement mensuel avec drop des partitions anciennes).

- **`supabase/migrations/20260821070000_public_api_webhooks.sql:308-343`** (`api_request_log`, rate limiter) — insert-only, aucun job de purge. Le rate limiter fait `count(*) where created_at > now()-60s` (borné par index, correct), mais la table elle-même grossit indéfiniment — des millions de lignes/jour à ×100 trafic API, sans rien qui supprime les anciennes.

- **`supabase/functions/oneroster-sync/index.ts:46-53`** — tableau `users[]` entier parsé en mémoire en un seul appel de fonction edge, un seul RPC, aucun plafond de lignes, aucune pagination. À ×100 (un SIS poussant 50k+ lignes en un POST) — limite mémoire/temps d'exécution Deno = mode d'échec : requête qui meurt, timeout opaque, aucune reprise partielle.
  Fix : rejeter/exiger des lots découpés (413 au-delà de N lignes), ou découper côté serveur.

- **`supabase/functions/scim-users/index.ts:61-64`** et **`supabase/functions/scim-groups/index.ts:57-61`** — les endpoints GET de liste SCIM font un appel Admin-API/DB supplémentaire par ligne (`loadScimUserRow`/`loadScimGroupRow`), jusqu'à 200 lignes/page. Les IdP pollent SCIM sur un planning ; à ×100 taille d'annuaire × ×100 orgs synchronisant, c'est du N+1 sur un chemin de poll récurrent.
  Fix : résoudre emails/membres en un seul batch plutôt que ligne par ligne.

- **`supabase/functions/lti-nrps-sync/index.ts:110-149`** — la synchro de roster boucle par membre : 1 lookup + N upserts de rôle + 1 insert, séquentiel, sans batching. À ×100 taille de roster (milliers d'étudiants), un run fait des milliers d'aller-retours séquentiels — vrai risque de timeout.
  Fix : résolution en masse + upsert en masse en un seul appel SQL set-based.

- **`supabase/functions/proctoring-api/index.ts:196-223`** (`get-overview`) — `select("*")` non borné sur events/alerts/captures par examen, `.filter()` imbriqué en mémoire par tentative (O(tentatives × événements)), plus un appel `createSignedUrl()` par capture via `Promise.all` non borné.
  Fix : paginer, joindre côté SQL, batcher/limiter la génération d'URLs signées.

- **`supabase/functions/admin-revenue-summary/index.ts:53-56`** — `profiles.select("plan")` charge chaque ligne de profil en mémoire pour compter 3 catégories. À ×100 utilisateurs, transfert complet de table pour une stat admin.
  Fix : `group by`/`count` côté SQL.

---

## Tier 3 — mineur / à faire en passant

- **`has_org_role()`** (`supabase/migrations/20260730120000_org_rbac_foundation.sql:43-53`) — index séparés sur `user_org_roles(user_id)` et `(org_id)` plutôt qu'un composite `(user_id, org_id, role)`. Appelée depuis quasi toutes les policies RLS du schéma ; correct aujourd'hui (bitmap AND sur deux petits index), mais à ×100 volume de requêtes concurrentes c'est la fonction la plus invoquée de toute la base — vaut l'index composite pour économiser un bitmap-and sur chaque check RLS, partout dans la plateforme.

- **`effective_assignment_due_at()`** (`supabase/migrations/20260811040000_accommodation_effective_dates.sql:39-42`) — deux sous-requêtes corrélées (`assignment_targets`, `assignments`), pas d'index confirmé sur `assignment_targets(assignment_id, target_type, target_id)` pour le lookup d'override. Peu coûteux aujourd'hui par appel, mais chaque site d'appel supplémentaire (déjà ×4 par ligne candidate, Tier 1 §3) le multiplie.

- **`apps/app/src/lib/lms/gradebook.ts:75-84`** (`listSessionGradeItems`) — `select('*')` sans `.limit()`, borné en pratique par la taille du roster de classe — dégrade progressivement, pas un point de rupture, mais mérite un garde-fou de pagination si la taille des orgs ×100.

---

## Ce qui tient la charge sans modification

RLS via `has_org_role()` — exists-subqueries par ligne, bon marché et indexées via FK. `_verify_api_token`/lookup token SCIM — vrai index seek sur index unique. Déchiffrement de secret — lookup single-row gated service_role. 13 edge functions relues et propres : `get-participant-attempts`, `get-exam-by-code`, `save-exam`, `submit-exam-attempt`, `create-session`, `advance-question`, `lti-jwks`, `lti-launch`, `sso-callback`, `stripe-webhook`, `api-v1`, `generate-course`, `send-org-invitation`. `apps/app/src/pages/lms/Analytics.tsx` — réduit sur des lignes déjà agrégées côté serveur, pas sur des événements bruts. `apps/marketing` — site statique Next.js, aucun pattern realtime/poll/requête non bornée trouvé.

---

## Priorité de remédiation suggérée

1. Fix correctness d'abord (Tier 1 §1, `pendingPlayerWrites`) — c'est un bug qui casse la présence des joueurs *aujourd'hui* à mesure que la taille de session grandit, pas seulement à ×100.
2. Row-lock du `session_state.players` (Tier 1 §1, `submit-answer`) — cœur du produit, le plus direct des trois "×100 joueurs concurrents".
3. Paralléliser les 3 dispatchers (Tier 1 §2) — fix mécanique identique appliqué 3 fois, gain immédiat.
4. Casts non-sargables + index manquant sur `competency_evidence` (Tier 1 §3) — un `ALTER` et une réécriture de prédicat, gros gain pour effort faible.
5. Politique de rétention générique (Tier 2, premier point) — sans ça, tout le reste continue de s'aggraver mécaniquement avec le temps, indépendamment de tout autre fix.
