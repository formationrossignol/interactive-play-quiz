# État de validation — Programme LMS

Date : 2026-08-11
Portée livrée : **fondations** (migrations DB + RLS + RPC clés + UI minimale)
sur `feat/lms-program-foundations` (PR #234, mergé) + `fix/lms-share-groups-rename`
(PR #236) + `feat/lms-sidebar-nav` (PR #235). Cette dernière branche ajoute
aussi la couche d'agrégation de la spec 07 (migration
`20260811010000_learning_analytics_aggregation.sql`, non mergée), la
participation live anon/temps réel de la spec 09 (migration
`20260811020000_live_engagement_participation.sql`, non mergée), et l'UI de
grilles de correction (rubriques) de la spec 01 (`Assignments.tsx`,
`gradebook.ts` — pas de nouvelle migration, le RPC acceptait déjà
`p_rubric_ratings`), et une passe de réconciliation LMS ↔ systèmes
pré-existants (migration `20260811050000_lms_reconciliation.sql`, voir
§Réconciliation ci-dessous, non mergée).

Ce document trace ce qu'il reste pour que chaque spec passe de « fondation
posée » à « conforme à ses propres critères d'acceptation ». Statut par
chantier : 🟢 fondation posée et vérifiée · 🟡 fondation partielle · 🔴 non
commencé.

## Vue d'ensemble

| # | Spec | DB/RLS/RPC | UI | Intégrations tierces | Statut |
|---|---|---|---|---|---|
| 01 | Devoirs & gradebook | 🟢 | 🟡 gradebook consolidé fait, reste minimal ailleurs | 🔴 antiplagiat | Fondation |
| 02 | Inscriptions & sessions | 🟢 | 🟡 minimal | — | Fondation |
| 03 | Compétences & preuves | 🟢 | 🟡 minimal | 🔴 CASE/Open Badges | Fondation |
| 04 | Interopérabilité & identité | 🟡 LTI Core + linking | 🟡 admin LTI fait | 🟡 LTI 1.3 Core réel, reste 🔴 | Fondation partielle |
| 05 | Accessibilité & aménagements | 🟢 | 🟡 minimal | — | Fondation |
| 06 | Parcours adaptatifs & automatisations | 🟢 | 🟡 minimal | — | Fondation |
| 07 | Analytics & signaux de risque | 🟢 | 🟡 minimal | — | Fondation |
| 08 | Banque d'items & évaluations | 🟢 | 🟡 minimal | 🔴 QTI 3 | Fondation |
| 09 | Live Q&A & coanimation | 🟢 | 🟡 minimal | 🔴 PPT/Teams/Zoom | Fondation |
| 10 | Gouvernance de contenu | 🟡 lib content only | 🟡 minimal | 🔴 L10N, exports | Fondation |

## Ce qui est déjà vérifié (ne pas re-tester)

- Les 11 migrations s'appliquent proprement en base prod (`quizz`,
  `lwwfgdebmggxjuvlazwf`) — `supabase migration list` local = remote.
- RLS re-testée sous rôle `authenticated` réel (pas bypass superuser) :
  réponses correctes (08) et secrets d'intégration (04) illisibles côté
  client, registrar exclu du contenu des remises (01), question non modérée
  invisible avant approbation (09).
- Invariants métier testés fonctionnellement : réservation de capacité
  atomique sous concurrence (02), retard calculé serveur + révision de note
  auditée (01), recalcul de maîtrise idempotent (03), détection de cycle
  réelle sur les règles de déblocage (06), rejeu d'automatisation sans
  doublon (06), vote/réponse live idempotents (09), publication de contenu
  avec garde de concurrence optimiste (10).
- Deux bugs de récursion RLS trouvés et corrigés (fonction predicate
  invoker qui re-déclenchait la policy de sa propre table) : `is_live_event_staff`
  (09) et `assignment_visible_to_learner` (01).
- Bug de nommage trouvé et corrigé : 2 migrations référençaient encore
  `public.groups`/`group_members`, renommés en `share_groups`/
  `share_group_members` par une migration antérieure (`20260730140000`).
