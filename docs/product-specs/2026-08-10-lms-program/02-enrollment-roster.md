# 02 — Inscriptions, sessions et gestion des apprenants

Date : 2026-08-10  
Statut : proposé  
Priorité : P0  
Dépendances : organisations et groupes existants

## Contexte

Brivia dispose d'organisations, rôles, invitations et groupes réutilisables.
Un partage de contenu donne un accès, mais ne représente pas une inscription
pédagogique avec dates, état, progression et historique. Cette spec introduit
ce cycle sans transformer Brivia en SIS complet.

## Résultat utilisateur

Une organisation crée une offre de cours, planifie une session, inscrit des
personnes ou groupes et suit leur cycle jusqu'à la fin, l'échec, l'expiration ou
le renouvellement. Le mode solo continue de fonctionner sans organisation.

## Concepts

- **Cours** : contenu pédagogique versionné et réutilisable.
- **Session** : occurrence planifiée d'un cours, avec dates, capacité,
  formateurs, fuseau et politique.
- **Inscription** : relation durable entre un apprenant et un cours/session.
- **Cohorte/promotion** : groupe pédagogique affecté ensemble ; les `groups`
  existants peuvent servir de source mais ne remplacent pas l'inscription.
- **Programme** : parcours composé de cours ; traité par les objets existants
  de learning path et enrichi par cette spec.

## Objectifs

- Créer des sessions fixes, continues ou auto-rythmées.
- Inscrire individuellement, par groupe, import ou intégration.
- Conserver l'historique malgré les changements de groupe.
- Gérer capacité, attente, validation, annulation et renouvellement.
- Donner une vue distincte aux rôles scolarité et pédagogique.

## Non-objectifs V1

- Emploi du temps de salles complexe, paie ou facturation académique.
- Gestion des diplômes nationaux.
- Synchronisation bidirectionnelle avec tous les SIS avant OneRoster.
- Présence biométrique.

## Exigences fonctionnelles

### Catalogue et session

- **ENR-001** — Un cours peut être non catalogué, interne, public ou accessible
  sur invitation.
- **ENR-002** — Une session possède libellé, code, dates, fuseau, capacité,
  formateurs, mode, lieux/liens et politique d'inscription.
- **ENR-003** — Modes : dates fixes, démarrage relatif à l'inscription,
  auto-rythmé sans date de fin, récurrence de conformité.
- **ENR-004** — Le cours utilisé par une session est un snapshot de version ;
  une mise à jour doit être explicitement adoptée. Avant la spec 10, ce snapshot
  peut être un `content.data` immuable avec `schema_version` et hash ; il migrera
  ensuite vers le contrat commun de version sans changer l'identité de session.

### Inscription

- **ENR-005** — Sources : manuelle, groupe, CSV/XLSX, auto-inscription, achat,
  LTI, OneRoster, SCIM/API.
- **ENR-006** — États : `invited`, `pending`, `waitlisted`, `active`,
  `completed`, `failed`, `withdrawn`, `cancelled`, `expired`.
- **ENR-007** — Toute transition enregistre auteur/source, date et motif.
- **ENR-008** — Retirer une personne d'un groupe n'efface pas son inscription
  ni ses résultats historiques.
- **ENR-009** — Une inscription peut avoir dates, échéances et aménagements
  dérogatoires.
- **ENR-010** — La capacité est réservée atomiquement ; aucun dépassement en
  cas d'inscriptions concurrentes.

### Attente et validation

- **ENR-011** — Liste d'attente ordonnée avec promotion automatique ou
  validation manuelle.
- **ENR-012** — Une place proposée peut expirer ; le candidat suivant est alors
  notifié.
- **ENR-013** — L'auto-inscription peut exiger domaine email, code, paiement,
  approbation ou prérequis.

### Administration

- **ENR-014** — Import prévisualisé avec mapping email/identifiant, détection
  des doublons et rapport téléchargeable.
- **ENR-015** — Actions en masse : inscrire, déplacer de session, annuler,
  prolonger, affecter un formateur, envoyer une relance.
- **ENR-016** — Le gestionnaire voit les statuts administratifs et la
  progression synthétique sans accès automatique aux réponses détaillées.
- **ENR-017** — L'apprenant dispose d'un tableau « Mes formations » séparant à
  venir, en cours, à terminer et terminées.

## Permissions

- `registrar` : crée sessions, gère inscriptions et exports administratifs.
- `trainer` : voit ses sessions et les apprenants actifs, sans gérer les rôles.
- `pedago` : configure règles et affectations de programme.
- `admin` : politiques, intégrations, catalogue et délégations.
- `learner` : ses inscriptions uniquement ; auto-inscription si autorisée.

## Modèle de données indicatif

- `course_offerings` : représentation cataloguée d'un `content` de type course.
- `course_sessions` : org, course/version, dates, capacité, mode et état.
- `session_trainers` : formateurs et responsabilité.
- `enrollments` : learner, offering/session, état, source, dates effectives.
- `enrollment_history` : transitions append-only.
- `enrollment_group_sources` : origine groupe sans dépendance dynamique.
- `waitlist_entries` : position, état, offre et expiration.
- `attendance_events` : présence déclarée/importée, facultatif V1.

Contraintes : unicité d'une inscription active par personne/session ; le même
apprenant peut suivre plusieurs sessions d'un même cours dans le temps.

## Parcours UX

### Création de session

1. Le gestionnaire choisit un cours et une version publiée.
2. Il définit dates, capacité, formateurs et politique.
3. Brivia affiche les conflits et prérequis manquants.
4. La session reste brouillon jusqu'à publication.

### Import

1. Dépôt CSV/XLSX et choix d'un modèle de colonnes.
2. Prévisualisation des créations, correspondances, doublons et erreurs.
3. Confirmation atomique ; traitement asynchrone au-delà de 500 lignes.
4. Rapport final et possibilité de corriger uniquement les lignes rejetées.

### Auto-inscription

1. L'apprenant ouvre une page de catalogue.
2. Brivia évalue visibilité, prérequis, capacité et politique.
3. Il est inscrit, mis en attente ou invité à demander une validation.
4. Une confirmation indique dates, accès et prochaine action.

## Règles métier et cas limites

- Les adresses email sont normalisées mais l'identité repose sur `user_id` dès
  résolution du compte.
- Fusion de comptes et changement d'email exigent une procédure auditée.
- Annuler une session bloque les nouvelles activités, conserve les traces et
  notifie les inscrits.
- Une session commencée ne peut changer de fuseau ou de cours source sans une
  migration explicitement confirmée.
- La complétion est calculée par politique versionnée : activités obligatoires,
  score, présence et durée éventuelle.
- Les inscriptions récurrentes créent une nouvelle occurrence et ne réouvrent
  pas la précédente.

## Critères d'acceptation V1

- Import de 1 000 personnes avec résultat déterministe et sans doublon.
- Deux demandes concurrentes sur la dernière place ne créent qu'une inscription
  active.
- Le retrait d'un groupe ne supprime aucune tentative, note ou certificat.
- Un gestionnaire peut agir en masse sans accéder aux réponses privées.
- Un apprenant voit uniquement les offres autorisées et ses inscriptions.
- Les dates relatives sont recalculées depuis la date effective d'inscription.
- Annulation, retrait et prolongation apparaissent dans l'historique.

## Mesures de succès

- Temps nécessaire pour créer une session et inscrire 100 personnes.
- Taux de lignes d'import résolues automatiquement.
- Nombre de tickets liés à un accès cours incohérent.
- Écart entre inscrits actifs et capacité : cible zéro.
