# 01 — Devoirs, remises et carnet de notes unifié

Date : 2026-08-10  
Statut : proposé  
Priorité : P0  
Dépendances : inscriptions (02), compétences (03), accessibilité (05)

## Contexte

Brivia possède des tentatives de quiz et d'examen ainsi qu'un module de notes
manuelles auditées. Ces résultats vivent dans des domaines distincts. Il manque
un objet « devoir », un workflow de remise et une vue consolidée permettant de
calculer et publier une note de cours ou de session.

Cette spec étend la notation existante ; elle ne la remplace pas. Les
`manual_evaluations` deviennent une source possible du gradebook, au même titre
que les quiz, examens et nouveaux devoirs.

## Résultat utilisateur

Un formateur publie un devoir, reçoit des remises, corrige avec une rubrique et
publie les résultats. L'apprenant connaît à tout moment la date limite, le
statut de sa remise, les retours et l'impact de la note. Le responsable consulte
un carnet unique et explicable.

## Objectifs

- Couvrir les remises texte, fichier, URL, audio et vidéo.
- Gérer échéances, retard, absence, dispense, brouillon et nouvelle remise.
- Fournir rubriques, annotations et feedback multimédia.
- Consolider toutes les sources de résultat dans un gradebook.
- Conserver un historique complet des corrections et publications.
- Préparer le retour de notes LTI/OneRoster sans le mettre dans le client.

## Non-objectifs V1

- Détection de plagiat native ; prévoir une interface de fournisseur.
- Éditeur bureautique collaboratif dans Brivia.
- Calcul de notes juridiquement certifié pour tous les systèmes scolaires.
- Correction automatique IA sans validation humaine.

## Rôles et permissions

- `trainer` : crée et corrige les devoirs dont il est responsable.
- `pedago` : crée modèles/rubriques, voit les résultats agrégés et peut modérer.
- `registrar` : voit statuts et notes publiées, gère dispense/absence, sans lire
  le contenu confidentiel d'une remise sauf délégation explicite.
- `learner` : crée et consulte uniquement ses propres remises et feedbacks.
- `admin` : configure politiques et intégrations, pas d'accès implicite aux
  remises.

## Exigences fonctionnelles

### Devoir

- **ASG-001** — Un devoir appartient à un cours et, lors de son affectation, à
  une session ou un groupe d'apprenants.
- **ASG-002** — Modes de réponse : texte enrichi, un ou plusieurs fichiers,
  URL, audio, vidéo, aucune remise en ligne et combinaison configurée.
- **ASG-003** — Configuration : ouverture, échéance, fermeture, barème,
  coefficient, tentatives autorisées, taille/types de fichiers, travail
  individuel ou groupe, visibilité de la rubrique.
- **ASG-004** — Le formateur peut attribuer une échéance ou un aménagement
  individuel sans modifier le devoir pour les autres.
- **ASG-005** — Un devoir publié est versionné. Modifier l'énoncé après une
  première remise crée une révision et avertit les apprenants concernés.

### Remise

- **SUB-001** — La remise possède les états `draft`, `submitted`, `late`,
  `returned`, `resubmission_requested`, `graded`, `excused`, `void`.
- **SUB-002** — « Enregistrer » ne soumet pas. « Remettre » fige une version,
  horodate l'action et affiche un reçu.
- **SUB-003** — Une nouvelle remise ne supprime jamais les versions précédentes.
- **SUB-004** — Une remise de groupe est visible par ses membres ; la note peut
  être collective puis ajustée individuellement.
- **SUB-005** — Les uploads incomplets ou rejetés ne peuvent pas produire un
  statut `submitted`.

### Correction

- **GRD-001** — Correction par score direct ou rubrique multicritère.
- **GRD-002** — Critère de rubrique : libellé, description, niveaux, points ou
  maîtrise, commentaire et alignements de compétences.
- **GRD-003** — Feedback texte, annotation de fichier, pièce jointe, audio et
  vidéo. Une transcription est requise pour l'audio/vidéo publié.
- **GRD-004** — Modes de publication individuel, sélection, groupe complet ou
  date programmée.
- **GRD-005** — Correction anonyme et double correction sont des options de
  devoir. La levée d'anonymat est auditée.
- **GRD-006** — Toute révision d'une note publiée exige un motif et conserve
  avant/après, auteur et date.

### Carnet de notes

