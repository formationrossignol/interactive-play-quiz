# Reste à faire — Programme LMS

Date : 2026-08-11

Backlog consolidé, pur — pas de « fait », pas de récit. Pour le détail de ce
qui est déjà fait/vérifié et pourquoi, voir `VALIDATION-STATUS.md`. Chaque
item ici reste formulé exactement comme dans ce document source, pour
pouvoir s'y référer facilement.

## Dépendances qui bloquent plusieurs items à la fois

- ~~**Aucun ordonnanceur (cron/scheduler) n'existe dans ce repo.**~~
  `pg_cron` activé (`20260812020000_scheduler.sql`) : job nocturne
  `lms-daily-analytics-and-risk-signals` (3h du matin), appelle
  `run_daily_analytics_rollup()`/`generate_risk_signals()` pour chaque
  organisation, isolé par org (l'échec d'une organisation n'annule pas les
  autres). Les deux RPC contrôlaient l'admin via `auth.uid()` — sans
  signification pour un job cron sans JWT — donc chacune a été scindée en
  wrapper vérifié (signature/comportement inchangés) + fonction interne non
  vérifiée, jamais accordée à `authenticated`/`anon`. Reste bloqué par
  l'absence de logique métier (pas seulement de planification) : les
  rappels d'échéance J-7/J-1 (01), les notifications programmées (01), le
  balayage planifié de `release_state` (06), les synchronisations
  SCIM/OneRoster planifiées (04), la livraison de webhooks en file (04) —
  l'infrastructure existe maintenant pour les brancher, mais aucune de ces
  fonctions n'existe encore.
- ~~**Le moteur de correction de la spec 08 (`item_answer_keys` jamais lu)**~~
  `submit_assessment_response()` le lit désormais (`20260812060000_assessment_correction_engine.sql`,
  voir §08). Débloque réellement la projection journalière **item**, faite
  depuis (`20260812070000_analytics_daily_item.sql`, voir §07) — la
  psychométrie ANA-010/011/012 reste ouverte, elle a besoin d'un agrégat
  plus riche (répartition par option, quartiles de score) que ce que cette
  projection écrit. **Ne débloque pas `extra_time` (05)** : ce moteur note `assessment_items`
  (le système spec 08), pas `exam_attempts` (le système d'examen
  pré-existant, Tier-1, sur lequel `extra_time` porte réellement) — ce
  sont deux systèmes parallèles distincts, jamais réconciliés (voir
  « Réconciliation » en bas de ce document). `assessment_attempts` n'a
  d'ailleurs aucune notion de durée/limite de temps du tout.
- ~~**Aucune UI staff ne crée de sondage/priorisation/matrice** (spec 09)~~
  fait pour **sondage** (`20260812090000_live_poll_interactions.sql`, voir
  §09) — l'écran de réponse participant qui en dépendait est fait avec.
  Reste bloqué pour priorisation/matrice/brainstorm/classement forcé : leur
  éditeur (et donc leur écran de réponse) n'existe toujours pas.
- ~~**`/lti/unlinked` est un cul-de-sac réel**~~ résolu par l'UI admin LTI
  (voir §04) : enregistrement, déploiements et `link_lti_subject()`.

## 01 — Devoirs, remises et carnet de notes

