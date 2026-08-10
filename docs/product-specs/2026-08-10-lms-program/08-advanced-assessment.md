# 08 — Évaluations avancées et banque d'items versionnée

Date : 2026-08-10  
Statut : proposé  
Priorité : P1  
Dépendances : compétences (03), accessibilité (05), analytics (07)

## Contexte

Brivia couvre déjà QCM, choix unique, vrai/faux, réponse courte, classement,
association, texte à trous, glisser-déposer, hotspot, échelles, texte libre, NPS
et slider. La banque actuelle doit évoluer vers un dépôt d'items versionnés,
réutilisables et analysables. Les nouveaux types prioritaires servent des usages
pédagogiques non couverts, pas une course au nombre d'interactions.

## Résultat utilisateur

Un auteur construit une évaluation fiable à partir d'une banque gouvernée,
sélectionne des items par compétence/difficulté, configure un barème explicite
et obtient des résultats stables même si les questions sont corrigées ensuite.

## Objectifs

- Versions immuables d'items et historique d'utilisation.
- Collections, tags, droits et workflows de validation.
- Pools et plans de tirage équilibrés.
- Barèmes riches, feedback et tentatives configurables.
- Nouveaux types : passage, vidéo interactive, audio/vidéo, dessin, labeling,
  math/graphique et fichier.
- Compatibilité QTI 3 définie dans la spec 04.

## Non-objectifs V1

- Moteur de Computer Adaptive Testing psychométrique complet.
- Surveillance biométrique supplémentaire.
- Exécution de code non isolée sur l'infrastructure principale.
- Conversion parfaite de toute question propriétaire importée.

## Exigences fonctionnelles

### Banque et versions

- **ASM-001** — Un item possède une identité stable et des révisions immuables
  avec auteur, statut, langue, licence et changelog.
- **ASM-002** — États : brouillon, en revue, approuvé, publié, déprécié, archivé.
- **ASM-003** — Une évaluation publiée référence un snapshot de révision ; une
  correction d'item ne modifie aucune tentative antérieure.
- **ASM-004** — Collections personnelles, organisationnelles et partagées avec
  droits voir, utiliser, commenter et modifier.
- **ASM-005** — Métadonnées : compétences, objectifs, difficulté attendue,
  taxonomie cognitive, durée, source, langue, accessibilité et statistiques.
- **ASM-006** — Recherche plein texte, filtres combinables, prévisualisation et
  détection de doublons proposée mais validée humainement.

### Assemblage

- **ASM-007** — Section fixe ou pool aléatoire.
- **ASM-008** — Blueprint : quantité par collection, type, compétence,
  difficulté et langue, avec validation de faisabilité.
- **ASM-009** — Ordre, réponses et variantes randomisables selon la politique.
- **ASM-010** — Le tirage est enregistré par tentative pour reproduction et
  contestation.
- **ASM-011** — Formes parallèles partageant le même blueprint et comparables
  sans exposer les items.

### Barèmes et feedback

- **ASM-012** — Points fixes, score partiel, pénalité optionnelle, tolérance,
  ordre partiel et réponses équivalentes.
- **ASM-013** — Le barème est simulable sur des réponses exemples avant
  publication.
- **ASM-014** — Feedback global, par réponse et par erreur ; visibilité immédiate,
  après tentative, fermeture ou publication du formateur.
- **ASM-015** — Réponses ouvertes : rubrique manuelle, suggestions IA facultatives
  et validation humaine obligatoire avant note officielle.
- **ASM-016** — Contestation ou rescore en masse sur une version erronée, avec
  prévisualisation des impacts et audit.

### Nouveaux types

- **ASM-017 Passage** — Un stimulus texte/document/média partagé par plusieurs
  sous-questions, navigable et accessible.
- **ASM-018 Vidéo interactive** — Questions à des timecodes, pause, retour
  contrôlé, transcription et alternative textuelle.
- **ASM-019 Audio/vidéo** — Réponse enregistrée ou uploadée, consentement,
  limite, transcription et correction par rubrique.
- **ASM-020 Dessin/annotation** — Canvas avec alternative fichier/clavier,
  calques de réponse et export figé.
- **ASM-021 Labeling** — Zones et étiquettes, support clavier et tolérance.
- **ASM-022 Math/graphique** — Éditeur math accessible, équivalences numériques
  et placement de points/courbes dans un repère.
- **ASM-023 Fichier** — Dépôt contrôlé et transmission au workflow de correction.
- **ASM-024 Code** — Reporté derrière un runner isolé, quotas, tests cachés et
  politique de langages ; jamais exécuté dans le navigateur de l'auteur.

### Paramètres de passation

- **ASM-025** — Tentatives, fenêtre, durée, pause, navigation, reprise,
  sauvegarde et politique de résultat.
- **ASM-026** — Aménagements de la spec 05 appliqués après la configuration
  globale et avant le lancement.
- **ASM-027** — Mode pratique sans note distinct du mode certifiant.
- **ASM-028** — Contrôles d'intégrité : plein écran facultatif, journal, pools,
  ordre, codes, plages réseau et intégration future navigateur sécurisé ; aucun
  signal seul ne prouve une fraude.

## Permissions

- L'auteur modifie ses brouillons et propose une révision.
- Le reviewer approuve selon workflow de collection.
- Le formateur peut utiliser un item sans voir la réponse si la politique de la
  banque l'exige.
- Les réponses correctes privées sont servies uniquement au moteur de score.
- Le participant ne reçoit jamais clé, barème caché ou tests secrets.

## Modèle de données indicatif

- `assessment_items`, `assessment_item_revisions`, `item_assets`.
- `item_collections`, `item_collection_members`, `item_permissions`.
- `assessments`, `assessment_versions`, `assessment_sections`.
- `assessment_item_refs` et `assessment_pool_rules`.
- `assessment_attempt_forms` : tirage et ordre figés.
- `responses` : payload typé par interaction et version.
- `scoring_policies`, `score_adjustments`, `rescore_jobs`.
- `item_review_comments`, `item_statistics` issus de la spec 07.

Les réponses correctes restent dans un domaine privé accessible uniquement aux
services serveur, sur le modèle du durcissement existant des examens.

## IA d'assistance

- Génération depuis source avec citations internes vers les passages utilisés.
- Proposition de distracteurs, rubrique, niveau et compétences.
- Vérifications : doublon, indice involontaire, ambiguïté, biais et cohérence du
  barème.
- Tout contenu généré démarre en brouillon avec marqueur de provenance.
- L'organisation contrôle fournisseur, conservation, budget et désactivation.

## Critères d'acceptation

- Modifier un item publié crée une révision sans toucher aux tentatives passées.
- Un blueprint impossible est refusé avant ouverture de l'évaluation.
- Le tirage d'une tentative est reproductible par un auditeur autorisé.
- Un rescore affiche les personnes et certificats potentiellement impactés avant
  exécution.
- Les nouveaux types prioritaires possèdent une alternative accessible.
- Les clés de réponse ne figurent dans aucun payload participant.
- Une suggestion IA ne devient jamais une note officielle sans validation.
- Les statistiques restent séparées par révision et contexte.

## Mesures de succès

- Taux de réutilisation d'items approuvés.
- Temps de création d'une évaluation équilibrée.
- Nombre d'items retirés après signal psychométrique.
- Taux de rescoring et incidents de fuite de clé : cible zéro.

