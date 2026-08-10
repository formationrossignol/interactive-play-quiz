# 03 — Compétences, résultats d'apprentissage et preuves

Date : 2026-08-10  
Statut : proposé  
Priorité : P0  
Dépendances : résultats existants, gradebook (01), inscriptions (02)

## Contexte

Brivia sait associer des tags de compétences aux questions et afficher des
zones faibles. Il manque un référentiel gouverné, des niveaux de maîtrise, un
alignement généralisé aux activités et une chaîne de preuve expliquant chaque
niveau calculé.

Cette spec conserve les tags existants comme données héritées. Ils pourront
être mappés vers de vraies compétences, mais ne seront pas automatiquement
promus sans validation.

## Résultat utilisateur

Un responsable définit ou importe un référentiel. Les créateurs alignent cours,
questions, devoirs et rubriques. Les résultats alimentent des preuves ; Brivia
calcule une maîtrise explicable. L'apprenant voit ce qu'il maîtrise, ce qui lui
manque et comment progresser.

## Objectifs

- Référentiels hiérarchiques et versionnés.
- Échelles de maîtrise configurables par organisation.
- Alignement à tous les objets pédagogiques pertinents.
- Preuves automatiques et manuelles, traçables jusqu'à leur source.
- Agrégation explicable à l'échelle cours, programme et organisation.
- Préparation à CASE et Open Badges, sans imposer ces exports en V1.

## Non-objectifs V1

- Marketplace publique de référentiels.
- Reconnaissance automatique de compétences depuis un CV.
- Décision RH automatique à partir d'un score Brivia.
- Équivalence universelle entre tous les référentiels.

## Exigences fonctionnelles

### Référentiels

- **CMP-001** — Un référentiel appartient à une organisation, peut être privé
  ou partagé en lecture et possède brouillon, version publiée et archivage.
- **CMP-002** — Une compétence possède code, titre, description, parent,
  niveau/ordre, langue, tags et source externe facultative.
- **CMP-003** — Une version publiée est immuable. Toute modification crée une
  nouvelle version avec diff.
- **CMP-004** — Import/export CSV dès V1 ; CASE 1.1 dans la spec 04.
- **CMP-005** — Fusion, déplacement et dépréciation préservent les alignements
  historiques via des relations de remplacement.

### Échelles et maîtrise

- **CMP-006** — Échelle par défaut : non évalué, débutant, en acquisition,
  maîtrisé, expert ; libellés et seuils configurables.
- **CMP-007** — Méthodes d'agrégation : dernière preuve, meilleure preuve,
  moyenne pondérée, N preuves récentes ou validation manuelle.
- **CMP-008** — La méthode, les seuils et leurs versions sont affichables pour
  expliquer le résultat.
- **CMP-009** — La maîtrise peut expirer ou exiger une réévaluation.

### Alignements

- **CMP-010** — Alignements sur cours, module, leçon, question, devoir, critère
  de rubrique, examen, activité SCORM/H5P et étape de parcours.
- **CMP-011** — Un alignement précise poids, niveau visé, rôle de la preuve
  (`teaching`, `practice`, `assessment`) et caractère obligatoire.
- **CMP-012** — Une couverture de cours indique compétences couvertes, non
  couvertes et surreprésentées.
- **CMP-013** — La modification d'un alignement après des tentatives n'altère
  pas les preuves historiques ; elle s'applique aux nouvelles versions.

### Preuves

- **CMP-014** — Une preuve référence sa source, son résultat, sa date, son
  auteur/calculateur et la version d'alignement.
- **CMP-015** — Sources : question, rubrique, résultat global, SCORM/H5P,
  observation manuelle, import externe.
- **CMP-016** — Une preuve manuelle exige commentaire et peut joindre un fichier.
- **CMP-017** — Une preuve annulée reste auditée et déclenche un recalcul.
- **CMP-018** — L'apprenant peut demander une revue d'une preuve ou maîtrise ;
  il ne peut pas la modifier.

### Restitution

- **CMP-019** — Vue apprenant : carte de compétences, niveau, tendance,
  dernières preuves et activités recommandées.
- **CMP-020** — Vue formateur : groupe × compétences, filtres, écarts et accès
  aux preuves autorisées.
- **CMP-021** — Vue responsable : couverture des programmes, comparaisons de
  cohortes et référentiels à maintenir.

## Permissions

- `pedago` : crée, publie et mappe les référentiels.
- `trainer` : aligne ses contenus et crée des preuves manuelles autorisées.
- `registrar` : voit statuts synthétiques nécessaires au suivi administratif.
- `learner` : consulte ses preuves/niveaux et demande une revue.
- `admin` : configure imports et délégations, sans altérer une preuve publiée.

## Modèle de données indicatif

- `competency_frameworks`, `competency_framework_versions`.
- `competencies` : identité stable ; `competency_revisions` : contenu versionné.
- `mastery_scales`, `mastery_scale_levels`.
- `competency_alignments` : cible polymorphe, version de contenu, poids et rôle.
- `competency_evidence` : learner, competency, source, score/niveau, date.
- `competency_mastery` : projection calculée et version de règle.
- `competency_mastery_history` : transitions append-only.
- `competency_review_requests`.

La cible polymorphe est validée par service ; aucune chaîne `target_type/id`
ne doit contourner l'autorisation de la ressource source.

## Calcul

1. Une source de résultat publiée émet `evidence.created`.
2. Le service résout les alignements figés applicables.
3. Il transforme le résultat vers l'échelle de maîtrise.
4. Il recalcule la projection pour l'apprenant et la compétence.
5. Si le niveau change, il écrit l'historique et émet
   `competency.mastery_changed`.

Le recalcul est idempotent et reproductible. La projection peut être reconstruite
à partir des preuves et règles versionnées.

## Migration des tags existants

- Inventaire des libellés normalisés par organisation.
- Proposition de regroupements, sans création automatique définitive.
- Écran de mapping : tag → compétence existante, nouvelle compétence ou ignoré.
- Les anciennes tentatives produisent des preuves seulement après confirmation
  et conservent la mention « import historique ».

## Critères d'acceptation V1

- Une compétence publiée ne change jamais rétroactivement de définition.
- Chaque niveau affiché expose les preuves et la règle qui l'ont produit.
- Supprimer un alignement courant n'efface aucune preuve historique.
- Un formateur ne voit que les apprenants et référentiels autorisés.
- Une annulation de note recalcule la maîtrise de manière idempotente.
- L'import CSV signale parents inconnus, cycles, doublons et codes invalides.
- La vue couverture distingue enseigné, pratiqué et évalué.

## Mesures de succès

- Part des activités évaluées alignées à au moins une compétence.
- Part des niveaux possédant au moins deux preuves récentes.
- Temps de résolution d'une demande de revue.
- Pourcentage de compétences d'un programme réellement évaluées.