- [ ] UI : remise fichier/audio/vidéo — seul le mode texte est câblé côté client (`response_mode` en DB supporte déjà file/url/audio/video)
- [ ] UI : `assignment_targets` par groupe/apprenant individuel — seul le ciblage par session est câblé
- [ ] UI : échéance/aménagement dérogatoire par apprenant (`due_override`) — colonne existe, aucun écran
- [x] UI : vue gradebook consolidée (GBK-001 à GBK-006) — `/lms/gradebook` : matrice apprenant × grade_item par session, sous-totaux par catégorie avec coefficient (`grade_items.weight`) et exclusion de la plus basse note togglable, formule exposée par total (GBK-004), export CSV/XLSX/PDF neutralisant les formules et import CSV/XLSX (GBK-006 — `import_gradebook_csv()`, `20260812080000_gradebook_csv_import.sql` : nouvelle colonne `grade_items` source_type='manual' + `grade_results`, correspondance des personnes par nom d'utilisateur côté client contre l'effectif de la session déjà chargé, prévisualisation avec statut par ligne — OK/introuvable/doublon/note hors barème —, tout-ou-rien server-side), simulation apprenant « si je reçois X » client-only dans « Mes notes » (GBK-005). **Reste** : dashboards visuels (07)
- [ ] Job serveur de scan antivirus des fichiers (`submission_files.scan_status`) — colonne prête, aucun job
- [ ] URLs de téléchargement signées courte durée pour les fichiers
- [ ] Connecteur antiplagiat (interface only — non-objectif V1 explicite, mais l'interface elle-même n'existe pas)
- [ ] Notifications programmées (J-7/J-1/retard) — table `notifications` existe, rien ne les déclenche pour les devoirs (bloqué par : pas d'ordonnanceur)
- [ ] Double correction / correction anonyme (GRD-005) — colonne `is_anonymous` posée, pas de flux de levée d'anonymat auditée

## 02 — Inscriptions, sessions et gestion des apprenants

- [x] UI : import CSV/XLSX avec prévisualisation/mapping/doublons (ENR-014) — `resolve_org_members_by_identifier()` (`20260812100000_enrollment_csv_import.sql`, email ou nom d'utilisateur, scopé aux membres réels de l'org via `user_org_roles` — ne devine jamais un compte pour un identifiant inconnu), boucle client sur `enroll_in_session()` déjà idempotent/atomique (pas de nouvelle RPC bulk). Prévisualisation avec statut par ligne (OK/introuvable/doublon/déjà inscrit) et rapport CSV téléchargeable (`EnrollmentImportDialog.tsx`, bouton « Importer » par session dans `Sessions.tsx`)
- [x] UI : actions en masse (déplacer, annuler, prolonger — ENR-015 partiel) — `SessionRosterPanel.tsx` (panneau « Effectif » par session dans `Sessions.tsx`), sélection multiple, motif optionnel partagé, rapport par ligne (OK/échec). Prolonger : `extend_enrollment_due_date()` (`20260812110000_enrollment_bulk_actions.sql`, premier writer de `effective_due_at` après création, audité dans `enrollment_history`). Annuler/déplacer réutilisent `transition_enrollment()`/`enroll_in_session()` tels quels (déplacer = retrait puis réinscription orchestrés côté client, pas une nouvelle primitive atomique). **Reste** : « inscrire » non dupliqué (couvert par ENR-014), « affecter un formateur » (session_trainers est déjà en écriture directe RLS, pas vraiment une action de masse sur l'effectif sélectionné), « envoyer une relance » (contenu/déclenchement pas défini, recoupe le blocage notifications programmées de 01/07)
- [x] UI : écran participant pour voir/accepter/décliner une offre de liste d'attente — bandeau « Une place s'est libérée » dans « Mes formations » (`Sessions.tsx::WaitlistOffers`), compte à rebours 48h, accepter/refuser appellent `accept_waitlist_offer()`/`decline_waitlist_offer()` directement
- [ ] Auto-inscription avec règles (domaine email, code, paiement, prérequis — ENR-013)
- [ ] Vue apprenant « Mes formations » complète avec dates effectives/échéances relatives recalculées (ENR-017, la V1 actuelle liste juste par statut)
- [ ] Calcul de complétion versionné par politique (activités obligatoires, score, présence)
- [ ] `attendance_events` (présence) — dans le modèle indicatif, non créé du tout

## 03 — Compétences, résultats d'apprentissage et preuves

- [x] UI : alignement compétence ↔ devoir/critère de rubrique (CMP-010/011 partiel) — `AlignmentManager` dans `Competencies.tsx` (bouton « Aligner » par compétence), coefficient/rôle de preuve (teaching/practice/assessment)/obligatoire. Pas de nouvelle migration : RLS `competency_alignments_manage` (`for all`) autorisait déjà l'écriture directe pedago/admin. **Reste** : cours/module/leçon/question/examen/SCORM/H5P/étape de parcours (7 des 9 `target_type` restants) — aucun sélecteur org-scopé cohérent pour ces types dans le codebase actuel
- [ ] UI : vue couverture programme (enseigné/pratiqué/évalué — CMP-012, CMP-021)
- [ ] UI : demande de revue apprenant (`competency_review_requests`) — table posée, aucun écran
- [ ] Écran de migration des tags existants → compétences (mapping guidé, section « Migration des tags existants » de la spec)
- [ ] Méthodes d'agrégation configurables (CMP-007) — seule « dernière preuve » est implémentée ; meilleure preuve / moyenne pondérée / N-récentes / validation manuelle sont à ajouter
- [ ] Export CASE 1.1 / Open Badges (non-objectif V1 explicite mais listé comme préparation attendue)
- [ ] Vue formateur groupe × compétences (CMP-020)

## 04 — Interopérabilité, identité et administration Enterprise

- [x] UI admin pour créer des `lti_registrations`/`lti_deployments` et pour relier manuellement un `sub` non reconnu à un compte (`external_mappings`) — `/lms/integrations`, formulaire d'enregistrement avec les 5 champs réels (plus de guess `issuer + "/auth"`), gestion des déploiements par enregistrement, RPC `link_lti_subject()` (nouvelle migration `20260812010000_lti_admin_linking.sql`) reliant un `sub` non reconnu à un membre existant de l'org. `/lti/unlinked` a maintenant un chemin réel de résolution côté admin
- [x] Outil de diagnostic LTI (dernier lancement, erreurs, test de connexion — LTI-006) — panneau « derniers lancements » par enregistrement (succès/rejet, raison, sub, deployment) + bouton test de connexion JWKS en direct (edge function `lti-test-connection`, non persistée)
- [ ] Deep Linking (LTI-002), Names and Role Provisioning (LTI-003), Assignment and Grade Services (LTI-004) — LTI-001 (lancement core) seul est couvert
- [ ] Provisioning automatique d'un compte pour un `sub` jamais vu (actuellement : jamais, par choix — voir commentaire en tête de `lti-launch/index.ts`)
- [ ] Handshake OIDC/SAML réel pour le SSO général (INT-001 à INT-005) — étape 1 de l'ordre de livraison, toujours pas commencée ; seule la table de config existe
- [ ] Import/export QTI 3
- [ ] Sync SCIM 2.0 (provisioning/déprovisioning réel)
- [ ] Sync OneRoster 1.2 (import CSV + REST, dry-run)
- [ ] API REST publique versionnée + OpenAPI + pagination curseur + idempotency-key
- [ ] Livraison de webhooks réelle (signature, retry, rejeu) — seule la table `webhook_deliveries` existe, aucun worker
- [ ] Rotation de certificat SSO avec fenêtre de chevauchement réelle (le modèle de données le permet, le flux non)

## 05 — Accessibilité, inclusion et aménagements individuels

- [ ] `extra_time` réel — bloqué en amont par l'absence de tout moteur de tentative chronométrée server-side sur `exams`/`exam_attempts` ; **pas débloqué** par le moteur de correction de la spec 08 (voir dépendances en tête de document) — celui-ci note un système parallèle (`assessment_items`) sans aucune notion de durée
- [ ] Vérificateur d'accessibilité de contenu (A11Y-007 à A11Y-012) — table `content_accessibility_checks` posée, aucun analyseur
- [ ] Socle application (A11Y-001 à A11Y-006 : focus, navigation clavier, contrastes, `prefers-reduced-motion`) — hors DB, c'est un chantier design system transverse à tout le produit
- [ ] Alternatives d'interaction accessibles (hotspot/drag-drop/dessin clavier — A11Y-013)
- [ ] Déclaration d'accessibilité publique (`accessibility_audits.published`) — table prête, aucun contenu réel, aucun écran public
- [ ] Tests automatisés (axe ou équivalent) en CI

## 06 — Parcours adaptatifs, conditions et automatisations

- [ ] Balayage planifié complémentaire (règles à échéance temporelle — date/score qui change sans écriture applicative) — bloqué par : pas d'ordonnanceur
- [ ] UI de construction en phrases « Quand [condition], alors [action] » — l'UI actuelle ne construit qu'une seule condition simple (`activity_completed`), pas le DSL complet (AND/OR, dates, scores, compétences...)
- [ ] Évaluateur pour les sources autres que `activity_completed` (date/score/compétence) — le DSL les accepte et les affiche, `evaluate_rule_definition()` les traite en échec fermé faute d'évaluateur dédié
- [ ] Simulation « voir comme cet apprenant » / dry-run avant publication (ADP-008, AUT-004)
- [ ] Test de positionnement / remédiation (ADP-009/010/011)
- [ ] `follow_up_tasks` — table posée, aucun écran ni déclencheur

## 07 — Analytics pédagogiques, psychométrie et signaux de risque

- [x] Projection journalière **item** — `analytics_daily_item` (`20260812070000_analytics_daily_item.sql`), alimentée par `_run_daily_analytics_rollup_internal()` (déjà sur le cron nocturne). Couvre le compte de réponses, taux de bonne réponse, taux d'omission, moyenne des ratios de score. **Ne couvre pas** le temps médian (aucune colonne de durée sur `assessment_responses`) ni ANA-010/011/012 (distracteurs/difficulté/discrimination — répartition par option et quartiles de score, pas construits)
- [ ] Projection journalière **programme** — jamais définie faute de UI/agrégat programme existant à côté de session/offering
- [x] Dashboard formateur/pédagogue/admin (ANA-006 à ANA-008) — `/lms/analytics`, `AnalyticsDashboard` : activité (apprenants actifs/événements, 14j), preuves de compétence (14j), totaux d'inscription (30j). Lit `analytics_daily_activity`/`analytics_daily_enrollment`/`analytics_daily_competency` déjà là. **ANA-005 (dashboard apprenant) reste bloqué** : ces 3 tables n'ont de politique RLS que pour `trainer`/`pedago`/`admin` — aucune lecture apprenant de ses propres lignes n'existe, il faudrait une migration RLS avant de pouvoir construire cet écran, pas juste une UI
- [ ] Analyse d'items / psychométrie (ANA-010 distracteurs par groupe de performance, ANA-011 difficulté/discrimination, ANA-012 avertissements) — `analytics_daily_item` fournit le compte/taux de base, pas la répartition par option ni les quartiles de score nécessaires à ces trois-là
- [ ] Temps médian de réponse par item (ANA-009) — bloqué par l'absence de colonne de durée sur `assessment_responses`
- [ ] Programmation de rapports (`report_schedules`/`report_runs`) — tables posées, aucun exécuteur
- [ ] Export CSV/XLSX/PDF avec pseudonymisation
- [ ] Seuil minimal anti-réidentification sur les comparaisons de cohortes (ANA-020)
- [x] Ordonnanceur réel pour `run_daily_analytics_rollup()`/`generate_risk_signals()` — `pg_cron`, job nocturne par organisation (voir dépendances en tête de document)

## 08 — Évaluations avancées et banque d'items versionnée

- [x] Assemblage réel d'une évaluation — **sections fixes seulement** : `/lms/item-bank` (panneau Évaluations), créer une évaluation, ajouter une section fixe, y attacher des révisions d'item, publier (`publish_assessment()`, snapshot immuable dans `assessment_versions`). Tirage figé par tentative fait (`start_assessment_attempt()` pré-crée les lignes `assessment_responses` à l'ouverture). **Reste** : le tirage aléatoire (sections `pool`, `assessment_pool_rules`) — refusé explicitement (`pool_sections_not_supported`) plutôt que deviné
- [x] Barèmes riches (ASM-012) — **pour 4 types sur 21** (`true_false`/`single_choice`/`mcq`/`short_answer`, les seuls avec UI d'auteur) : points fixes, crédit partiel + pénalité par option fausse (mcq), équivalences insensibles casse/espaces (short_answer). Tolérance numérique non couverte (aucun type numérique n'a d'UI). **Reste** : simulation avant publication (ASM-013), ranking/matching/cloze et les 8 types ASM-017-024
- [x] Moteur de correction réel utilisant `item_answer_keys` — **la pièce la plus bloquante du programme** : `submit_assessment_response()` lit `item_answer_keys` pour la première fois dans ce repo, corrige côté serveur, jamais de fuite de la réponse correcte au client. Contrat JSON `correct_answer`/`scoring_rules` défini et documenté (`20260812060000_assessment_correction_engine.sql`). Testé fonctionnellement (11 cas : crédit partiel + plancher à 0, équivalences, casse) en transaction annulée avant commit. **Non testé en conditions réelles** (pas de compte staff/apprenant local pour dérouler un cycle complet création→passation→note) ; migration pas encore déployée en prod
- [ ] Nouveaux types d'interaction (passage, vidéo interactive, audio/vidéo, dessin, labeling, math/graphique, fichier, code — ASM-017 à ASM-024) : le schéma accepte n'importe quel `item_type`/`prompt` JSON mais aucun éditeur/lecteur n'existe pour ces types
- [ ] Rescore en masse avec prévisualisation d'impact (`rescore_jobs` posé, aucun exécuteur)
- [ ] Suggestions IA (génération, distracteurs, vérifications de biais/ambiguïté) — non-objectif partiel mais mentionné comme option V1
- [ ] Collections/permissions granulaires (voir/utiliser/commenter/modifier) — tables posées, UI ne gère que la création d'items
- [ ] Lien vers les questions de quiz existantes (`content.data`) — `assessment_items` est un système parallèle sans migration de données (identifié lors de la passe de réconciliation)

## 09 — Sondage live, Q&A, modération et coanimation

- [x] Écran public projeté (LIVE-015, partiel) — `/live/:code/present` (`LivePresenterScreen.tsx`), grand écran séparé de la console modérateur, classement des questions par votes en temps réel (Realtime), aucune authentification/join requis (RLS `audience_questions_public_read`, mêmes conditions que la salle participant). Limité au Q&A : sondage/priorisation/matrice n'ont toujours aucun éditeur staff (rien de réel à projeter pour ces formats)
- [x] UI d'expulsion (`kick_participant()` — bouton par participant actif dans la console animateur, `LiveEngagement.tsx::ParticipantManager`)
- [x] Répondre à un sondage (`poll`) — `open_live_interaction()`/`close_live_interaction()` (`20260812090000_live_poll_interactions.sql`) ajoutent l'invariant « un seul live par run à la fois » (auto-ferme les autres à l'ouverture) par-dessus le `submit_live_response()`/`get_my_live_response()` déjà là. Staff : création (question + options + choix simple/multiple) et tableau de résultats en direct (Realtime sur `live_responses`) dans `LiveEngagement.tsx::InteractionManager`. Participant : widget dans `LiveEventRoom.tsx` — apparaît/disparaît via Realtime sur `live_interactions`, réponse restaurée à la reconnexion, modifiable tant que le sondage reste ouvert. **Reste** : `priority`/`matrix`/`brainstorm`/`ranking` n'ont toujours ni éditeur ni lecteur (contrat config/payload différent pour chacun, pas deviné ici)
- [ ] Vraie table/mécanisme d'allowlist pour `access_policy = 'allowlist'` (actuellement traité comme `authenticated`)
- [ ] Formats supplémentaires : priorisation, matrice 2×2, brainstorm, classement forcé (LIVE-009 à LIVE-013) — `live_interactions.kind` les accepte, aucun éditeur/lecteur
- [ ] Intégrations PowerPoint/Teams/Zoom (LIVE-017/018/019)
- [ ] Rapports post-session (participation, chronologie, export — LIVE-020 à LIVE-023)
- [ ] Rate limiting et filtre de termes assistant (modération)

## 10 — Gouvernance, versionnement, localisation et diffusion du contenu

- [ ] Workflow de revue complet (état `in_review`/`changes_requested`/`approved`, invalidation d'approbation après modification — CNT-006/009) — les tables existent, le RPC de publication ne passe pas encore par ce workflow
- [ ] `content_deployments` réels (pinned vs follow-approved-updates, diff avant adoption — CNT-011/012) : table posée, jamais lue par les sessions/parcours qui consomment du contenu
- [ ] Modèles et blocs réutilisables (`content_templates`, `reusable_blocks`) — pas dans le modèle de données livré du tout
- [ ] Brand kits (CNT-019) — absents
- [ ] Gestion des assets (remplacement versionné, recherche d'usages avant suppression) — `media_assets`/`asset_usages` posés, aucun écran, aucun blocage de suppression implémenté
- [ ] Localisation complète (L10N-001 à L10N-006 : extraction de segments, glossaires, diff source, traduction IA) — non traitée du tout, explicitement hors scope de cette fondation
- [ ] Export SCORM/xAPI/cmi5/QTI (PUB-002/003) et liens de preview expirables (PUB-004)
- [ ] Comparaison structurelle entre versions (diff ajouts/suppressions/déplacements — CNT-003)

## Réconciliation LMS ↔ systèmes pré-existants — items explicitement laissés de côté

- [ ] Banque d'items (spec 08, `assessment_items`) sans lien vers les questions de quiz existantes (`content.data`) — projet de migration de données à part entière
- [ ] `certificates` (clé `course_id` texte, alimenté côté client) sans lien vers la complétion d'inscription ou la maîtrise de compétences
- [ ] Incohérence de nommage `grade_items.source_type` vs `competency_evidence.source_type` — cosmétique, pas fonctionnel
- [ ] Contrôle d'accès par plan Stripe vs rôle d'organisation LMS — question de modèle économique à trancher, pas un bug

## Ordre suggéré pour la suite

1. ~~**08 — moteur de correction (`item_answer_keys`)**~~ — fait pour l'assemblage fixe + 4 types notables (voir §08). ~~Débloque la projection journalière item (07)~~ — faite aussi (voir §07) ; reste ouvert la psychométrie ANA-010/011/012 (agrégat plus riche) et, côté 08 : tirage aléatoire (pool), simulation de barème avant publication, 17 autres types d'interaction. Ne débloque pas `extra_time` (05, système `exams` séparé).
2. ~~**UI gradebook consolidée (01)**~~ — fait, y compris l'import CSV/XLSX (GBK-006, voir §01). Reste ouvert : dashboards visuels (07).
3. ~~**04 — UI admin LTI + linking**~~ — fait (voir §04) : enregistrements/déploiements/linking/diagnostic. Reste ouvert : Deep Linking/NRPS/AGS, SSO OIDC/SAML général, QTI/SCIM/OneRoster/API publique.
4. ~~**09 — écran projeté**~~ — fait pour le Q&A (voir §09). ~~Éditeur de formats sondage~~ — fait aussi (voir §09, sondage seulement). Reste ouvert : priorisation/matrice/brainstorm/classement forcé, et le sondage sur l'écran projeté lui-même (le présentateur `/live/:code/present` n'affiche toujours que le Q&A).
5. ~~**Un vrai ordonnanceur**~~ — fait (`pg_cron`, voir dépendances en tête de document) pour les 2 RPC qui étaient réellement prêtes. Débloque la *planification* des rappels J-7/J-1, du balayage `release_state`, de SCIM/OneRoster, des webhooks en file — mais chacun a encore besoin de sa propre logique métier avant de pouvoir être branché.
6. Le reste (05 socle accessibilité transverse, 10 localisation, 04 SCIM/OneRoster/API) peut suivre l'ordre recommandé du README du programme.
