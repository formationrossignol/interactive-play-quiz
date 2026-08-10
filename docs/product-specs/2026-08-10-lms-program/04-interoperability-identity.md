# 04 — Interopérabilité, identité et administration Enterprise

Date : 2026-08-10  
Statut : proposé  
Priorité : P0  
Dépendances : organisations, inscriptions (02), gradebook (01), compétences (03)

## Contexte

Brivia importe SCORM et H5P et exporte plusieurs formats de résultats. SSO,
SCIM, LTI et provisionnement sont aujourd'hui présentés comme des capacités à
qualifier, pas comme des intégrations disponibles. Cette spec définit une
trajectoire standardisée, en privilégiant les usages institutionnels les plus
rentables avant les connecteurs propriétaires.

## Résultat utilisateur

Une organisation connecte son fournisseur d'identité et son LMS. Les personnes,
rôles et inscriptions sont provisionnés, un formateur ajoute une activité
Brivia depuis son LMS, l'apprenant la lance sans nouveau compte et la note est
renvoyée automatiquement.

## Ordre de livraison obligatoire

1. OIDC/SAML SSO et gestion de domaines.
2. LTI 1.3 Advantage en rôle **Tool**.
3. QTI 3 import/export.
4. SCIM 2.0 et OneRoster 1.2.
5. API publique et webhooks.
6. LTI en rôle **Platform** seulement après stabilisation du modèle d'activité.

## Objectifs

- Réduire doubles comptes, ressaisie d'inscriptions et export manuel de notes.
- Utiliser des standards certifiables et versionnés.
- Fournir journaux, diagnostics et révocation par connexion.
- Isoler secrets et données de chaque organisation.
- Conserver un fonctionnement normal sans intégration.

## Non-objectifs V1

- Connecteur spécifique pour chaque SIS/SIRH du marché.
- Synchronisation implicite non observable.
- Stockage de mots de passe d'un système tiers.
- Certification 1EdTech avant réussite de la suite de conformité.

## Exigences fonctionnelles

### SSO

- **INT-001** — Connexions OIDC et SAML par organisation, avec métadonnées,
  certificats, domaines autorisés et politique d'activation.
- **INT-002** — Modes : optionnel, obligatoire pour les domaines gérés, et
  secours administrateur explicitement limité.
- **INT-003** — Liaison de compte par identifiant stable du fournisseur ; un
  email seul ne suffit pas à reprendre automatiquement un compte existant.
- **INT-004** — Mapping configurable des attributs et rôles, prévisualisé avant
  activation.
- **INT-005** — Rotation de certificat/secret sans interruption grâce à une
  période de chevauchement.

### LTI 1.3 Advantage — Brivia Tool

- **LTI-001** — Support de LTI Core 1.3, OIDC login et JWT signés.
- **LTI-002** — Deep Linking : sélection/création d'un quiz, sondage, examen ou
  activité Brivia depuis le LMS.
- **LTI-003** — Names and Role Provisioning : synchronisation limitée au contexte
  autorisé, avec journal de provenance.
- **LTI-004** — Assignment and Grade Services : création de line item et retour
  de score idempotent, avec file de reprise.
- **LTI-005** — Un lancement crée ou lie l'utilisateur, le cours externe, le
  contexte et l'inscription dans l'organisation déjà propriétaire du
  déploiement LTI ; un lancement ne crée jamais une organisation implicitement.
- **LTI-006** — Outil de diagnostic : dernier lancement, scopes, clés, erreurs,
  grade passback et test de connexion.

### QTI 3

- **QTI-001** — Import d'items/tests avec prévisualisation et rapport des
  interactions supportées, adaptées ou refusées.
- **QTI-002** — Export des questions, sections, réponses, feedbacks, médias,
  métadonnées et accommodations représentables.
- **QTI-003** — Aucun type inconnu n'est silencieusement converti en QCM.
- **QTI-004** — Les identifiants externes et licences sont conservés.

### OneRoster 1.2

- **ROS-001** — Import CSV d'organisations, utilisateurs, cours, classes,
  inscriptions et grades avec mode dry-run.
- **ROS-002** — REST entrant pour synchronisations planifiées ; delta lorsque le
  fournisseur le permet.
- **ROS-003** — Chaque enregistrement conserve source, sourcedId et date de sync.
- **ROS-004** — Désactivation externe ne supprime pas les preuves historiques.
- **ROS-005** — Export/gradebook sortant activé par organisation et périmètre.

### SCIM 2.0

- **SCM-001** — Users et Groups : créer, lire, mettre à jour, désactiver.
- **SCM-002** — Jetons à durée/périmètre limités, hashés au repos et révocables.
- **SCM-003** — Désactivation retire les accès actifs sans supprimer résultats,
  certificats ou audit.
- **SCM-004** — Mapping des groupes SCIM vers organisations, rôles et groupes
  Brivia avec règles explicites.

### API et webhooks

- **API-001** — API REST versionnée, OpenAPI, pagination curseur, idempotency key
  pour créations et limites par organisation.
- **API-002** — OAuth client credentials ou jetons de service à scopes fins ;
  aucun jeton utilisateur longue durée.
- **API-003** — Webhooks signés, horodatés, rejouables et livrés au moins une fois.
- **API-004** — Événements initiaux : inscription, remise, note, complétion,
  certificat, publication de contenu et changement de maîtrise.

## Modèle de données indicatif

- `identity_connections`, `identity_domains`, `external_identities`.
- `integration_connections` : type, org, état, configuration non secrète.
- `integration_secrets` : coffre serveur, version et rotation.
- `external_mappings` : système, type, external_id, internal_id, provenance.
- `lti_registrations`, `lti_deployments`, `lti_contexts`, `lti_launches`.
- `integration_jobs`, `integration_job_items`, `integration_errors`.
- `api_clients`, `api_tokens`, `webhook_endpoints`, `webhook_deliveries`.

## Sécurité

- Validation stricte issuer, audience, nonce, state, timestamp et signature.
- Protection anti-rejeu sur lancements et webhooks.
- Secrets jamais retournés après création et jamais écrits dans les logs.
- Connexion en mode test avant activation sur un domaine.
- Audit des mappings de rôle, changements de scopes et actions de resync.
- Déconnexion d'une intégration suspend les jobs, révoque secrets et conserve le
  diagnostic nécessaire selon la politique de rétention.

## Gestion des conflits

- Le système source d'un champ est affiché : Brivia, IdP, SCIM, OneRoster ou LTI.
- Une donnée gérée extérieurement n'est pas modifiable localement sans procédure
  de prise de contrôle.
- Les conflits bloquants apparaissent dans une file de résolution ; ils ne
  produisent pas de duplication silencieuse.
- Les opérations sont idempotentes et supportent reprise après échec partiel.

## Critères d'acceptation

- Un lancement LTI valide ne demande pas de second mot de passe.
- Un JWT expiré, mauvais nonce ou mauvais deployment est rejeté et journalisé.
- Un grade passback rejoué dix fois ne crée qu'un résultat externe cohérent.
- Un import QTI annonce précisément les interactions non supportées.
- Un import OneRoster dry-run ne modifie aucune donnée.
- Désactiver un utilisateur via SCIM coupe l'accès sans effacer son historique.
- La rotation d'un certificat SSO maintient les connexions pendant la fenêtre.
- Un webhook peut être vérifié, rejoué et désactivé depuis l'administration.

## Mesures de succès

- Taux de lancements LTI réussis et latence médiane.
- Taux de grade passback sans intervention.
- Nombre de doublons d'identité créés : cible proche de zéro.
- Temps de diagnostic d'une synchronisation échouée.
