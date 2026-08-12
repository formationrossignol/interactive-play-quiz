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
affichées) et import (`GradebookImportDialog.tsx` + `gradebookImport.ts` +
`import_gradebook_csv()`, `20260812080000_gradebook_csv_import.sql`) :
première écriture directe, staff-initiée, dans `grade_items`/`grade_results`
(jusqu'ici seuls des triggers y écrivaient). Fichier CSV/XLSX parsé
côté client (`xlsx`, même lib que l'export, déjà lazy-importée ;
`assertSafeImportFile` réutilisé — risque ReDoS/prototype-pollution connu de
`xlsx` déjà accepté ailleurs, voir `fileValidation.ts`), mapping de colonnes
(identifiant/note) choisi par le staff, correspondance des personnes par nom
d'utilisateur contre l'effectif de session déjà chargé côté client (RLS,
pas de nouvel endpoint de résolution d'identité), prévisualisation ligne à
ligne avec statut (OK / apprenant introuvable / doublon — seule la première
occurrence est retenue / note hors barème). Seules les lignes `OK` sont
envoyées au RPC, qui revalide quand même chaque ligne côté serveur
(inscription réelle à la session, note dans `[0, max_points]`) et crée la
colonne + toutes les notes en tout-ou-rien — une ligne invalide annule tout
l'import plutôt que de laisser une colonne à moitié peuplée. Vérifié : les
deux migrations (07 + celle-ci) appliquées contre un schéma stub reproduisant
les vraies tables (Postgres jetable, `docker run postgres:15`), pas juste
relues — cas heureux (deux notes valides), apprenant non inscrit rejeté,
note hors barème rejetée, et dans chaque cas de rejet **rien** n'est resté en
base (transaction annulée dans son ensemble) ; `tsc --noEmit`/`eslint`
propres ; 5 tests unitaires sur `buildImportPreview`/`validImportRows`
(matching insensible à la casse et au `@`, doublon, note illisible/hors
barème) — **non vérifié avec des données réelles de session/gradebook**
(pas de compte staff/organisation de test disponible en local, même limite
que le reste de cette passe).

Depuis cette passe (`20260812150000_submission_file_uploads.sql`) : remise
fichier/audio/vidéo + URLs signées courte durée — deux items du reste-à-
faire qui n'en formaient qu'un : construire l'upload sans les URLs signées
aurait laissé un bucket privé sans moyen de le lire ; construire les URLs
signées sans upload n'aurait rien eu à signer. `submission_files` avait des
politiques `SELECT` (owner/staff) depuis la migration d'origine mais
**aucun écrivain** — ni RPC, ni policy `INSERT`. Nouveau bucket
`assignment-submissions`, **privé** (tous les autres buckets de ce repo
sont publics — `presentation-media`, `avatars` — celui-ci ne pouvait pas
l'être, une remise peut être confidentielle). RLS `storage.objects` :
convention de chemin `<learner_id>/<assignment_id>/<fichier>`, apprenant
(insert/select sur son propre premier segment de dossier, motif déjà
utilisé par le bucket `avatars`) et staff (select, second segment résolu
vers `assignments.org_id`) — c'est ce verrou-là, indépendant de
`submission_files`, qui protège réellement les octets : même un appel
`submit_assignment()` avec un chemin que l'appelant ne possède pas ne peut
jamais produire d'URL signée fonctionnelle pour le fichier de quelqu'un
d'autre. `submit_assignment()` gagne `p_files` (upload direct vers le
storage d'abord — les octets doivent exister avant l'appel —, puis
attaché atomiquement à la version créée ; re-vérifie que chaque chemin
appartient à l'appelant, échec net plutôt qu'une référence orpheline
silencieuse). Signature Postgres changée (5→6 paramètres) : l'ancien
overload à 5 paramètres est explicitement `drop`pé plutôt que laissé en
doublon — sans danger pour `gradebook.ts::submitAssignment()` qui appelle
déjà via des paramètres nommés (PostgREST résout par nom, `p_files`
omis utilise son défaut `null`). Téléchargement : `createSignedUrl()`
côté client (5 min), pas de nouvelle surface DB. UI apprenant
(`Assignments.tsx::LearnerAssignmentRow`, sélecteur de fichier remplace le
texte pour `response_mode` file/audio/video, `accept` filtré pour
audio/vidéo) et staff (`GradingPanel::SubmissionFilesList`, liens de
téléchargement par remise). Vérifié : migration appliquée contre un schéma
stub reproduisant les vraies tables **et** un schéma `storage` minimal
(Postgres jetable) — testé avec le rôle `authenticated` réel (pas
`postgres` superuser, qui contourne RLS) : upload dans son propre dossier
accepté, upload dans le dossier d'un autre apprenant rejeté par la vraie
RLS (`row-level security policy`, pas juste la logique applicative),
`submit_assignment()` avec fichiers attache bien les métadonnées à la
bonne version, chemin non possédé rejeté (`file_path_ownership_mismatch`),
appel historique sans `p_files` (paramètres nommés) toujours fonctionnel ;
`tsc`/`eslint` propres ; suite complète (335 tests) verte — **non vérifié
avec de vrais comptes/fichiers réels** (même limite que le reste du
programme). Non couvert : mode `combo`, l'enregistrement audio/vidéo dans
le navigateur (le champ fichier accepte un enregistrement déjà exporté,
pas un enregistreur intégré — hors scope, pas demandé par le modèle de
données).

**Régression trouvée et corrigée dans la foulée**
(`20260812160000_fix_submit_assignment_accommodation_regression.sql`) :
la réécriture de `submit_assignment()` ci-dessus s'était basée sur la
version *originale* (`20260810160000`) plutôt que sur la version
réellement en vigueur en prod (`20260811040000_accommodation_effective_dates.sql`,
spec 05), qui rendait le calcul de retard sensible aux aménagements
(`effective_assignment_due_at()` — `extended_deadline`/`no_time_limit`) et
émettait `submission.submitted` via `emit_learning_event()` à la
finalisation. Les deux ont été silencieusement écrasés par la migration
`...150000` — un apprenant avec aménagement aurait de nouveau été marqué
en retard à tort, et les finalisations auraient cessé d'émettre
l'événement dont dépendent `generate_risk_signals()` (règle `overdue`) et
les projections analytics. Repéré en relisant l'historique des migrations
*après* le déploiement de `...150000`, pas avant — corrigé par une
migration additive plutôt qu'une réécriture de `...150000` (déjà appliquée
en prod à ce moment-là), restaurant le corps correct avec `p_files` posé
par-dessus, rien d'autre changé. Vérifié : apprenant avec aménagement
`no_time_limit` actif, devoir échu depuis 2 jours, soumission avec fichier
→ `submitted` (pas `late`), fichier bien attaché, événement
`submission.submitted` émis avec `late:false`, ligne d'audit de lecture du
profil d'aménagement toujours écrite — les quatre comportements vérifiés
simultanément contre un schéma stub reproduisant les vraies tables
d'aménagement (Postgres jetable).

Depuis cette passe (`20260812180000_assignment_due_override.sql`) : UI
échéance dérogatoire par apprenant (`due_override`). La colonne et son seul
lecteur (`effective_assignment_due_at()`, spec 05) existaient déjà depuis
le travail d'aménagements — se compose déjà correctement avec
`extended_deadline`/`no_time_limit` et alimente `submit_assignment()` +
la règle `overdue` de `generate_risk_signals()`. Seul l'écran manquait.
Fait en creusant : `assignment_targets` n'avait **aucune contrainte
d'unicité** sur `(assignment_id, target_type, target_id)` — un écran qui
réécrit la même cible en boucle (rouvrir/soumettre) aurait dupliqué la
ligne au lieu de la mettre à jour ; dédupliqué puis contrainte unique
ajoutée avant tout. Pas de nouvelle RPC : `assignment_targets_manage`
(RLS, `20260810160000`) autorise déjà l'écriture directe propriétaire/
pedago/admin, comme `addAssignmentTarget()` le fait déjà pour le ciblage
par session — l'écran fait un upsert sur la nouvelle contrainte
(`setLearnerDueOverride()`) et un delete pour effacer
(`clearLearnerDueOverride()`, `gradebook.ts`). UI : panneau « Échéances
dérogatoires » dans `Assignments.tsx::DueOverridesPanel`, sous la section
correction de chaque devoir déplié — apprenant saisi par UUID (même
convention que `StaffAccommodations` dans `Accessibility.tsx` : aucun
sélecteur de liste n'existe dans ce fichier pour en construire un, le
ciblage par session lui-même n'étant pas câblé jusqu'au bout côté UI, voir
item suivant). Note documentée dans le code : effacer une dérogation
*supprime* la ligne de ciblage (pas juste le champ date) — retire aussi la
visibilité que cette ligne accordait à l'apprenant si rien d'autre ne le
cible, cohérent avec `assignment_visible_to_learner()` qui fait un OR sur
toutes les lignes de ciblage. **Non testé en conditions réelles** (même
limite que le reste de ce spec récemment : pas de compte staff/apprenant
local) — vérifié par lecture du SQL, `tsc`/`eslint` propres, migration
appliquée sans erreur (`supabase db push`, `migration list` confirmé
synchronisé).

**Reste à faire** :
- [ ] UI : `assignment_targets` par groupe/apprenant individuel — seul le ciblage par session est câblé
- [ ] Job serveur de scan antivirus des fichiers (`submission_files.scan_status`) — colonne prête, aucun job ; les fichiers uploadés restent `pending` indéfiniment
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

Depuis cette passe (`20260812100000_enrollment_csv_import.sql`) : import
CSV/XLSX de roster (ENR-014). `enroll_in_session()` gérait déjà l'inscription
d'un tiers par le staff, l'idempotence (une inscription active existante est
retournée telle quelle, jamais dupliquée) et la capacité/liste d'attente
atomiques — importer N lignes, c'est donc N appels côté client à cette RPC
déjà là, pas une nouvelle fonction bulk. Ce qui manquait réellement : un
moyen de transformer « une colonne d'emails ou de noms d'utilisateur » en
`learner_id`. Nouvelle RPC `resolve_org_members_by_identifier(org_id, kind,
identifiers[])` — ne résout un identifiant que s'il appartient à un membre
*déjà* réel de l'organisation (jointure `user_org_roles`) ; `enrollments.
learner_id` référence `auth.users` sans colonne « pending » (contrairement à
`share_group_members.pending_email`), donc inventer un compte pour un
identifiant inconnu aurait été le terrain d'ENR-013 (auto-inscription/
provisioning), pas celui-ci — un identifiant non résolu reste une ligne
d'erreur, jamais une invention silencieuse. Extraction de
`parseSpreadsheetRows()` (auparavant dans `gradebookImport.ts`) vers
`lib/importSpreadsheet.ts`, réutilisé tel quel plutôt que dupliqué.
Prévisualisation (`buildEnrollmentPreview()` dans `enrollmentImport.ts`) :
statut par ligne OK/introuvable/doublon (garde la première occurrence)/déjà
inscrit (détecté avant l'import plutôt que découvert silencieusement après
un no-op de `enroll_in_session()`). UI : bouton « Importer » par session
(`Sessions.tsx::StaffSessions`), dialogue avec choix de la colonne
identifiant + type (email/nom d'utilisateur), tableau de prévisualisation,
rapport CSV téléchargeable (identifiant, apprenant résolu, statut, résultat
d'import — `EnrollmentImportDialog.tsx`). Vérifié : migration appliquée
contre un schéma stub reproduisant les vraies tables (Postgres jetable) —
un utilisateur réel d'une autre organisation ne résout jamais (jointure
`user_org_roles` scopée à l'org cible), un identifiant inconnu ne résout
pas, correspondance email/nom d'utilisateur insensible à la casse et au
`@` vérifiée, type invalide rejeté ; 7 tests unitaires sur
`buildEnrollmentPreview`/`importableEnrollmentRows` ; `tsc`/`eslint`
propres ; suite complète (335 tests) verte — **non vérifié avec des
comptes/organisation réels** (même limite que le reste de cette passe).

Depuis cette passe (`20260812110000_enrollment_bulk_actions.sql`) : actions
en masse (ENR-015, partiel). `transition_enrollment()`/`enroll_in_session()`
géraient déjà l'autorisation staff, l'audit et l'idempotence individuellement
— annuler et déplacer les réutilisent tels quels côté client sur une
sélection multiple plutôt que d'ajouter une nouvelle primitive bulk ;
déplacer est un retrait puis une réinscription (deux appels existants), pas
une transaction atomique : si le deuxième appel échoue après le premier,
l'apprenant se retrouve inscrit nulle part plutôt que dupliqué, et cette
ligne remonte « échec » dans le rapport plutôt que d'être masquée. Seul
« prolonger » avait besoin d'un nouvel écrivain : `effective_due_at` n'était
touché par rien après la création de l'inscription.
`extend_enrollment_due_date()` l'écrit et journalise l'ancien/nouveau via
`enrollment_history` (`from_status`/`to_status` inchangés puisqu'il ne
s'agit pas d'une transition de statut ; l'ancien/nouveau créneau vit dans
`reason` — un seul journal d'audit par inscription plutôt que d'en ajouter
un second). UI : panneau « Effectif » dépliable par session
(`SessionRosterPanel.tsx`, `Sessions.tsx::StaffSessions`), sélection
multiple, motif partagé optionnel, rapport OK/échec par ligne après
exécution. **Non repris** : « inscrire » (ENR-014 le couvre déjà),
« affecter un formateur » (`session_trainers` est déjà en écriture directe
via RLS `for all`, mais c'est une action de session, pas une action sur
l'effectif sélectionné), « envoyer une relance » (contenu/déclenchement pas
défini — recoupe le blocage « notifications programmées » de 01/07 en tête
de RESTE-A-FAIRE.md). Vérifié : migration appliquée contre un schéma stub
(Postgres jetable) — `effective_due_at` mis à jour, `enrollment_history`
porte bien l'ancien → nouveau créneau ; `tsc`/`eslint` propres ; suite
complète (335 tests) verte — **non vérifié avec des inscriptions réelles**
(même limite que le reste de cette passe).

Depuis cette passe (`20260812190000_attendance_events.sql`) :
`attendance_events`. Le modèle indicatif de la spec (une ligne : « présence
déclarée/importée, facultatif V1 ») ne donne ni colonnes ni RPC ni écran —
tout restait à concevoir. Constat en creusant : `course_sessions` n'a
qu'une seule fenêtre `starts_at`/`ends_at`, aucune notion de séance/
occurrence individuelle (`planning_events`, 20260812030000, est un
calendrier personnel sans rapport). Plutôt que d'inventer une table
d'occurrences — projet à part entière que rien ne demande — l'unité
retenue est (session, apprenant, jour calendaire) : `record_attendance()`
fait un upsert sur cette clé, une re-saisie du même jour corrige la ligne
au lieu d'empiler un historique (pas de table d'audit séparée non plus —
cohérent avec le « facultatif V1 » de la spec). Écriture jamais directe :
même posture que `enroll_in_session()`/`extend_enrollment_due_date()` —
`record_attendance()` vérifie `registrar`/`pedago`/`admin` OU formateur de
cette session précise (`session_trainers`), correspondant au texte de la
spec (le formateur « voit ses sessions et les apprenants actifs »).
Émet aussi `attendance.recorded` via `emit_learning_event()` (même
convention que `enrollment.started`/`grade.published`) pour alimenter les
analytics spec 07 plus tard, sans que ce soit un objectif de cette passe.
UI : nouveau composant `SessionAttendancePanel.tsx`, bouton « Présence »
à côté de « Effectif » dans `Sessions.tsx::StaffSessions` — sélecteur de
date, table apprenant × 4 boutons de statut (présent/retard/excusé/absent),
action « Tout marquer présent ». **Non testé en conditions réelles** (même
limite que le reste de cette passe : pas de compte staff/apprenant local)
— vérifié par lecture du SQL, `tsc`/`eslint` propres, migration appliquée
sans erreur (`supabase db push`, `migration list` confirmé synchronisé).

**Reste à faire** :
- [ ] UI : « affecter un formateur » en masse et « envoyer une relance » (ENR-015, reste de la liste)
- [ ] Auto-inscription avec règles (domaine email, code, paiement, prérequis — ENR-013)
- [ ] Vue apprenant « Mes formations » complète avec dates effectives/échéances relatives recalculées (ENR-017, la V1 actuelle liste juste par statut)
- [ ] Calcul de complétion versionné par politique (activités obligatoires, score, présence — `attendance_events` fournit maintenant la matière première présence, le calcul lui-même reste à écrire)

## 03 — Compétences, résultats d'apprentissage et preuves

**Fait** : `competency_frameworks`/`competencies`/`mastery_scales`/
`competency_evidence` + `record_competency_evidence()` +
`recompute_competency_mastery()` (idempotent, historisé).

Depuis cette passe : UI d'alignement (CMP-010/011, partiel) —
`AlignmentManager` dans `Competencies.tsx`, bouton « Aligner » par
compétence dans un référentiel. `competency_alignments.target_id` est
polymorphe sans FK (par design, cf. commentaire de la migration) ; deux
`target_type` seulement ont un vrai sélecteur ici — `assignment` (réutilise
`listOrgAssignments()` de `gradebook.ts`, déjà org-scopé) et
`rubric_criterion` (réutilise `listOrgRubrics()`/`getRubricCriteria()`,
sélection grille puis critère). Coefficient, rôle de preuve
(`teaching`/`practice`/`assessment`), obligatoire. Pas de nouvelle
migration : `competency_alignments_manage` (`for all`, pedago/admin) permet
déjà l'insert/delete direct côté client — même posture que les critères de
rubrique. **Les 7 autres `target_type`** (course/module/lesson/question/
exam/scorm_activity/h5p_activity/path_step) n'ont pas de sélecteur : aucun
n'a de fonction de liste org-scopée cohérente dans ce codebase aujourd'hui
— `exam` par exemple est scopé par `host_id`, pas par organisation (système
Tier-1 pré-existant), et course/module/lesson/path_step n'ont pas
d'équivalent table clair à côté de `content`. Deviner un sélecteur pour ces
types aurait été un choix arbitraire, pas une lecture du modèle existant.
Vérifié : `tsc`/`eslint` propres (avertissements a11y corrigés — labels
associés à leurs champs) ; suite complète (335 tests) verte — pas de
nouveaux tests unitaires (fonctions CRUD directes sur RLS déjà exercées par
les tests d'intégration Supabase existants ailleurs, rien de nouveau à
isoler ici) ; **non vérifié avec des données réelles** (même limite que le
reste du programme).

Depuis cette passe (`20260812120000_competency_aggregation_methods.sql`) :
méthodes d'agrégation configurables (CMP-007), les 5 nommées par la spec.
`competency_evidence_position()` (nouvelle fonction partagée) résout une
preuve en position sur l'échelle, qu'elle porte un `level_code` explicite
ou un `raw_score` lu à travers les seuils — le même calcul à deux voies que
faisait déjà « dernière preuve », maintenant réutilisé par les quatre
autres. Meilleure preuve : position max parmi les preuves non annulées.
Moyenne pondérée : moyenne des positions pondérée par
`competency_alignments.weight` (poids 1 si la preuve n'a pas d'alignement —
saisie manuelle/import), arrondie à la position définie la plus proche.
N preuves récentes : moyenne non pondérée des N dernières preuves
(`mastery_scales.recent_n`, nouvelle colonne). Validation manuelle :
`recompute_competency_mastery()` devient un no-op délibéré (la preuve est
quand même journalisée, seul le niveau n'est pas recalculé) —
`set_manual_mastery_level()` (nouveau, staff, motif obligatoire, audité
dans `competency_mastery_history` comme toute autre transition) est le seul
écrivain tant que la méthode reste `manual`, et refuse si l'échelle n'est
pas réellement en ce mode. Une preuve avec ni `level_code` résolvable ni
`raw_score` dans les seuils ne contribue à rien pour meilleure/moyenne/N-
récentes (exclue, jamais traitée comme zéro).

Gap réel trouvé en construisant ceci, pas anticipé : `mastery_scales`/
`mastery_scale_levels` (CMP-006) avaient une RLS `for all` (pedago/admin)
depuis la migration d'origine mais **aucune UI n'y avait jamais écrit** —
sans échelle par défaut, `recompute_competency_mastery()` retombait déjà
silencieusement sur `not_assessed`, ce qui aurait rendu toute méthode
configurée invisible/inatteignable. CRUD minimal ajouté dans le même passage
(`MasteryScaleManager` dans `Competencies.tsx`, écriture directe côté
client — pas de nouvelle RPC, RLS déjà ouverte) : créer l'échelle par
défaut, ajouter des niveaux (code/libellé/position/seuil), choisir la
méthode (+ N pour « N preuves récentes »). `SetMasteryLevelPanel` (dans
`FrameworkCompetencies`, ne s'affiche que si l'échelle par défaut est en
mode `manual`) : recherche d'apprenant (`PersonPicker`, réutilisé tel
quel — le champ « inviter par email » reste présent mais rejette
explicitement, fixer un niveau exige un compte existant), sélection du
niveau, motif obligatoire. Vérifié : migration appliquée contre un schéma
stub (Postgres jetable) — les 5 méthodes testées sur le même jeu de 3
preuves (débutant/maîtrisé/en acquisition dans cet ordre chronologique)
donnent chacune le résultat attendu (dernière→en acquisition,
meilleure→maîtrisé, moyenne pondérée non pondérée→en acquisition, N=2
récentes→maîtrisé), passage en mode manuel confirmé sans effet sur
`recompute`, `set_manual_mastery_level()` change bien le niveau et
l'historise avec le vrai motif, rejet confirmé si l'échelle n'est pas en
mode manuel ; `tsc`/`eslint` propres ; suite complète (335 tests) verte —
**non vérifié avec des données réelles** (même limite que le reste du
programme).

Depuis cette passe : UI de demande de revue (CMP-018). RLS était déjà
ouverte des deux côtés (`competency_review_requests_learner_insert` :
`learner_id = auth.uid()` — un apprenant ne peut jamais créer une demande
au nom d'un autre ; `competency_review_requests_staff` : `for all`,
pedago/admin) depuis la migration d'origine, donc pas de nouvelle
migration. Apprenant (`LearnerMastery`) : bouton « Demander une revue » par
ligne de maîtrise, désactivé s'il existe déjà une demande `open` pour cette
compétence (évite le spam d'une même demande), message obligatoire,
liste des demandes déjà envoyées avec leur statut sous chaque compétence —
jamais de bouton pour modifier le niveau soi-même (CMP-018 à la lettre :
« il ne peut pas la modifier »). Staff (`ReviewRequestsPanel`, nouveau
panneau dans la vue staff) : liste des demandes `open` de l'organisation,
résoudre/rejeter (met à jour `status`/`resolved_at` directement, RLS déjà
suffisante). Scopé aux demandes de niveau **maîtrise** — `evidence_id`
reste toujours nul : `myMastery()` ne renvoie que le niveau calculé, jamais
les lignes `competency_evidence` individuelles, donc l'UI apprenant n'a
rien de plus précis à désigner pour l'instant. Vérifié : `tsc`/`eslint`
propres ; suite complète (335 tests) verte — pas de nouveaux tests
unitaires (CRUD direct sur RLS déjà correcte, rien à isoler côté logique
pure) ; **non vérifié avec des données réelles** (même limite que le reste
du programme).

Depuis cette passe : vue formateur groupe × compétences (CMP-020),
`TrainerGroupMatrix`. Jusqu'ici la page `/lms/competencies` ne distinguait
que staff (`pedago`/`admin`) et apprenant — le rôle `trainer` tombait dans
la vue apprenant, ce qui n'avait pas de sens pour cette vue spécifique ;
nouvel ensemble `TRAINER_ROLES` (`trainer`/`pedago`/`admin`) contrôle
l'affichage de la matrice, les panneaux d'administration (référentiels,
échelle de maîtrise, demandes de revue) restant réservés à `pedago`/
`admin`. « Groupe » = les `share_groups` du formateur lui-même — le même
modèle personnel déjà utilisé pour le ciblage de devoirs/partage de
contenu ailleurs dans ce codebase, pas un regroupement au niveau de
l'organisation (aucun n'existe dans le modèle de données pour ça).
Sélection groupe + référentiel publié → matrice apprenant × compétence,
seuil de maîtrise attendu configurable (depuis les niveaux de l'échelle par
défaut) colorant les cellules en dessous du seuil comme écart. Clic sur une
cellule → `listCompetencyEvidence()`, les preuves individuelles de cet
apprenant pour cette compétence (« accès aux preuves autorisées » —
`competency_evidence_staff_read` couvrait déjà `trainer`, aucune nouvelle
politique). Pas de nouvelle migration : `competency_mastery_staff_read`
couvrait déjà `trainer`/`pedago`/`registrar`/`admin`, `listMasteryForLearners()`
est un simple `select ... in()` scopé aux compétences/apprenants affichés.
Vérifié : `tsc`/`eslint` propres ; suite complète (335 tests) verte —
**non vérifié avec des données réelles** (même limite que le reste du
programme).

**Reste à faire** :
- [ ] UI : alignement sur les 7 autres `target_type` (course/module/lesson/question/exam/scorm_activity/h5p_activity/path_step) — pas de sélecteur org-scopé cohérent pour ces types
- [ ] UI : vue couverture programme (enseigné/pratiqué/évalué — CMP-012, CMP-021)
- [ ] Écran de migration des tags existants → compétences (mapping guidé, section « Migration des tags existants » de la spec)
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

Depuis cette passe (`20260812130000_release_state_date_and_sweep.sql`) :
évaluateur `date` + balayage planifié — deux items du reste-à-faire qui
n'en formaient qu'un dans les faits. Construire l'évaluateur `date` seul
sans balayage aurait été inutile : `recompute_release_state()` ne tourne
que sur les 3 triggers événementiels existants (devoir/examen/note), jamais
sur le simple écoulement du temps — une règle faite uniquement d'une
condition de date serait donc restée figée à son dernier calcul jusqu'à un
événement d'apprentissage sans rapport. `pg_cron` existant déjà (07),
`_sweep_release_state_internal(org_id)` (nouveau, jamais accordé à
`authenticated`/`anon`, seul le scheduler l'appelle) rejoue
`recompute_release_state()` pour chaque apprenant activement inscrit d'une
org ; branché comme 3ᵉ étape isolée (son propre bloc `exception when
others`) dans `run_scheduled_lms_analytics_jobs()`, qui tournait déjà
chaque nuit pour les deux étapes analytics/risque — introduit aucune
nouvelle surface de privilège : `recompute_release_state()` reste appelé
exactement comme le font déjà les 3 triggers existants, sans contrôle
`auth.uid()` ajouté (en ajouter un aurait cassé le recompute déclenché par
la propre soumission d'un apprenant, qui s'exécute avec son identité, pas
celle d'un administrateur). `evaluate_rule_definition()` gère
`{source:"date", operator:"after"|"before", value}` — `score`/`compétence`
restent en échec fermé, chacun a besoin de sa propre résolution (quel
score ? quelle échelle de compétence ?), pas devinée ici. UI :
`Automation.tsx::RuleSets` — sélecteur de type de condition (activité
terminée / date), champ date-heure natif pour la seconde. Toujours une
seule condition par règle, pas de AND/OR (reste ouvert). Vérifié :
migration appliquée contre un schéma stub (Postgres jetable) — date passée
→ `unlocked`, date future → `locked`/`prerequisite_not_met`, opérateur
`before` correct, source inconnue (`score`) toujours en échec fermé,
`run_scheduled_lms_analytics_jobs()` isole bien l'échec des deux autres
étapes (fonctions absentes dans le stub) sans empêcher le balayage de
s'exécuter, rejeu idempotent (upsert, pas de doublon) ; `tsc`/`eslint`
propres ; suite complète (335 tests) verte — **non déployé/testé en prod
au moment de ce commit**, et non vérifiable en conditions réelles sans
attendre une exécution nocturne après déploiement (même limite que le
reste du programme pour tout ce qui dépend du cron).

**Reste à faire** :
- [ ] UI de construction en phrases « Quand [condition], alors [action] » — l'UI actuelle construit une seule condition à la fois (`activity_completed` ou `date`), pas le DSL complet (AND/OR, groupes, scores, compétences...)
- [ ] Évaluateur pour les sources `score`/`compétence` — le DSL les accepte et les affiche, `evaluate_rule_definition()` les traite toujours en échec fermé
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

Depuis cette passe (`20260812170000_analytics_privacy_threshold.sql`) :
seuil minimal anti-réidentification (ANA-020). Constat en creusant la spec :
ce n'était pas seulement une fonctionnalité de comparaison de cohortes
jamais construite — `analytics_daily_enrollment`/`analytics_daily_competency`/
`analytics_daily_item` avaient une policy `..._staff_read` sans aucun
plancher de cardinalité, et le client (`analyticsDashboard.ts`) sélectionnait
toutes les lignes (par session/compétence/item_revision, par jour) avant de
sommer côté client dans `Analytics.tsx` — les lignes brutes à petit N (ex. une
session à 2 apprenants) étaient donc déjà accessibles sur le fil par le même
appel PostgREST que n'importe quel staff peut inspecter, exactement le
vecteur « combinaison rare » que la section confidentialité de la spec vise.
`analytics_daily_activity` non touchée : par construction par-apprenant,
déjà un accès pédagogique individuel légitime, pas une comparaison de
cohorte. Fix : les 3 policies `..._staff_read` supprimées (plus de lecture
directe des lignes brutes) remplacées par 3 fonctions `security definer`
(`get_org_enrollment_totals`/`get_daily_competency_totals`/`get_daily_item_totals`)
qui n'agrègent qu'à org+jour — aucun `session_id`/`competency_id`/
`item_revision_id` ne sort plus de la base — et suppriment la période
entière (au lieu d'afficher un petit nombre) quand la population sous-
jacente passe sous un seuil configurable par org (`analytics_privacy_settings`,
même forme que `risk_signal_settings` : lecture staff, gestion
`pedago`/`admin` via `set_min_cohort_size()`, défaut 5). UI : bandeau
« masquées » sur les tuiles d'inscription si `suppressed=true`, jours
manquants dans le graphique compétence (déjà « sparse par design », un jour
manquant se comportait déjà comme une absence de rollup). Panneau
« Confidentialité » ajouté à `/lms/analytics`, visible `pedago`/`admin`
seulement, pour lire/modifier le seuil. `get_daily_item_totals` corrigé en
même temps bien qu'aucun écran ne le consomme encore (ANA-010/011/012 pas
construits) — la table était déjà en prod et exposée en clair par la même
faille, pas laissée pour la prochaine personne à découvrir. **Non testé en
conditions réelles** (même limite que le reste de ce spec : pas de compte
staff local pour vérifier qu'une organisation sous le seuil voit
effectivement le bandeau masqué) — vérifié uniquement par relecture du SQL
et par l'application propre de la migration (`supabase db push`,
`supabase migration list` confirmé synchronisé).

**Reste à faire** :
- [ ] Projection journalière **programme** — jamais définie faute de UI/agrégat programme existant à côté de session/offering
- [ ] Dashboard apprenant (ANA-005) — bloqué par l'absence de politique RLS lecture-apprenant sur `analytics_daily_activity`/`analytics_daily_enrollment`/`analytics_daily_competency`/`analytics_daily_item`
- [ ] Analyse d'items / psychométrie (ANA-010 distracteurs par groupe de performance, ANA-011 difficulté/discrimination, ANA-012 avertissements) — `analytics_daily_item` fournit le compte/taux de base, pas la répartition par option ni le découpage en quartiles nécessaires à ces trois-là
- [ ] Temps médian de réponse par item (ANA-009) — bloqué par l'absence de toute colonne de durée sur `assessment_responses`
- [ ] Programmation de rapports (`report_schedules`/`report_runs`) — tables posées, aucun exécuteur ; pourrait maintenant se brancher sur le même `pg_cron`
- [ ] Export CSV/XLSX/PDF avec pseudonymisation

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

Depuis cette passe (`20260812090000_live_poll_interactions.sql`) : éditeur
staff et écran de réponse participant pour `poll` — le premier des formats
listés dans `live_interactions.kind` à en avoir un. `live_interactions`
n'avait aucun `created_at` (les brouillons n'ont ni `opened_at` ni
`closed_at`, donc aucun moyen d'ordonner la liste d'un run) : colonne
ajoutée. `open_live_interaction()`/`close_live_interaction()` : la policy
RLS `live_interactions_staff` (`for all`) permettait déjà l'insert/update
direct côté client, donc pas de RPC pour la création — mais l'invariant « un
seul live par run à la fois » (ferme automatiquement tout autre `live` du
même run à l'ouverture, même principe que l'autorité de navigation unique
de `live_control_leases`/LIVE-007) ne pouvait pas s'exprimer sans race côté
client, d'où ces deux RPC pour les seules transitions d'état. Contrat
`config`/`payload` pour `poll` (jusqu'ici jsonb totalement libre) :
`config = {question, options: [{id, label}], allowMultiple}`,
`payload = {optionIds: string[]}` (toujours un tableau, même en choix
simple). Staff (`LiveEngagement.tsx::InteractionManager`) : formulaire de
création (question + options dynamiques + choix simple/multiple), liste des
sondages du run avec Ouvrir/Fermer, résultats en direct par option
(pourcentages + barres, Realtime sur `live_responses` tant que le sondage
est `live`). Participant (`LiveEventRoom.tsx::LivePollWidget`) : apparaît/
disparaît via Realtime sur `live_interactions`, réponse restaurée à la
reconnexion via `get_my_live_response()`, modifiable tant que `live`
(upsert idempotent déjà garanti par `submit_live_response()`). Vérifié :
migration appliquée contre un schéma stub reproduisant les vraies tables
(Postgres jetable) — ouvrir un 2ᵉ sondage ferme bien le 1ᵉʳ automatiquement
avec `closed_at` renseigné, fermer un sondage déjà fermé est rejeté
(`interaction_not_live`) ; `tsc`/`eslint` propres sur les fichiers touchés ;
suite de tests complète (328 tests) toujours verte. **Non couvert** :
`priority`/`matrix`/`brainstorm`/`ranking` (contrat différent pour chacun,
pas deviné ici) et l'écran projeté (`LivePresenterScreen.tsx` reste Q&A
seul, n'affiche pas les sondages) ; **non vérifié avec un run réel** (même
limite que le reste du programme, pas de compte staff/participant local
pour dérouler un cycle complet).

Depuis cette passe (`20260812140000_live_event_allowlist.sql`) : vraie
allowlist (LIVE-002). `live_run_requires_auth()` traitait déjà
`allowlist` comme `authenticated` (authentification exigée) — cette moitié
restait correcte et n'a pas changé ; ce qui manquait, c'est que rien ne
vérifiait ensuite l'email de l'appelant contre une vraie liste. Nouvelle
table `live_event_allowlist` (unicité `(event_id, lower(email))` —
« Foo@x.com » et « foo@x.com » sont la même entrée, pas deux quasi-doublons
à repérer manuellement), nouvelle fonction `live_run_allowlist_ok()` (no-op
pour toute `access_policy` autre que `allowlist`, échec fermé si pas
d'`auth.uid()` ou pas de ligne correspondante) ajoutée comme second
contrôle **indépendant** sur les 4 points d'entrée participant déjà gatés
par `live_run_requires_auth()` (`join_live_run`/`submit_audience_question`/
`cast_vote`/`submit_live_response`) — additif, jamais un remplacement.
Gap réel trouvé en construisant ceci : rien ne permettait même de *choisir*
`access_policy` à la création d'un événement (`createLiveEvent()` codait
`anonymous` en dur) — la politique `allowlist` était inatteignable depuis
l'UI ; sélecteur ajouté au formulaire de création. `AllowlistManager`
(nouveau, par événement, visible seulement si `access_policy =
'allowlist'`) : ajouter/retirer des emails. Vérifié : migration appliquée
contre un schéma stub (Postgres jetable) avec un `auth.uid()` simulé par
variable de session pour incarner différents appelants — appelant anonyme
toujours rejeté (comportement `authenticated` inchangé), appelant
authentifié mais absent de la liste rejeté avec le nouveau message,
correspondance email insensible à la casse acceptée, un événement
`anonymous` non affecté (no-op confirmé) ; `tsc`/`eslint` propres ; suite
complète (335 tests) verte — **non vérifié avec un run réel** (même
limite que le reste du programme).

**Reste à faire** :
- [ ] Mode présentateur/console modérateur *distincts* pour l'animateur lui-même (LIVE-015 mentionne aussi ça) — l'écran projeté existe, mais l'animateur utilise toujours la même console (`LiveEngagement.tsx`) qu'avant, pas une vue « présentateur » séparée de la modération
- [x] UI d'expulsion — bouton « Expulser » par participant actif (`ParticipantManager`, dépliable depuis le compteur de participants dans `RunControls`)
- [x] Répondre à un sondage (`poll`) — voir ci-dessus. **Reste** : `priority`/`matrix`/`brainstorm`/`ranking` n'ont toujours ni éditeur ni écran de réponse
- [x] Vraie table/mécanisme d'allowlist pour `access_policy = 'allowlist'` — voir ci-dessus
- [ ] Formats supplémentaires : priorisation, matrice 2×2, brainstorm, classement forcé (LIVE-009 à LIVE-013) — `live_interactions.kind` les accepte, aucun éditeur/lecteur pour ces quatre-là
- [ ] Sondages sur l'écran projeté (`LivePresenterScreen.tsx`) — l'éditeur/résultats staff et le widget participant existent, l'écran public n'en affiche toujours aucun
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
3. ~~**01 (rubriques + gradebook consolidé)**~~ — fait, y compris l'import CSV/XLSX (GBK-006, voir §01). Reste ouvert : dashboards de visualisation (07).
4. ~~**04 (LTI 1.3 Core)**~~ — fait pour le lancement (voir §04). Reste ouvert, par ordre : SSO OIDC/SAML général (étape 1 de l'ordre de livraison, sautée pour attaquer LTI Tool en premier car c'est l'intégration la plus rentable), UI admin pour enregistrer une plateforme et relier un `sub`, Deep Linking/AGS/NRPS, puis QTI 3/SCIM/OneRoster/API publique.
5. Le reste (05 socle accessibilité transverse, 08 nouveaux types, 10 localisation) peut suivre l'ordre recommandé du README du programme.