- **GBK-001** — Une ligne représente un apprenant inscrit ; une colonne un
  élément noté provenant d'un devoir, quiz, examen, SCORM/H5P ou d'une
  évaluation manuelle.
- **GBK-002** — Catégories, coefficients, exclusion du plus faible, points,
  pourcentage, validation et note lettrée.
- **GBK-003** — Les états absent, dispensé, non remis et non évalué ne sont
  jamais convertis silencieusement en zéro.
- **GBK-004** — Chaque total expose sa formule et les éléments pris en compte.
- **GBK-005** — Simulation « si je reçois X » côté apprenant, sans persistance.
- **GBK-006** — Import CSV/XLSX avec prévisualisation, correspondance des
  personnes, validation et rapport d'erreurs ; export CSV/XLSX/PDF.

## Parcours UX

### Création

1. Depuis un cours, le formateur choisit « Ajouter une activité → Devoir ».
2. Il saisit consigne, mode de réponse, barème, dates, destinataires et rubrique.
3. Une prévisualisation apprenant signale les champs ou fichiers attendus.
4. La publication crée l'élément de gradebook et notifie les inscrits.

### Remise

1. L'apprenant voit le temps restant et les aménagements applicables.
2. Les brouillons sont autosauvegardés.
3. Avant remise, un récapitulatif liste fichiers, texte et déclaration
   éventuelle d'originalité.
4. Après remise, un reçu immuable contient identifiant, version et date.

### Correction

1. La boîte de correction filtre à corriger, en retard, rendus et publiés.
2. Le correcteur navigue sans retourner à la liste.
3. Rubrique, annotation et commentaire se sauvegardent en brouillon.
4. La publication déclenche notification et mise à jour du gradebook.

## Modèle de données indicatif

- `assignments` : org, course, owner, instructions, dates, mode, barème,
  policy JSON limitée et version publiée.
- `assignment_targets` : session, groupe ou apprenant ciblé.
- `submissions` : assignment, learner/group, active_version, état.
- `submission_versions` : payload texte/URL, horodatage, statut de scan.
- `submission_files` : storage path, type, taille, hash, scan.
- `rubrics`, `rubric_criteria`, `rubric_levels` : modèles réutilisables et
  snapshots lors de l'affectation.
- `submission_assessments` : correcteur, score, feedback, statut, version.
- `rubric_ratings` : niveau/score/commentaire par critère.
- `grade_items` : registre unifié des sources de note.
- `grade_results` : résultat matérialisé par apprenant et item.
- `grade_categories`, `grade_policies`, `grade_publications`.

Les blobs volumineux restent dans Storage. Les tables ne contiennent que les
métadonnées et références contrôlées.

## Services et sécurité

- Les remises et publications passent par des fonctions atomiques.
- La règle d'échéance est évaluée côté serveur à partir de l'échéance effective
  de l'apprenant.
- Un job serveur analyse les fichiers avant de les rendre au correcteur.
- Les URL de téléchargement sont signées et de courte durée.
- Le calcul du total officiel s'exécute côté serveur avec une version de
  politique enregistrée.
- Un connecteur antiplagiat reçoit un fichier ou texte minimisé et renvoie un
  rapport ; le score de similarité n'est jamais une décision automatique.

## Notifications

- Devoir publié ou modifié matériellement.
- Échéance à J-7, J-1 et après retard selon politique organisation.
- Remise reçue, nouvelle remise demandée, résultat publié ou révisé.
- Les relances sont regroupées et respectent les préférences existantes.

## Critères d'acceptation V1

- Un apprenant ne peut ni lire ni remplacer la remise d'un autre.
- Une remise envoyée une seconde avant l'échéance est à l'heure ; une seconde
  après est en retard, sauf aménagement.
- Une révision conserve toutes les versions et le reçu original.
- Un correcteur publie une rubrique et l'apprenant voit niveaux, commentaires,
  score et compétences selon la politique choisie.
- Le gradebook consolide au minimum devoirs, examens, quiz et notes manuelles.
- Une dispense ne réduit pas la moyenne et un non-remis suit la politique
  explicite du cours.
- Toute modification d'une note publiée est visible dans l'audit.
- Les exports neutralisent les formules de tableur et respectent les filtres.

## Mesures de succès

- Temps médian entre ouverture d'une remise et publication de la correction.
- Pourcentage de remises sans intervention support.
- Taux de notes publiées avec rubrique.
- Nombre d'écarts entre total affiché et total exporté : cible zéro.