- Migration `20260811010000_learning_analytics_aggregation.sql` (projections
  journalières + génération de signaux de risque, spec 07) rejouée de bout en
  bout sur une base locale reconstituant la chaîne réelle de dépendances
  (`organizations`, `content`, `share_groups`, `enrollments`, `assignments`,
  `competencies`, `learning_events`, jusqu'à cette migration) — `supabase
  start`/`db reset` ne fonctionne pas tel quel dans ce repo car deux tables
  (`session_state`, `profiles`) préexistent à tout historique de migration et
  ne sont recréées par aucun fichier ; contournement local uniquement, aucune
  migration commitée n'y touche. Vérifié sur données réalistes : les 4 règles
  (`inactivity`/`overdue`/`repeated_failure`/`progress_drop`) produisent les
  bons signaux, `generate_risk_signals()` rejoué immédiatement n'insère
  aucun doublon, un apprenant non-staff ne voit aucun `risk_signal` (RLS) et
  ne peut pas exécuter les deux RPC (`Not authorized`), et un signal résolu
  peut se rouvrir proprement si la condition est encore vraie au run
  suivant.
- Migration `20260811020000_live_engagement_participation.sql` (jointure de
  lobby, accès anonyme, temps réel, spec 09) rejouée bout en bout sur la
  même base locale reconstituée que ci-dessus. Vérifié : un run avec
  `capacity=1` refuse un 2ᵉ participant distinct sous verrou consultatif
  transactionnel (pas de race entre le check et l'insert) ; un même
  `client_id` qui rejoint deux fois obtient la même ligne (reconnexion sans
  doublon de siège) ; un rôle `anon` est bloqué (`Authentication required`)
  sur un événement en politique `authenticated`/`allowlist` mais accepté en
  `anonymous`/`pseudonym` ; un participant expulsé (`kick_participant`) ne
  peut plus rejoindre ; verrouiller un run (`lock_live_run`) bloque les
  *nouveaux* arrivants mais laisse un participant déjà présent se
  reconnecter ; `get_my_live_response()` restitue la réponse déjà envoyée
  d'un `client_id` donné sans fuite vers un autre `client_id` ; les 4 tables
  concernées (`audience_questions`/`live_interactions`/`live_runs`/
  `live_responses`) sont bien dans la publication `supabase_realtime`.

---

## Réconciliation LMS ↔ systèmes pré-existants

Chaque spec du programme a été construite depuis son propre « modèle de
données indicatif », sans confronter ce modèle à ce que l'app avait déjà.
Audit (deux passes Explore sur toutes les migrations + le frontend) confirmé
concret, pas une impression : le gradebook « unifié » ne l'était que dans le
`check` constraint, pas dans le code ; les notifications existantes n'étaient
jamais déclenchées par le LMS ; « restaurer » une version de contenu ne
restaurait rien de visible ; l'inscription par groupe n'avait aucun code pour
l'activer. Migration `20260811050000_lms_reconciliation.sql`.

**Fait** :
- `sync_exam_attempt_to_gradebook()` / `sync_manual_grade_to_gradebook()` (triggers) — un examen ou une évaluation manuelle publiée alimente désormais réellement `grade_items`/`grade_results`, pas seulement les devoirs. `exam_attempts` a gagné une colonne `learner_id` nullable (jamais `participant_email`, auto-déclaré et non vérifié en Tier-1) — remplie uniquement quand l'appelant a une vraie session (`getCallerUserId()` dans `start-exam-attempt`), donc le passage d'examen anonyme par code continue de fonctionner à l'identique. Les tentatives multiples respectent `exams.score_retention_policy` (`best`/`last`, même sémantique que le calcul déjà existant côté client dans `examStorage.ts`). Les évaluations manuelles de type `validation` (« Validé »/« Non validé ») ne sont volontairement pas forcées dans un gradebook à points. Vérifié : deux tentatives d'examen à 60 puis 90 → conservé 90 en politique `best` ; 90 puis 60 → conservé 60 en politique `last` ; tentative anonyme → absente du gradebook.
- `notify_lms_grade_publication()` (trigger sur `grade_results`) — réutilise exactement le `notify_manual_grade_publication()` déjà existant (catégorie `system`, `notification_category_enabled()`, table `notifications` déjà là). Exclut volontairement `source_type='manual'` : sans ça, publier une note manuelle déclenchait *deux* notifications pour le même événement (le trigger existant + celui-ci via la synchronisation ci-dessus) — bug trouvé par le test fonctionnel de cette migration, pas par relecture.
- `LearnerAssignments` (`Assignments.tsx`) affiche désormais « Mes notes » via `myGradeResults()` — fonction déjà écrite dans `gradebook.ts`, jamais appelée par personne avant cette passe.
- `publish_content_version()`/`restore_content_version()` — corrigés pour écrire réellement le snapshot dans `content.data`. C'était un vrai bug, pas un manque : « restaurer » une version ne changeait rien à ce qui était servi. Vérifié : publier v1 puis v2 puis restaurer v1 → `content.data` reflète bien v1 à chaque étape.
- `enroll_group_in_session(p_session_id, p_group_id)` — active `enrollments.source='group'`/`enrollment_group_sources`, qui existaient sans aucun code pour les remplir. Boucle sur `share_group_members` et réutilise intégralement `enroll_in_session()` (capacité atomique, liste d'attente) par membre. Vérifié : groupe de 3 apprenants sur une session `capacity=2` → 2 actifs + 1 en liste d'attente, comme `enroll_in_session()` seul le ferait.

**Explicitement laissé de côté** (gaps réels, mais qui méritent chacun leur
propre conception plutôt qu'un rattachement rapide) :
- Banque d'items (spec 08, `assessment_items`) sans lien vers les questions de quiz existantes (`content.data`) — projet de migration de données à part entière.
- `certificates` (clé `course_id` texte, alimenté côté client) sans lien vers la complétion d'inscription ou la maîtrise de compétences — nécessite sa propre réconciliation de modèle.
- Incohérence de nommage `grade_items.source_type` vs `competency_evidence.source_type` — friction cosmétique, pas un bug fonctionnel, non touchée.
- Rappels à échéance temporelle (J-7/J-1) — nécessiteraient un vrai ordonnanceur, qui n'existe nulle part dans ce repo (constaté à plusieurs reprises cette session) ; pas simulé.
- Contrôle d'accès par plan Stripe vs rôle d'organisation LMS — question de modèle économique, pas un bug à trancher silencieusement dans un sens ou l'autre.

---

## 01 — Devoirs, remises et carnet de notes

**Fait** : `assignments`/`submissions`/`submission_versions`/`rubrics`/
`grade_items`/`grade_results` + `submit_assignment()` (brouillon/finalisation,
retard calculé serveur) + `publish_submission_grade()` (upsert gradebook,
révision auditée). Côté UI : grilles de correction (`RubricManager`/
`RubricBuilder` dans `Assignments.tsx`) — créer une grille, y ajouter
critères et niveaux (écriture directe RLS, pas de nouveau RPC) ; dans
`GradingPanel`, sélectionner une grille par devoir, noter chaque critère par
niveau (`RubricGrading`), total auto-sommé pré-rempli dans le champ note,
publié avec `p_rubric_id`/`p_rubric_ratings`. Vue gradebook consolidée
(`/lms/gradebook`, `pages/lms/Gradebook.tsx`) — pas de nouvelle migration,
lit directement `grade_items`/`grade_results` déjà là (staff read via RLS
`grade_items_staff_read`, rôles `trainer`/`pedago`/`registrar`/`admin`,
plus large que le `STAFF_ROLES` de `Assignments.tsx` qui excluait
`registrar`). Matrice apprenant (roster = `enrollments` de la session,
noms résolus via `usernames_by_ids`) × colonne (`grade_items` de la
session **plus** les items sans `session_id` — seul `source_type=assignment`
en écrit un aujourd'hui, exam/manual restent org-larges par construction,
voir `20260811050000_lms_reconciliation.sql` ; les exclure aurait masqué de
vraies notes plutôt que de refléter un vrai manque). GBK-002 (catégories/
coefficients) : regroupement par `grade_items.category`, moyenne pondérée
par `grade_items.weight` (colonne déjà là, pas de `grade_categories` dans ce
schéma — voir §Réconciliation), case à cocher par catégorie « exclure la
plus basse note ». GBK-003 : `status` (`graded`/`excused`/`missing`/
`not_graded`) jamais coercé à zéro — `apps/app/src/lib/lms/
gradebookCalculations.ts::cellFor()`. GBK-004 : chaque total affiche sa
formule (items + coefficients + somme) en dépliant la cellule. GBK-005 :
simulateur « si je reçois X » — ajouté côté apprenant dans `MyGrades`
(`WhatIfSimulator`), calcul 100 % client (`simulateWhatIf()`), jamais
persisté ; limité aux items déjà présents dans `myGradeResults()` (un item
sans aucune ligne `grade_results` n'existe pas encore pour l'apprenant, donc
rien à simuler dessus). GBK-006 (partiel) : export CSV/XLSX/PDF
(`gradebookExport.ts`, réutilise le motif de `liveResultsExport.ts` —
lazy-import `xlsx`/`jspdf`) neutralisant les formules tableur (`csvCell`,
même garde que `buildGradeCsv` dans `grading/calculations.ts`) et respectant
les filtres actifs (statut d'inscription, export = exactement les lignes
affichées) — **l'import CSV/XLSX avec prévisualisation reste à faire**, pas
tenté dans cette passe. Vérifié : `tsc --noEmit` et `eslint` propres sur les
fichiers touchés ; page testée dans Chrome (non authentifié → état vide
« Accès réservé au staff » correctement rendu, titre de page et route OK,
aucune erreur console applicative) — **non vérifié avec des données réelles
de session/gradebook** (pas de compte staff/organisation de test disponible
en local pour cette passe).

**Reste à faire** :
- [ ] UI : remise fichier/audio/vidéo — seul le mode texte est câblé côté client (`response_mode` en DB supporte déjà file/url/audio/video)
- [ ] UI : `assignment_targets` par groupe/apprenant individuel — seul le ciblage par session est câblé
- [ ] UI : échéance/aménagement dérogatoire par apprenant (`due_override`) — colonne existe, aucun écran
- [ ] GBK-006 : import CSV/XLSX de notes avec prévisualisation/mapping de personnes/doublons/rapport d'erreurs — l'export seul est fait
- [ ] Job serveur de scan antivirus des fichiers (`submission_files.scan_status`) — colonne prête, aucun job
- [ ] URLs de téléchargement signées courte durée pour les fichiers
- [ ] Connecteur antiplagiat (interface only — non-objectif V1 explicite, mais l'interface elle-même n'existe pas)
- [ ] Notifications programmées (J-7/J-1/retard) — table `notifications` existe, rien ne les déclenche pour les devoirs
- [ ] Double correction / correction anonyme (GRD-005) — colonne `is_anonymous` posée, pas de flux de levée d'anonymat auditée

## 02 — Inscriptions, sessions et gestion des apprenants

**Fait** : `course_offerings`/`course_sessions`/`enrollments`/
`waitlist_entries` + `enroll_in_session()` (capacité atomique + liste
d'attente) + `transition_enrollment()`. Depuis
`20260811060000_waitlist_promotion.sql` (ENR-011/012) : `promote_waitlist()`
— déclenché depuis `transition_enrollment()` dès qu'un apprenant actif quitte
une session avec capacité limitée (pas de scheduler dans ce repo, donc
événementiel plutôt que planifié), offre le siège libéré à l'apprenant en
tête de liste (`waiting`→`offered`, fenêtre 48h) plutôt que de l'inscrire
automatiquement ; balayage paresseux des offres expirées à chaque appel
plutôt qu'un cron. `accept_waitlist_offer()`/`decline_waitlist_offer()`
côté apprenant, ce dernier ré-enchaînant `promote_waitlist()` pour offrir
le siège au suivant. Vérifié : A(actif)+B+C(en attente, capacité=1) →
A se désinscrit → B (position 1) reçoit l'offre, C reste en attente → B
accepte → B devient actif ; C ne peut pas accepter l'offre de B (rejeté,
`Not authorized`).

Depuis cette passe : UI apprenant pour l'offre elle-même
(`Sessions.tsx::WaitlistOffers`, `enrollment.ts::myWaitlistEntries`/
`acceptWaitlistOffer`/`declineWaitlistOffer`) — bandeau en tête de « Mes
formations » listant les entrées `status='offered'` non expirées, compte à
rebours (heures/minutes restantes), boutons Accepter/Refuser appelant
directement les RPC déjà posées et testées. Pas de nouvelle migration —
RLS `waitlist_entries_read` autorisait déjà `learner_id = auth.uid()`.
Vérifié : `tsc`/`eslint` propres ; page testée dans Chrome non authentifié
(état vide correctement rendu, aucune erreur console) — **non vérifié
avec une offre réelle** (pas de compte de test local pour déclencher
`promote_waitlist()`).

**Reste à faire** :
- [ ] UI : import CSV/XLSX avec prévisualisation/mapping/doublons (ENR-014)
- [ ] UI : actions en masse (inscrire, déplacer, annuler, prolonger — ENR-015)
- [ ] UI : écran participant pour voir/accepter/décliner une offre de liste d'attente — les RPC existent, aucun écran ne les appelle
- [ ] Auto-inscription avec règles (domaine email, code, paiement, prérequis — ENR-013)
- [ ] Vue apprenant « Mes formations » complète avec dates effectives/échéances relatives recalculées (ENR-017, la V1 actuelle liste juste par statut)
- [ ] Calcul de complétion versionné par politique (activités obligatoires, score, présence)
- [ ] `attendance_events` (présence) — dans le modèle indicatif, non créé du tout

## 03 — Compétences, résultats d'apprentissage et preuves

**Fait** : `competency_frameworks`/`competencies`/`mastery_scales`/
`competency_evidence` + `record_competency_evidence()` +
`recompute_competency_mastery()` (idempotent, historisé).

**Reste à faire** :
- [ ] UI : alignement compétence ↔ question/rubrique/activité (CMP-010) — table `competency_alignments` posée, aucun écran ne l'alimente
- [ ] UI : vue couverture programme (enseigné/pratiqué/évalué — CMP-012, CMP-021)
- [ ] UI : demande de revue apprenant (`competency_review_requests`) — table posée, aucun écran
- [ ] Écran de migration des tags existants → compétences (mapping guidé, section « Migration des tags existants » de la spec)
- [ ] Méthodes d'agrégation configurables (CMP-007) — seule « dernière preuve » est implémentée ; meilleure preuve / moyenne pondérée / N-récentes / validation manuelle sont à ajouter
- [ ] Export CASE 1.1 / Open Badges (non-objectif V1 explicite mais listé comme préparation attendue)
- [ ] Vue formateur groupe × compétences (CMP-020)

## 04 — Interopérabilité, identité et administration Enterprise

**Fait** : schéma de configuration (`identity_connections`, `lti_registrations`,
`integration_connections`, `api_clients`, `webhook_endpoints`) + coffre à
secrets hashés (`create_integration_secret()`, illisible côté client). Depuis
`20260811030000_lti_login_state.sql` + `supabase/functions/lti-login`/
`lti-launch` : LTI 1.3 Core réel (LTI-001), suivant l'« ordre de livraison
obligatoire » de la spec (SSO puis **LTI Tool** avant QTI/SCIM/OneRoster/API) —
`lti-login` initie l'OIDC third-party login (state/nonce en base, jamais en
cookie — la redirection cross-site du form_post rend les cookies SameSite peu
fiables ici) ; `lti-launch` vérifie signature RS256 (JWKS distant via
`jose`), issuer, audience, expiration, nonce, version LTI, type de message et
`deployment_id` contre `lti_deployments` — tout est journalisé dans
`lti_launches` via `record_lti_launch()` (succès ou rejet avec raison,
LTI-006). La logique de vérification pure (`_shared/lti.ts`) est testée avec
une vraie paire de clés RSA générée (`_shared/lti.test.ts`, `deno test` — 10
cas : token valide, expiré, mauvais issuer/audience/nonce/signature/version,
deployment manquant, mauvais message type, rejeu). LTI-005 est respecté à la
lettre côté compte : un `sub` non reconnu n'auto-provisionne **jamais** de
compte Brivia (aucun mécanisme testé/revu de ce type n'existe dans ce repo) —
il atterrit sur `/lti/unlinked`, page explicative. Un `sub` déjà relié
(`external_mappings`, `system='lti'`) obtient une vraie session via
`admin.generateLink()` (mécanisme Supabase standard pour un utilisateur déjà
authentifié, pas une invention). Nécessite la variable d'environnement
`PUBLIC_APP_URL` (nouvelle, à configurer côté projet Supabase) pour construire
l'URL de redirection `/lti/unlinked`.

Depuis cette passe (`20260812010000_lti_admin_linking.sql` +
`/lms/integrations`) : le formulaire d'enregistrement LTI ne devine plus
`jwks_url`/`auth_login_url`/`auth_token_url` par convention `${issuer}/...`
(bug réel trouvé en lisant le code — cette convention ne correspond à
aucune plateforme LTI réelle) : les 5 champs (`issuer`, `client_id`,
`jwks_url`, `auth_login_url`, `auth_token_url`) sont maintenant saisis
explicitement, à copier depuis la configuration LTI de la plateforme.
Gestion des `lti_deployments` par enregistrement (le `deployment_id` doit
correspondre exactement à la revendication envoyée par la plateforme —
`lti-launch` rejette sinon en `unknown_deployment`, aucune UI ne le
permettait avant). RPC `link_lti_subject(p_registration_id, p_subject,
p_internal_user_id)` (security definer) — complète LTI-005 : jusqu'ici
`external_mappings` n'avait qu'une policy RLS `select`, aucune écriture
cliente possible ; le RPC vérifie l'admin de l'org du registration, exige
que le compte cible soit déjà membre de l'organisation (pas d'accès pour un
uuid arbitraire), et upsert `system='lti'`/`object_type='user'`/
`external_id='<registration_id>:<sub>'` — exactement la clé que
`lti-launch/index.ts` recherche. Panneau diagnostic (LTI-006) : lecture de
`lti_launches` par enregistrement (RLS déjà admin-only, aucun changement
nécessaire), succès/rejet avec raison traduite, et pour un lancement
`success`+`user_id is null`, un sélecteur de membre de l'org (réutilise
`list_org_members()` déjà existant) + bouton « Lier » appelant le RPC
ci-dessus. Bouton « Tester la connexion » : nouvelle edge function
`lti-test-connection` — fetch en direct de `jwks_url` sous l'identité de
l'appelant (RLS `lti_registrations_admin` fait l'autorisation, pas de
re-check de rôle dans la fonction), vérifie un JSON `{keys: [...]}` non
vide ; rien n'est persisté, c'est un contrôle pré-activation, pas un
lancement. Vérifié : `tsc`/`eslint`/`deno check` propres ; page testée dans
Chrome non authentifié (état vide « Accès réservé » correctement rendu) —
**migration et edge function pas encore déployées en prod, RPC/edge
function non testés contre des données réelles** (pas de compte admin
local pour créer un enregistrement/déploiement/lancement de test).

**Reste à faire** :
- [ ] Deep Linking (LTI-002), Names and Role Provisioning (LTI-003), Assignment and Grade Services (LTI-004) — LTI-001 (lancement core) seul est couvert
- [ ] Provisioning automatique d'un compte pour un `sub` jamais vu (actuellement : jamais, par choix — voir commentaire en tête de `lti-launch/index.ts`)
- [ ] Handshake OIDC/SAML réel pour le SSO général (INT-001 à INT-005) — étape 1 de l'ordre de livraison, toujours pas commencée ; seule la table de config existe
- [ ] Import/export QTI 3
- [ ] Sync SCIM 2.0 (provisioning/déprovisioning réel)
- [ ] Sync OneRoster 1.2 (import CSV + REST, dry-run)
- [ ] API REST publique versionnée + OpenAPI + pagination curseur + idempotency-key
- [ ] Livraison de webhooks réelle (signature, retry, rejeu) — seule la table `webhook_deliveries` existe, aucun worker
- [ ] Rotation de certificat SSO avec fenêtre de chevauchement réelle (le modèle de données le permet, le flux non)
- [ ] Outil de diagnostic LTI (dernier lancement, erreurs, test de connexion — LTI-006)

## 05 — Accessibilité, inclusion et aménagements individuels

**Fait** : `accessibility_preferences`/`accommodation_profiles`/
`accommodation_rules`/`accommodation_overrides` + `get_effective_accommodations()`
(fusion de priorité + lecture auditée). Depuis
`20260811040000_accommodation_effective_dates.sql` : `effective_assignment_due_at()`
applique réellement `extended_deadline` (+N jours) et `no_time_limit`
(échéance supprimée) avec la priorité ACC-004 (dérogation activité >
profil) et l'audit de lecture ; `submit_assignment()` (spec 01) et la règle
`overdue` de `generate_risk_signals()` (spec 07) l'utilisent désormais tous
les deux — sans ça, un apprenant avec échéance prolongée se faisait
incorrectement marquer en retard/à risque par le moteur de signaux que
j'ai écrit la session précédente. Vérifié fonctionnellement : échéance de
base/étendue/sans-limite correctement calculées, `submit_assignment`
respecte l'échéance étendue, `overdue` ne se déclenche plus pour un
apprenant `no_time_limit` mais toujours pour un apprenant sans aménagement.
**`extra_time` (temps supplémentaire sur une activité chronométrée) n'est
volontairement pas couvert** — le seul système de tentative chronométrée du
repo (`exams`/`exam_attempts`) est documenté Tier-1 « le client calcule tout,
correction serveur infalsifiable explicitement différée », et la spec 08 n'a
toujours aucun moteur de correction/tentative server-side (VALIDATION-STATUS
§08) : il n'existe nulle part un chronomètre faisant autorité côté serveur à
étendre. Le calculer contre un minuteur client-trusted serait du théâtre de
sécurité, pas ce que demande le critère d'acceptation (« calculé côté
serveur »).

**Reste à faire** :
- [ ] `extra_time` réel — bloqué en amont par l'absence de tout moteur de tentative chronométrée server-side (voir ci-dessus ; se débloque avec le moteur de correction de la spec 08)
- [ ] Vérificateur d'accessibilité de contenu (A11Y-007 à A11Y-012) — table `content_accessibility_checks` posée, aucun analyseur
- [ ] Socle application (A11Y-001 à A11Y-006 : focus, navigation clavier, contrastes, `prefers-reduced-motion`) — hors DB, c'est un chantier design system transverse à tout le produit, non traité ici
- [ ] Alternatives d'interaction accessibles (hotspot/drag-drop/dessin clavier — A11Y-013)
- [ ] Déclaration d'accessibilité publique (`accessibility_audits.published`) — table prête, aucun contenu réel, aucun écran public
- [ ] Tests automatisés (axe ou équivalent) en CI

## 06 — Parcours adaptatifs, conditions et automatisations

**Fait** : `rule_sets`/`rule_set_versions` + détection de cycle réelle
(`would_create_cycle()`) + `automation_rules`/`automation_runs` +
`record_automation_run()` idempotent. Depuis
`20260811070000_release_state_engine.sql` : `release_state` réellement
calculé — `evaluate_rule_definition()` évalue le DSL (`and`/`or` récursifs,
feuille `activity_completed`) contre la progression réelle d'un apprenant ;
`activity_completed_for_learner()` résout la complétion en réutilisant
l'unification du gradebook de la passe de réconciliation précédente
(`grade_results` gradé, source-agnostique assignment/exam/manuel) plus
`submissions`/`exam_attempts` directement. Toute autre source de feuille
(date/score/compétence...) échoue **fermé** (`false`, verrouillé) plutôt que
de deviner — pas de faux déverrouillage sur une condition qu'on ne sait pas
évaluer. Pas de scheduler : `recompute_release_state()` est déclenché par 3
triggers événementiels (`submissions`/`exam_attempts`/`grade_results`) sur
les écritures qui peuvent effectivement satisfaire une règle. Vérifié :
activité B verrouillée tant que l'activité A prérequise n'est pas soumise ;
soumission de A par l'apprenant → B passe automatiquement à `unlocked` sans
appel manuel, uniquement via le trigger.

**Reste à faire** :
- [ ] Balayage planifié complémentaire (règles à échéance temporelle — date/score qui change sans écriture applicative) : aucun scheduler dans ce repo, seul l'événementiel est couvert
- [ ] UI de construction en phrases « Quand [condition], alors [action] » — l'UI actuelle ne construit qu'une seule condition simple (`activity_completed`), pas le DSL complet (AND/OR, dates, scores, compétences...)
- [ ] Évaluateur pour les sources autres que `activity_completed` (date/score/compétence) — le DSL les accepte et les affiche, `evaluate_rule_definition()` les traite en échec fermé faute d'évaluateur dédié
- [ ] Simulation « voir comme cet apprenant » / dry-run avant publication (ADP-008, AUT-004)
- [ ] Test de positionnement / remédiation (ADP-009/010/011)
- [ ] `follow_up_tasks` — table posée, aucun écran ni déclencheur

## 07 — Analytics pédagogiques, psychométrie et signaux de risque

**Fait** : `learning_events` (append-only, dédupliqué) partagé par tous les
specs + `metric_definitions`/`risk_signals`/`saved_reports` +
`resolve_risk_signal()`. Depuis `20260811010000_learning_analytics_aggregation.sql` :
projections journalières activité/inscription/compétence
(`run_daily_analytics_rollup()`, idempotente/recalculable) + génération réelle
de 4 des 5 signaux de risque ANA-013 (`generate_risk_signals()` : inactivité,
retard, échecs répétés, chute d'activité — un signal ouvert par
apprenant+règle, sauf `overdue` qui est par apprenant+devoir) +
`risk_signal_settings` (ANA-016 : activer/désactiver et seuiller chaque règle
par organisation). Depuis `20260811080000_blocking_prereq_signal.sql` : le
5ᵉ signal, `blocking_prereq`, était bloqué par `release_state` (spec 06)
« posée, jamais calculée » — maintenant que `20260811070000` le calcule
réellement, le signal lit directement les lignes `effect='locked'` d'un
apprenant activement inscrit, sans seuil de délai (contrairement aux autres
règles, être bloqué n'est pas une question de temps écoulé). Vérifié :
signal créé avec les bons facteurs, rejeu immédiat idempotent (0 insertion),
et surtout — résoudre le signal *et* déverrouiller le `release_state` sous-
jacent avant de rejouer ne le rouvre pas (le rejeu ne rouvre que si la
condition est encore vraie).

Depuis cette passe : dashboard staff (`/lms/analytics`, `AnalyticsDashboard`
dans `Analytics.tsx`, data-access `analyticsDashboard.ts`) — deux graphiques
(recharts, réutilisant le système de charts déjà en place pour le tableau de
bord général : `components/ui/chart.tsx`, tokens `--mp-chart-*`, classes
`product-analytics-card`/`product-analytics-grid`) : activité (apprenants
actifs distincts + événements, agrégés par jour sur 14j depuis
`analytics_daily_activity`) et preuves de compétence (`evidence_count` par
jour sur 14j depuis `analytics_daily_competency`), plus 4 tuiles de totaux
d'inscription sur 30j (`analytics_daily_enrollment`). RLS sur ces 3 tables
n'autorise que `trainer`/`pedago`/`admin` (pas `registrar`, pas
d'apprenant) — un seul écran sert donc ANA-006/007/008, il n'y a pas de
donnée distincte à séparer par rôle avec ce schéma. **ANA-005 (dashboard
apprenant) non fait** : aucune politique RLS ne permet à un apprenant de
lire ses propres lignes sur ces 3 tables (vérifié : seule
`..._staff_read` existe) — un vrai gap RLS, pas une UI manquante.
Palette : la fonction `validate_palette.js` (skill dataviz) flague le
couple `--mp-chart-secondary`/`--mp-chart-positive` sous le seuil de
contraste 3:1 en light (WARN, atténué ici par tooltip+légende déjà
présents) et hors bande de luminosité en dark (FAIL) — c'est la palette de
graphiques déjà utilisée par `ActivityChart`/`ScoreChart` du tableau de
bord général, pas quelque chose d'introduit ici ; corriger les tokens
`--mp-chart-*` eux-mêmes serait un chantier design-system transverse, hors
scope de cette passe. Vérifié : `tsc`/`eslint` propres ; page testée dans
Chrome non authentifié (état vide « Accès réservé » correctement rendu) —
**non vérifié avec des projections réelles** (pas de compte staff de test
disponible en local).

Depuis cette passe (`20260812020000_scheduler.sql`) : premier vrai
ordonnanceur du repo — extension `pg_cron` (déjà disponible sur le projet,
jamais activée), job nocturne `lms-daily-analytics-and-risk-signals` (3h,
`cron.schedule` avec nom → réapplication idempotente) qui boucle sur
`organizations` et appelle `run_daily_analytics_rollup()`/
`generate_risk_signals()` pour chacune, chaque org isolée dans son propre
bloc `exception when others` (une org en échec n'annule pas les autres —
`raise warning`, pas d'abandon du job). Problème réel trouvé en construisant
ceci, pas anticipé : les deux RPC vérifient `has_org_role(p_org_id,
['pedago','admin'])` via `auth.uid()` — correct pour un appel interactif,
mais un job `pg_cron` n'a pas de JWT, `auth.uid()` y est `null`, donc
l'appel direct aurait toujours levé `Not authorized` et le job aurait
tourné pour rien chaque nuit sans jamais rien écrire. Plutôt que d'affaiblir
ce contrôle (déjà testé fonctionnellement : « un apprenant non-staff ... ne
peut pas exécuter les deux RPC », voir plus haut), chaque fonction a été
scindée en wrapper public inchangé (signature/comportement identiques,
toujours vérifié) + fonction interne non vérifiée
(`_run_daily_analytics_rollup_internal`/`_generate_risk_signals_internal`),
jamais accordée à `authenticated`/`anon`, que seul le scheduler appelle.
Diff ligne à ligne du corps copié contre la définition source
(`20260811010000`/`20260811080000`) fait avant commit — logique identique,
seuls les commentaires diffèrent. **Non déployé/testé en prod au moment de
ce commit** — migration prête, pas encore poussée ; comportement du cron
lui-même (est-ce qu'il se déclenche, `cron.job_run_details`) pas vérifiable
sans attendre une exécution réelle après déploiement.

Depuis cette passe (`20260812070000_analytics_daily_item.sql`) : projection
journalière **item** — table `analytics_daily_item` (org_id,
item_revision_id, day, responses_count, correct_count, omitted_count,
avg_score_ratio), alimentée par un nouveau bloc ajouté à
`_run_daily_analytics_rollup_internal()` (donc déjà branchée sur le job
`pg_cron` nocturne, aucun câblage supplémentaire nécessaire). Une réponse
compte le jour où elle a été répondue (`answered_at`), ou — si jamais
répondue — le jour où la tentative qui la laisse vide a été finalisée
(`submitted_at`) ; une réponse d'une tentative encore `in_progress` ne
compte nulle part tant que l'un des deux n'est pas arrivé. Couvre la partie
d'ANA-009 que la matière première permet réellement : nombre de réponses,
taux de bonne réponse, taux d'omission, plus une moyenne des ratios de score
(utile pour le crédit partiel mcq déjà supporté par le moteur de
correction). **Ne couvre pas** le temps médian d'ANA-009 :
`assessment_responses` n'a aucune colonne de durée par item (seulement
`answered_at`, un instant, pas une durée) — en ajouter une pour ce seul
usage aurait été deviner un mécanisme de capture (déclaratif client ?
requête à requête serveur ?) que la spec 08 n'a jamais défini. RLS identique
aux 3 autres tables journalières (`trainer`/`pedago`/`admin` seulement,
même gap ANA-005 apprenant). Helper `listDailyItem()` ajouté à
`analyticsDashboard.ts` sur le même modèle que les 3 existants ; pas de
nouveau panneau dans `AnalyticsDashboard`/`Analytics.tsx` — ANA-010/011/012
(distracteurs par groupe de performance, difficulté/discrimination,
avertissements) restent un agrégat sensiblement plus gros (répartition par
option, découpage en quartiles de score par tentative), pas juste une
lecture de plus sur cette table. **Non vérifié avec des données réelles**
(même limite que le reste de cette passe : pas de compte staff/apprenant
local pour dérouler un cycle création→passation→note→rollup complet).

**Reste à faire** :
- [ ] Projection journalière **programme** — jamais définie faute de UI/agrégat programme existant à côté de session/offering
- [ ] Dashboard apprenant (ANA-005) — bloqué par l'absence de politique RLS lecture-apprenant sur `analytics_daily_activity`/`analytics_daily_enrollment`/`analytics_daily_competency`/`analytics_daily_item`
- [ ] Analyse d'items / psychométrie (ANA-010 distracteurs par groupe de performance, ANA-011 difficulté/discrimination, ANA-012 avertissements) — `analytics_daily_item` fournit le compte/taux de base, pas la répartition par option ni le découpage en quartiles nécessaires à ces trois-là
- [ ] Temps médian de réponse par item (ANA-009) — bloqué par l'absence de toute colonne de durée sur `assessment_responses`
- [ ] Programmation de rapports (`report_schedules`/`report_runs`) — tables posées, aucun exécuteur ; pourrait maintenant se brancher sur le même `pg_cron`
- [ ] Export CSV/XLSX/PDF avec pseudonymisation
- [ ] Seuil minimal anti-réidentification sur les comparaisons de cohortes (ANA-020)

## 08 — Évaluations avancées et banque d'items versionnée

**Fait** : `assessment_items`/`assessment_item_revisions` (immuables) +
`item_answer_keys` (illisible client) + `create_item_revision()` +
`submit_score_adjustment()` audité.

Depuis cette passe (`20260812060000_assessment_correction_engine.sql`) —
**le moteur de correction**, la pièce que tout le reste du programme
attendait :

- **Contrat de données** : `item_answer_keys.correct_answer`/`scoring_rules`
  étaient un jsonb totalement non typé, jamais peuplé que par un
  placeholder texte côté `ItemBank.tsx`. Défini et documenté en tête de
  migration pour 4 `item_type` sur les 21 permis : `true_false`
  (`correct_answer: boolean`), `single_choice` (`{optionId}`), `mcq`
  (`{optionIds}` + `partialCredit`/`penaltyPerWrong`), `short_answer`
  (`{equivalents}` + `caseSensitive`/`trim`). Choix des 4 : les seuls que
  `ItemBank.tsx` laissait déjà créer — construire un contrat pour un type
  sans UI d'auteur aurait été deviner un format, comme pour tout le reste
  de ce programme.
- **`assessment_attempts`/`assessment_responses`** (nouvelles tables) — le
  modèle indicatif de la spec nommait `assessment_attempt_forms`/
  `responses`, jamais créées par la migration d'origine ; c'était un vrai
  manque, pas juste « pas d'exécuteur ». `assessment_responses` est
  pré-créée intégralement à l'ouverture de la tentative (`start_assessment_attempt()`)
  — c'est le tirage figé (ASM-010/011) pour le mode `fixed` ; les sections
  `pool` sont refusées explicitement (`pool_sections_not_supported`), le
  tirage aléatoire n'a toujours pas d'exécuteur.
- **`submit_assessment_response()`** — la première fonction de tout ce
  repo à lire `item_answer_keys`. Sépare le comparateur pur
  (`_score_assessment_response()`, aucune I/O, testable en isolation) de
  l'autorisation/l'écriture. Barèmes riches (ASM-012) pour ce que ces 4
  types permettent : points fixes (les 4), crédit partiel + pénalité par
  option fausse (`mcq`), équivalences insensibles casse/espaces
  (`short_answer`). Tolérance numérique non couverte — aucun type
  numérique (`slider`, `math_graph`) n'a d'UI d'auteur non plus.
  `start_assessment_attempt()` refuse de démarrer une tentative sur une
  évaluation contenant un type non noté ou un item sans clé de réponse
  (`unsupported_item_type_in_assessment`/`item_missing_answer_key`) —
  échec net à l'ouverture plutôt qu'une notation partielle silencieuse en
  cours de route.
- **`publish_assessment()`** — snapshot immuable de la structure (sections
  fixes + refs d'items) dans `assessment_versions`, refuse de publier une
  évaluation sans section ou une section sans item.
- **UI** : `ItemBank.tsx` — formulaire de révision devenu conscient du
  type (liste d'options avec radio/checkbox pour marquer la bonne réponse
  sur `single_choice`/`mcq`, bascule Vrai/Faux, liste de réponses
  équivalentes pour `short_answer`) + panneau Évaluations (créer, ajouter
  une section fixe, attacher des révisions d'item, publier).
  `TakeAssessment.tsx` (`/lms/assessments`) — liste les évaluations
  publiées, démarre/reprend une tentative (idempotent — index unique
  partiel `(assessment_id, learner_id) where status='in_progress'`),
  affiche une entrée par type d'item, soumet chaque réponse
  individuellement (retour immédiat correct/incorrect + points, jamais la
  bonne réponse elle-même), termine la tentative et affiche le score final.
- **Ne débloque pas `extra_time` (05)** malgré ce que le document de
  dépendances disait avant cette passe — ce moteur note
  `assessment_items`, pas `exams`/`exam_attempts` (le système Tier-1 sur
  lequel `extra_time` porte réellement), deux systèmes parallèles jamais
  réconciliés ; `assessment_attempts` n'a d'ailleurs aucune notion de
  durée. Débloque en revanche la matière première de la projection
  journalière item et de la psychométrie ANA-009/012 (07) —
  `assessment_responses` porte `is_correct`/`points_earned` par item,
  l'agrégat lui-même reste à écrire.

Vérifié : `_score_assessment_response()` testé fonctionnellement (11 cas,
transaction ouverte puis annulée avant tout commit — rien laissé en base) :
vrai/faux correct/incorrect, choix unique correct/incorrect, QCM
tout-ou-rien avec ensembles dans un ordre différent (toujours correct),
QCM crédit partiel (2 correctes + 1 fausse, pénalité 1, barème 6 →
2.0000 pts, calcul vérifié à la main), QCM crédit partiel plafonné à 0
(aucune correcte, 3 fausses → jamais négatif), réponse courte avec
équivalence insensible casse/espaces, réponse courte sensible à la casse.
Migration entière rejouée en transaction annulée (`begin; ...; rollback;`)
pour valider la syntaxe/les références avant tout commit réel — une
première erreur trouvée ainsi (`position` comme nom de colonne casse la
grammaire `returns table(...)`, renommé `item_position`). `tsc`/`eslint`/
323 tests unitaires propres ; les deux nouvelles pages testées dans Chrome
non authentifié (états vides/accès réservé correctement rendus, aucune
erreur console). **Non testé en conditions réelles** : pas de compte
staff/apprenant local pour dérouler un cycle complet création d'item →
assemblage → publication → tentative → note ; **migration pas encore
déployée en prod**.

**Reste à faire** :
- [ ] Assemblage réel d'une évaluation — tirage aléatoire (sections `pool`, `assessment_pool_rules`) : refusé explicitement, aucun exécuteur
- [ ] Simulation du barème sur des réponses exemples avant publication (ASM-013)
- [ ] Barèmes riches pour les 17 autres `item_type` (ranking « ordre partiel », matching, cloze, et les 8 types ASM-017-024) — aucun contrat de données, aucune UI d'auteur
- [ ] Nouveaux types d'interaction (passage, vidéo interactive, audio/vidéo, dessin, labeling, math/graphique, fichier, code — ASM-017 à ASM-024) : le schéma accepte n'importe quel `item_type`/`prompt` JSON mais aucun éditeur/lecteur n'existe pour ces types
- [ ] Rescore en masse avec prévisualisation d'impact (`rescore_jobs` posé, aucun exécuteur)
- [ ] Suggestions IA (génération, distracteurs, vérifications de biais/ambiguïté) — non-objectif partiel mais mentionné comme option V1
- [ ] Collections/permissions granulaires (voir/utiliser/commenter/modifier) — tables posées, UI ne gère que la création d'items

## 09 — Sondage live, Q&A, modération et coanimation

**Fait** : `live_events`/`live_runs`/`audience_questions` +
`cast_vote()`/`submit_live_response()` idempotents + `moderate_question()` +
`live_control_leases`. Depuis `20260811020000_live_engagement_participation.sql` :
`join_live_run()` (lobby, capacité atomique via verrou consultatif,
verrouillage, expulsion, reconnexion sans doublon — LIVE-004) +
`kick_participant()`/`lock_live_run()` (contrôle staff) +
`get_my_live_response()` (restaure la réponse déjà envoyée d'un
`client_id` — la moitié « reconnexion » de l'acceptance de LIVE-007) +
accès `anon` réellement câblé et vérifié contre `access_policy`
(`live_run_requires_auth()` appelée par `join_live_run`/
`submit_audience_question`/`cast_vote`/`submit_live_response` — LIVE-002,
sauf `allowlist` traité comme `authenticated` faute de table de liste
d'accès dans le modèle indicatif) + les 4 tables audience
(`audience_questions`/`live_interactions`/`live_runs`/`live_responses`)
poussées via `supabase_realtime`. Côté UI : écran public participant
(`/live`, `/live/:code`, `/live/:code/room` — `LiveEventJoin.tsx`/
`LiveEventRoom.tsx`) qui rejoint par code, pose/vote des questions et
s'abonne en Realtime aux changements de statut ; côté animateur,
`LiveEngagement.tsx` affiche désormais le lien de partage (copie
presse-papier), le nombre de participants actifs et un bouton
verrouiller/déverrouiller le run.

Depuis cette passe : écran projeté (`/live/:code/present`,
`LivePresenterScreen.tsx`) — lecture seule, pas de `join_live_run` (pas de
siège consommé, pas d'action de vote), s'appuie sur la policy déjà en place
`audience_questions_public_read` (event actif → lisible sans authentification,
le code est la seule barrière, comme la salle participant). Classement des
questions par votes, mis à jour via le même canal Realtime que
`LiveEventRoom` (`postgres_changes` sur `audience_questions`), plus un
abonnement `live_runs` pour refléter le verrouillage. Lien « Écran projeté »
ajouté dans la console animateur (`LiveEngagement.tsx`, ouvre un nouvel
onglet). Limité au Q&A — sondage/priorisation/matrice n'ont toujours aucun
éditeur staff, donc rien de réel à y afficher pour ces formats (LIVE-009 à
013 toujours ouverts). Vérifié : `tsc`/`eslint` propres ; testé dans Chrome
avec un code inexistant → état « indisponible » correctement rendu, aucune
erreur console — **non vérifié avec un run réel** (pas de compte staff local
pour créer un événement/run et confirmer le classement + le Realtime en
conditions réelles).

**Reste à faire** :
- [ ] Mode présentateur/console modérateur *distincts* pour l'animateur lui-même (LIVE-015 mentionne aussi ça) — l'écran projeté existe, mais l'animateur utilise toujours la même console (`LiveEngagement.tsx`) qu'avant, pas une vue « présentateur » séparée de la modération
- [x] UI d'expulsion — bouton « Expulser » par participant actif (`ParticipantManager`, dépliable depuis le compteur de participants dans `RunControls`)
- [ ] Répondre à un sondage/interaction (`live_interactions`/`submit_live_response()`/`get_my_live_response()` existent, mais aucune UI staff ne crée encore de `poll`/`priority`/`matrix`/etc., donc rien à répondre côté participant — construire l'écran de réponse avant l'éditeur staff serait deviner un format)
- [ ] Vraie table/mécanisme d'allowlist pour `access_policy = 'allowlist'` (actuellement traité comme `authenticated`, donc moins permissif que prévu plutôt que trop permissif — mais toujours pas ce que LIVE-002 décrit)
- [ ] Formats supplémentaires : priorisation, matrice 2×2, brainstorm, classement forcé (LIVE-009 à LIVE-013) — `live_interactions.kind` les accepte, aucun éditeur/lecteur
- [ ] Intégrations PowerPoint/Teams/Zoom (LIVE-017/018/019)
- [ ] Rapports post-session (participation, chronologie, export — LIVE-020 à LIVE-023)
- [ ] Rate limiting et filtre de termes assistant (modération)

## 10 — Gouvernance, versionnement, localisation et diffusion du contenu

**Fait** : `content_versions` (immuable, hash) + `publish_content_version()`
(garde de concurrence optimiste) + `restore_content_version()` +
`content_comments`/`review_requests`.

**Reste à faire** :
- [ ] Workflow de revue complet (état `in_review`/`changes_requested`/`approved`, invalidation d'approbation après modification — CNT-006/009) — les tables existent, le RPC de publication ne passe pas encore par ce workflow
- [ ] `content_deployments` réels (pinned vs follow-approved-updates, diff avant adoption — CNT-011/012) : table posée, jamais lue par les sessions/parcours qui consomment du contenu
- [ ] Modèles et blocs réutilisables (`content_templates`, `reusable_blocks`) — pas dans le modèle de données livré du tout
- [ ] Brand kits (CNT-019) — absents
- [ ] Gestion des assets (remplacement versionné, recherche d'usages avant suppression) — `media_assets`/`asset_usages` posés, aucun écran, aucun blocage de suppression implémenté
- [ ] Localisation complète (L10N-001 à L10N-006 : extraction de segments, glossaires, diff source, traduction IA) — non traitée du tout, explicitement hors scope de cette fondation
- [ ] Export SCORM/xAPI/cmi5/QTI (PUB-002/003) et liens de preview expirables (PUB-004)
- [ ] Comparaison structurelle entre versions (diff ajouts/suppressions/déplacements — CNT-003)

---

## Prochaines étapes suggérées (ordre proposé)

1. ~~**07 (agrégats analytics)**~~ — fait : projections journalières + génération de signaux de risque (voir §07). Reste ouvert : dashboards (consommateurs des projections) et psychométrie d'item (bloquée par 08).
2. ~~**09 (temps réel + participation anon + écran public participant)**~~ — fait : `join_live_run`/anon/Realtime + `/live/:code` + `/live/:code/room` (voir §09). Reste ouvert : l'écran projeté/grand écran séparé et la réponse aux formats sondage/priorisation/matrice (eux-mêmes bloqués par l'absence d'éditeur staff pour les créer).
3. ~~**01 (rubriques + gradebook consolidé)**~~ — fait (voir §01). Reste ouvert : import CSV/XLSX de notes (GBK-006), dashboards de visualisation (07).
4. ~~**04 (LTI 1.3 Core)**~~ — fait pour le lancement (voir §04). Reste ouvert, par ordre : SSO OIDC/SAML général (étape 1 de l'ordre de livraison, sautée pour attaquer LTI Tool en premier car c'est l'intégration la plus rentable), UI admin pour enregistrer une plateforme et relier un `sub`, Deep Linking/AGS/NRPS, puis QTI 3/SCIM/OneRoster/API publique.
5. Le reste (05 socle accessibilité transverse, 08 nouveaux types, 10 localisation) peut suivre l'ordre recommandé du README du programme.
