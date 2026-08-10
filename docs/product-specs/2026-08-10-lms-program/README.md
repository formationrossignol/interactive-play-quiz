# Programme LMS Brivia — index des spécifications

Date : 2026-08-10  
Statut : proposé, prêt pour arbitrage produit  
Périmètre : dix chantiers issus de l'audit fonctionnel LMS, quiz et sondage

## Intention

Brivia dispose déjà de quiz et sondages live, flashcards, présentations, examens,
cours, parcours, notation manuelle, certificats, SCORM, H5P, organisations,
groupes, partage, communauté et monétisation de quiz. Ce programme ne remplace
pas ces fonctionnalités. Il ajoute les couches nécessaires pour faire de
Brivia un système de formation central exploitable par un organisme, une école
ou une entreprise.

Le principe directeur est le suivant : un résultat produit dans Brivia doit
pouvoir être rattaché à un apprenant, une inscription, une activité, une
compétence, une période et une organisation, puis être expliqué, exporté et
audité.

## Documents

| # | Spécification | Résultat attendu | Priorité |
|---|---|---|---|
| 01 | [Devoirs, remises et carnet de notes](./01-assignments-gradebook.md) | Workflow complet de remise et note finale consolidée | P0 |
| 02 | [Inscriptions et gestion des apprenants](./02-enrollment-roster.md) | Cycle d'inscription aux cours et sessions | P0 |
| 03 | [Compétences et résultats d'apprentissage](./03-competencies-outcomes.md) | Référentiels, alignements, preuves et maîtrise | P0 |
| 04 | [Interopérabilité et identité Enterprise](./04-interoperability-identity.md) | LTI, QTI, OneRoster, SSO, SCIM, API | P0 |
| 05 | [Accessibilité et aménagements](./05-accessibility-accommodations.md) | Expérience inclusive et audit WCAG/RGAA | P0 |
| 06 | [Parcours adaptatifs et automatisations](./06-adaptive-automation.md) | Conditions de déblocage, remédiation et relances | P1 |
| 07 | [Analytics pédagogiques](./07-learning-analytics.md) | Mesures fiables, psychométrie et signaux de risque | P1 |
| 08 | [Évaluations avancées](./08-advanced-assessment.md) | Banque versionnée et interactions avancées | P1 |
| 09 | [Sondage live, Q&A et coanimation](./09-live-engagement.md) | Animation professionnelle et intégrations de réunion | P1 |
| 10 | [Gouvernance et diffusion du contenu](./10-content-governance.md) | Versions, validation, localisation et publication | P1 |

## Personas communs

- **Apprenant** : suit des cours, remet des travaux, consulte ses résultats et
  ses compétences.
- **Formateur** : crée, anime, évalue et accompagne les apprenants affectés.
- **Responsable pédagogique** : construit les référentiels, règles, programmes
  et rapports d'une organisation.
- **Gestionnaire de scolarité** : gère sessions, inscriptions, calendrier et
  données administratives sans modifier le contenu pédagogique.
- **Administrateur d'établissement** : configure l'organisation, les
  intégrations, l'identité, les politiques et les accès.
- **Super-administrateur Brivia** : opère la plateforme sans obtenir par défaut
  l'accès au contenu pédagogique confidentiel.

Les rôles existants `learner`, `trainer`, `pedago`, `registrar` et `admin`
restent cumulatifs et limités à une organisation.

## Principes transverses obligatoires

### Isolation et autorisation

- Toute nouvelle donnée métier appartient à une organisation ou à un
  utilisateur lorsque le mode solo est explicitement supporté.
- Les règles RLS sont obligatoires sur toutes les tables exposées.
- Les opérations sensibles passent par RPC ou fonction serveur et vérifient le
  rôle, l'organisation et la ressource ciblée.
- Le super-administrateur ne reçoit pas un accès implicite aux remises,
  résultats, réponses ou captures de surveillance.

### Identifiants et historique

- Les références internes utilisent des UUID immuables.
- Les données visibles peuvent être archivées mais ne sont pas supprimées si
  elles servent de preuve à une note, un certificat ou un audit.
- Toute publication, correction, changement de référentiel ou action
  administrative sensible écrit un événement d'audit append-only.
- Les dates sont stockées en UTC et rendues dans le fuseau de l'organisation.

### Expérience utilisateur

- Toutes les listes dépassant 50 éléments sont recherchables, filtrables et
  paginées côté serveur.
- Les états chargement utilisent les skeletons partagés ; aucun spinner seul.
- Les actions destructrices ont confirmation, libellé précis et possibilité de
  récupération lorsqu'elle est techniquement raisonnable.
- Les vues formateur et apprenant doivent toujours indiquer le statut, la
  prochaine action et la date limite applicables.

### Accessibilité, sécurité et confidentialité

- WCAG 2.2 AA et RGAA constituent la cible de conception de chaque chantier.
- Les aménagements individuels ne sont jamais visibles des autres apprenants.
- Les fichiers sont contrôlés par type, taille, signature et antivirus avant
  mise à disposition.
- Les exports respectent le périmètre de rôle et la politique de rétention.
- Les données utilisées pour l'IA exigent une base légale, un fournisseur
  approuvé et une option de désactivation au niveau organisation.

### Événements analytiques

Chaque fonctionnalité produit des événements métier stables, par exemple
`enrollment.started`, `submission.submitted`, `grade.published`,
`competency.mastery_changed`, `content.published`. Les événements ne doivent
pas contenir de texte libre, réponse ou pièce jointe en clair.

## Dépendances

```text
02 Inscriptions ───────┬──> 01 Devoirs et gradebook ──┬──> 07 Analytics
                       │                               │
03 Compétences ────────┼──> 06 Adaptatif ─────────────┤
                       │                               │
04 Interopérabilité ───┴──> imports, grade passback ───┘

05 Accessibilité ─────────> contrainte transverse sur 01, 06, 08, 09, 10
08 Évaluations ───────────> alimente 01, 03 et 07
09 Engagement live ───────> alimente 03 et 07
10 Gouvernance ───────────> versionne les objets consommés par tous les autres
```

## Ordre recommandé des incréments

### Incrément A — fondations institutionnelles

1. Inscriptions et sessions.
2. Devoirs, remises et gradebook unifié.
3. Référentiels de compétences et alignements.
4. Aménagements individuels et fondations accessibilité.

### Incrément B — écosystème et personnalisation

1. LTI 1.3 Tool, QTI 3 import/export et SSO OIDC/SAML.
2. Conditions de déblocage et notifications automatiques.
3. Événements analytiques et premières agrégations.
4. Banque de questions versionnée et nouveaux types prioritaires.

### Incrément C — différenciation

1. Q&A modérée et coanimation.
2. Psychométrie et détection des apprenants à risque.
3. Workflow éditorial, modèles et localisation.
4. OneRoster, SCIM, API publique puis rôle LTI Platform.

## Indicateurs de réussite du programme

- Un gestionnaire inscrit 1 000 apprenants à un programme sans opération
  manuelle individuelle.
- Un formateur retrouve dans un seul carnet les travaux, quiz, examens et notes
  manuelles d'un groupe.
- Un responsable explique le niveau d'une compétence en ouvrant les preuves qui
  l'ont produit.
- Un apprenant reçoit automatiquement le bon contenu et les bons aménagements.
- Une organisation connecte son identité et son LMS sans échange de mot de
  passe ou double saisie de notes.
- Une modification de contenu publiée reste traçable et ne modifie pas
  rétroactivement une tentative historique.

## Non-objectifs du programme

- Reproduire toutes les fonctions d'un SIS ou d'un SIRH.
- Construire un traitement de paiement ou un stockage vidéo propriétaire.
- Promettre une conformité ou certification avant audit indépendant.
- Ajouter de nouveaux thèmes visuels sans rapport avec les workflows définis.
- Migrer simultanément toutes les données historiques : chaque spec définit sa
  stratégie de compatibilité.

## Arbitrages requis avant planification

Ces décisions changent l'ordre ou le coût des travaux et doivent être consignées
avant le premier plan d'implémentation :

1. **Marché prioritaire** : formation professionnelle/entreprise ou enseignement
   supérieur. OneRoster et certains rôles de scolarité deviennent prioritaires
   surtout dans le second cas.
2. **Source de vérité des inscriptions** : Brivia, SIS/LMS externe ou choix par
   organisation et par champ.
3. **Gradebook** : calcul officiel dans Brivia ou simple consolidation avec
   retour vers un système académique externe.
4. **Migration de `content.data`** : snapshots JSON versionnés d'abord, puis
   normalisation progressive, ou refonte immédiate plus coûteuse.
5. **Niveau d'anonymat live** : anonymat vis-à-vis du présentateur uniquement ou
   absence d'identifiant persistant, avec conséquences sur la modération.
6. **Fournisseurs** : stockage/scan média, antiplagiat, transcription, email,
   identité et IA doivent être sélectionnés selon régions et engagements de
   traitement des données.
7. **Mobile** : PWA offline en continuité de la plateforme web ou applications
   natives ; le présent programme suppose la PWA pour le premier incrément.
8. **Certifications visées** : 1EdTech, accessibilité et sécurité. Ne pas
   financer une certification avant que les usages et profils de conformité
   soient stabilisés.

## Passage de la spec au développement

Chaque document est volontairement autonome. Avant implémentation, il doit être
transformé en un plan par incréments livrables comprenant migrations, RLS,
services, interfaces, instrumentation, tests, activation par feature flag et
rollback. Une spec approuvée ne constitue pas à elle seule une autorisation de
déployer une migration destructive.
