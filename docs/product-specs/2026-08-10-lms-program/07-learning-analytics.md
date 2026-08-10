# 07 — Analytics pédagogiques, psychométrie et signaux de risque

Date : 2026-08-10  
Statut : proposé  
Priorité : P1  
Dépendances : événements de 01, 02, 03, 06 et 08

## Contexte

Brivia fournit déjà des résultats de quiz/examens, comparaisons de groupes,
compétences faibles et reporting SCORM. Les calculs sont dispersés par surface.
Cette spec crée une couche commune d'événements, de définitions métriques et
d'agrégations afin que les chiffres restent cohérents entre dashboards,
exports et intégrations.

## Résultat utilisateur

L'apprenant comprend sa progression. Le formateur identifie les questions et
modules problématiques. Le responsable compare des cohortes et agit sur les
risques sans recevoir une « boîte noire » prétendant décider à sa place.

## Objectifs

- Définitions partagées et versionnées des métriques.
- Analyses par activité, item, compétence, cours, session et programme.
- Psychométrie de base pour améliorer les questions.
- Signaux de risque explicables et actions humaines.
- Exports planifiés et API sans exposer de données inutiles.

## Non-objectifs V1

- Prédiction clinique, disciplinaire ou d'employabilité.
- Classement public des apprenants.
- Entrepôt temps réel illimité.
- Modèle de machine learning opaque prenant une décision automatique.

## Exigences fonctionnelles

### Définitions communes

- **ANA-001** — Glossaire versionné : inscrit, actif, démarré, complété,
  réussite, abandon, temps actif, tentative et maîtrise.
- **ANA-002** — Chaque KPI expose formule, périmètre, période, fuseau, filtres et
  date de fraîcheur.
- **ANA-003** — Les résultats annulés, dispensés, tests et données incomplètes
  suivent une politique explicite.
- **ANA-004** — Un même filtre produit le même total dans UI, export et API.

### Dashboards

- **ANA-005** — Apprenant : progression, échéances, activité récente,
  compétences et recommandations explicables.
- **ANA-006** — Formateur : participation, complétion, distribution des scores,
  questions difficiles, temps, remises et apprenants à accompagner.
- **ANA-007** — Responsable : sessions, cohortes, programmes, couverture de
  compétences, tendances et comparaisons normalisées.
- **ANA-008** — Administrateur : adoption, licences, intégrations et qualité des
  données, sans réponses pédagogiques en clair.

### Analyse d'items

- **ANA-009** — Pour chaque version d'item : nombre de réponses, taux de bonne
  réponse, omission, temps médian et distribution.
- **ANA-010** — QCM : attractivité des distracteurs et sélection par groupes de
  performance.
- **ANA-011** — Difficulté et discrimination calculées seulement au-delà d'un
  seuil d'échantillon affiché.
- **ANA-012** — Avertissements : trop facile/difficile, distracteur jamais choisi,
  temps atypique, possible ambiguïté ; jamais correction automatique.

### Risque et intervention

- **ANA-013** — Signaux V1 basés sur règles : inactivité, retard, échecs répétés,
  chute de progression, prérequis bloquant.
- **ANA-014** — Chaque signal affiche facteurs, date, fenêtre et données
  manquantes.
- **ANA-015** — Actions : ouvrir le profil autorisé, créer une tâche, envoyer une
  relance, affecter une remédiation ; validation humaine obligatoire.
- **ANA-016** — L'organisation peut désactiver un type de signal et définir les
  seuils.

### Rapports et exports

- **ANA-017** — Rapports enregistrés avec filtres, colonnes et audience.
- **ANA-018** — Programmation email avec lien authentifié plutôt que pièce jointe
  sensible par défaut.
- **ANA-019** — Exports CSV/XLSX/PDF et API selon permissions, avec identifiants
  pseudonymisés lorsque possible.
- **ANA-020** — Comparaison de cohortes exige taille minimale configurable pour
  éviter l'identification indirecte.

## Architecture des données

- `learning_events` append-only : nom, version, actor pseudonyme, org, contexte,
  occurred_at, received_at et propriétés validées.
- `metric_definitions` : formule/version et dimensions autorisées.
- Tables/projections journalières pour activité, item, inscription, compétence,
  session et programme.
- `risk_signals` : règle, facteurs, état, résolution et action.
- `saved_reports`, `report_schedules`, `report_runs`.
- Catalogue/lineage indiquant la source de chaque métrique.

Les réponses libres et pièces jointes ne sont jamais copiées dans
`learning_events`. Les analyses de texte utilisent un pipeline séparé, avec
base légale et rétention propres.

## Qualité et calculs

- Déduplication par `event_id` et version de schéma.
- Horodatages tardifs acceptés dans une fenêtre ; projections recalculables.
- Tests de contrat pour chaque producteur d'événements.
- Contrôles de sommes entre source transactionnelle et agrégats.
- Les psychométries restent liées à une version d'item et un contexte ; aucune
  fusion aveugle entre versions ou populations différentes.

## Confidentialité et équité

- Seuil minimal avant affichage d'une sous-population.
- Aucun filtre permettant de réidentifier une personne via combinaison rare.
- Accès détaillé limité aux relations pédagogiques autorisées.
- Signaux de risque non utilisés pour sanction, tarification ou exclusion.
- Audit des consultations de rapports contenant des données individuelles.
- Durée de rétention et droit d'export/suppression appliqués par type de donnée.

## Critères d'acceptation

- Le nombre de participants est identique dans dashboard et export à filtres
  égaux.
- Une métrique affiche sa formule et sa dernière mise à jour.
- Une version modifiée de question possède ses statistiques séparées.
- Aucune discrimination n'est affichée sous le seuil d'échantillon.
- Un signal de risque expose ses facteurs et requiert une action humaine.
- Un utilisateur ne peut sauvegarder/programmer qu'un rapport qu'il a le droit
  de consulter.
- Les événements rejoués ne gonflent pas les agrégats.
- Une suppression/restriction de données se propage aux projections prévues.

## Mesures de succès

- Écart de réconciliation entre transactions et agrégats.
- Fraîcheur des dashboards selon SLA.
- Taux de signaux examinés et résolus.
- Questions améliorées après avertissement psychométrique.
- Réduction du temps nécessaire à produire un rapport récurrent.

