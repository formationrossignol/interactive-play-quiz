# 06 — Parcours adaptatifs, conditions et automatisations

Date : 2026-08-10  
Statut : proposé  
Priorité : P1  
Dépendances : inscriptions (02), compétences (03), notifications existantes

## Contexte

Les parcours Brivia savent exprimer des prérequis entre étapes. Il manque un
moteur commun capable de conditionner tous les objets à une date, une activité,
un résultat, un groupe ou une compétence, puis d'exécuter des actions telles
qu'une relance ou une affectation de remédiation.

## Résultat utilisateur

Le responsable construit un parcours personnalisé sans code. L'apprenant
comprend pourquoi une activité est disponible ou verrouillée et ce qu'il doit
faire. Le système relance les personnes en retard et propose une remédiation
sans décision opaque.

## Objectifs

- Conditions cohérentes sur cours, modules, activités et parcours.
- AND/OR, groupes de règles et simulation avant publication.
- Déblocage et échéances relatifs à l'inscription.
- Actions automatiques idempotentes et auditables.
- Test de positionnement, remédiation et exemption explicable.

## Non-objectifs V1

- Algorithme adaptatif auto-apprenant sans règle humaine.
- Décision disciplinaire ou exclusion automatique.
- Éditeur générique de workflows d'entreprise.
- Conditions arbitraires exécutant du code fourni par l'utilisateur.

## Exigences fonctionnelles

### Conditions

- **ADP-001** — Sources : date absolue/relative, inscription, appartenance,
  activité vue/terminée, tentative, score, note publiée, compétence, présence,
  certificat et validation manuelle.
- **ADP-002** — Opérateurs typés : existe, égal, supérieur/inférieur, dans une
  plage, avant/après et non accompli.
- **ADP-003** — Groupes imbriqués AND/OR avec profondeur limitée et détection de
  cycles.
- **ADP-004** — Une règle publiée est versionnée et évaluée avec un instant et un
  contexte explicites.
- **ADP-005** — Les conditions négatives indiquent leur comportement si l'état
  change après avoir été satisfait : persistant ou réévaluable.

### Visibilité et accès

- **ADP-006** — Effets : masquer, afficher verrouillé, autoriser, définir une
  date d'ouverture ou recommander.
- **ADP-007** — Un verrou affiche une raison compréhensible et les prérequis,
  sauf si cette information révèle un contenu confidentiel.
- **ADP-008** — Le formateur dispose d'un « voir comme cet apprenant » qui
  explique chaque condition sans permettre l'usurpation d'action.

### Remédiation et positionnement

- **ADP-009** — Un test initial peut recommander, imposer ou dispenser des
  étapes selon des seuils versionnés.
- **ADP-010** — Un échec peut affecter une activité de remédiation et autoriser
  une nouvelle tentative après complétion.
- **ADP-011** — Une exemption conserve la preuve et n'est pas équivalente à une
  complétion normale dans les rapports.

### Automatisations

- **AUT-001** — Déclencheurs : inscription, échéance approchée/dépassée,
  inactivité, complétion, échec, maîtrise acquise/expirée.
- **AUT-002** — Actions V1 : notification, email, affectation de contenu,
  prolongation encadrée, ajout/retrait de groupe pédagogique, création d'une
  tâche de suivi.
- **AUT-003** — Fréquence, fenêtre horaire, nombre maximal et règle d'arrêt.
- **AUT-004** — Mode simulation retournant les personnes concernées sans
  exécuter l'action.
- **AUT-005** — Historique : règle, version, déclencheur, cible, résultat et
  erreur ; relance manuelle contrôlée.

## UX d'édition

- Construction en phrases : « Quand [condition], alors [action] ».
- Résumé en langage naturel actualisé à chaque changement.
- Validation des cycles, références supprimées et règles impossibles.
- Test sur un apprenant fictif ou réel autorisé avec trace d'explication.
- Publication distincte de l'enregistrement ; brouillons sans effet.
- Vue globale des règles qui dépendent d'un contenu avant archivage.

## Modèle de données indicatif

- `rule_sets` : org, cible, mode, état et version publiée.
- `rule_set_versions` : arbre JSON validé par schéma, immuable après publication.
- `release_state` : projection learner × target avec raison et date.
- `automation_rules`, `automation_rule_versions`.
- `automation_runs`, `automation_actions`.
- `follow_up_tasks` pour les actions humaines.

Le JSON de règle utilise un DSL fermé et versionné ; aucune expression SQL ou
JavaScript libre.

## Moteur d'évaluation

- Évaluation serveur déterministe et idempotente.
- Réévaluation événementielle lors d'un changement pertinent, plus balayage de
  sécurité planifié pour les conditions temporelles.
- Verrouillage/clé d'idempotence pour éviter doubles notifications et doubles
  affectations.
- Cache de projection invalidé par version de règle et événement source.
- File d'échec avec backoff, limite et visibilité administrative.

## Cas limites

- Une règle devenue invalide ne bloque pas silencieusement tout un programme :
  elle passe en erreur et alerte son propriétaire.
- L'archivage d'une activité référencée nécessite remplacement ou désactivation.
- Les changements de règle n'enlèvent pas automatiquement un accès déjà acquis
  sauf politique explicitement choisie et annoncée.
- Les dates d'été/hiver utilisent le fuseau de la session puis sont stockées UTC.
- Une relance n'est pas envoyée après retrait ou complétion survenue avant
  l'exécution du job.

## Critères d'acceptation

- Les règles cycliques sont refusées avant publication.
- Un apprenant voit une explication correcte de chaque verrou.
- Une simulation et une exécution sur le même état retournent les mêmes cibles.
- Rejouer un événement ne duplique aucune action.
- Un retrait d'inscription annule les automatisations futures concernées.
- Un score modifié et republié recalcule les accès dépendants selon la politique.
- Toutes les actions automatiques sont attribuables à une règle/version.

## Mesures de succès

- Taux de règles exécutées sans erreur.
- Diminution des relances manuelles.
- Taux de complétion après remédiation.
- Nombre de tickets « contenu verrouillé sans raison ».

