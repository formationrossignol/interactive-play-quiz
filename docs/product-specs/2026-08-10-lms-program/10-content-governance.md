# 10 — Gouvernance, versionnement, localisation et diffusion du contenu

Date : 2026-08-10  
Statut : proposé  
Priorité : P1  
Dépendances : registre `content`, collaboration et organisations existants

## Contexte

Brivia stocke les contenus dans un registre polymorphe, organise des dossiers,
permet partage et collaboration et possède des builders spécialisés. Pour un
usage à l'échelle, il manque un modèle commun de version, validation,
publication, réutilisation, localisation et expiration.

## Résultat utilisateur

Une équipe crée à plusieurs, demande une revue, publie une version identifiée,
la déploie dans des sessions, traduit le contenu et sait exactement quelles
audiences utilisent quelle version. Une mise à jour ne modifie jamais
silencieusement une expérience ou un résultat historique.

## Objectifs

- Versionnement commun à tous les types de contenu.
- Workflow éditorial configurable et commentaires contextuels.
- Réutilisation de modèles, blocs et assets gouvernés.
- Localisation avec liens entre langues et validation en contexte.
- Cycle de vie : publication, adoption, dépréciation, expiration et archivage.
- Exports de diffusion standards lorsque le contenu le permet.

## Non-objectifs V1

- Remplacer Git pour les développeurs.
- Édition temps réel multi-auteur sur tous les builders dès le premier lot.
- DAM vidéo complet avec montage/transcodage propriétaire.
- Conversion garantie de toute interaction Brivia vers SCORM/QTI.

## Concepts

- **Content identity** : identité durable visible dans l'explorer.
- **Revision** : sauvegarde de travail mutable et autosauvegardée.
- **Version** : snapshot immuable créé pour revue ou publication.
- **Release** : version publiée pour un canal et une audience.
- **Deployment** : utilisation d'une release par une session, un parcours, une
  URL publique ou une intégration.

## Exigences fonctionnelles

### Versions

- **CNT-001** — Quiz, sondage, flashcard, slide, cours, parcours, examen et
  présentation partagent le même contrat de version.
- **CNT-002** — Une version contient auteur, origine, date, changelog, hash,
  schéma et dépendances figées.
- **CNT-003** — Comparaison structurelle : ajouts, suppressions, déplacements,
  paramètres et assets, avec vue adaptée au type.
- **CNT-004** — Restaurer crée une nouvelle révision depuis l'ancienne ; aucune
  version historique n'est modifiée.
- **CNT-005** — Les tentatives, sessions et certificats référencent la version
  réellement utilisée.

### Workflow éditorial

- **CNT-006** — États minimaux : brouillon, en revue, changements demandés,
  approuvé, publié, déprécié, archivé.
- **CNT-007** — Workflow par organisation avec un ou plusieurs reviewers et
  séparation auteur/approbateur facultative.
- **CNT-008** — Commentaires attachés à une cible stable (question, slide,
  leçon, bloc), fil, mention, résolution et pièces jointes limitées.
- **CNT-009** — Approbation porte sur une version précise ; toute modification
  après approbation l'invalide.
- **CNT-010** — Publication programmée, retrait programmé et note de version.

### Déploiement et mises à jour

- **CNT-011** — Un déploiement choisit `pinned` ou `follow-approved-updates`.
- **CNT-012** — Une mise à jour affiche diff, compatibilité, impact et audiences
  avant adoption.
- **CNT-013** — Une session commencée reste par défaut sur sa version.
- **CNT-014** — Une vulnérabilité ou erreur grave peut forcer une mise à jour,
  avec confirmation d'impact, audit et procédure de rollback.
- **CNT-015** — Dépendances supprimées ou non publiées bloquent une release.

### Modèles et blocs réutilisables

- **CNT-016** — Bibliothèque de modèles par type, tags, aperçu, propriétaire,
  statut et version.
- **CNT-017** — Blocs réutilisables pour leçons/slides avec modes copie ou lien.
- **CNT-018** — Un bloc lié signale les mises à jour ; l'adoption n'est jamais
  silencieuse pour un contenu publié.
- **CNT-019** — Brand kits : couleurs, polices autorisées, logo, composants et
  règles d'accessibilité, avec prévisualisation.

### Assets

- **CNT-020** — Bibliothèque média avec fichier original, variantes, licence,
  auteur, texte alternatif, langue, hash et usages.
- **CNT-021** — Remplacer un asset crée une version ; les contenus existants
  restent liés à leur variante jusqu'à adoption.
- **CNT-022** — Recherche d'usages avant suppression et prévention si preuve ou
  version publiée dépend de l'asset.
- **CNT-023** — Scan sécurité, quotas, types autorisés et URLs signées selon
  visibilité.

### Localisation

- **L10N-001** — Une famille de contenu relie source et variantes linguistiques.
- **L10N-002** — Extraction structurée des segments, sans casser variables,
  formules, réponses ou mise en forme.
- **L10N-003** — États par langue : non commencé, traduction, validation,
  à resynchroniser, publié.
- **L10N-004** — Diff de source identifie les segments obsolètes sans effacer la
  traduction existante.
- **L10N-005** — Glossaires organisationnels, notes de contexte et validation
  dans la prévisualisation réelle.
- **L10N-006** — Traduction IA facultative, marquée, révisée humainement et
  contrôlée par politique fournisseur.

### Publication et export

- **PUB-001** — Canaux : bibliothèque interne, catalogue, URL, embed, LTI et
  package téléchargeable lorsque supporté.
- **PUB-002** — Export SCORM 1.2/2004 et xAPI/cmi5 pour les cours compatibles,
  avec rapport des interactions non exportables.
- **PUB-003** — Export QTI traité par la spec 04 ; média/licence inclus selon
  droits.
- **PUB-004** — Preview link expirant, mot de passe facultatif, filigrane et
  analytics minimales.
- **PUB-005** — Expiration déclenche revue, prolongation, dépréciation ou retrait,
  jamais suppression automatique d'une preuve historique.

## Permissions

- Propriétaire, auteur, reviewer, traducteur, validateur linguistique,
  publisher et lecteur sont des permissions de ressource, mappables aux rôles.
- Le droit publier est distinct du droit modifier.
- Un reviewer externe utilise une invitation limitée au contenu/version.
- Les liens de preview ne donnent aucun accès à l'organisation ou aux données
  apprenants.

## Modèle de données indicatif

- `content_items` ou évolution de `content` pour l'identité durable.
- `content_revisions`, `content_versions`, `content_releases`.
- `content_deployments`, `content_dependencies`.
- `review_requests`, `review_steps`, `content_comments`.
- `content_templates`, `reusable_blocks`, `reusable_block_versions`.
- `media_assets`, `media_asset_versions`, `asset_usages`.
- `localization_sets`, `localized_versions`, `translation_segments`, `glossaries`.
- `publication_jobs`, `export_artifacts`, `preview_links`.

Une migration progressive doit maintenir la compatibilité avec `content.data` :
les premiers snapshots peuvent encapsuler le JSON existant avec `schema_version`
avant normalisation spécifique de chaque builder.

## UX principale

- Barre de statut dans chaque builder : brouillon, autosauvegarde, version
  publiée, changements non publiés et action « Demander une revue ».
- Panneau activité/commentaires et historique sans masquer le canvas principal.
- Écran de publication : contrôles accessibilité, dépendances, destinataires,
  version, changelog et date.
- Centre « Mises à jour disponibles » pour déploiements et blocs liés.
- Tableau localisation source × langues × état, avec accès au diff.

## Cas limites

- Une publication concurrente vérifie la version attendue et refuse l'écrasement.
- Supprimer un auteur ne supprime pas ses versions ; attribution conservée.
- Un commentaire sur un élément supprimé reste accessible depuis l'historique.
- Une langue en retard n'empêche pas les autres si la politique le permet.
- Un export échoué n'annule pas la release ; il possède son propre état/job.
- Les liens publics sont invalidés lors du retrait, sauf preuve historique
  explicitement conservée et protégée.

## Critères d'acceptation

- Une tentative historique ouvre la version exacte utilisée.
- Modifier après approbation invalide l'approbation sans toucher à la version.
- Restaurer une ancienne version crée une nouvelle version avec provenance.
- Un reviewer externe ne voit que la version invitée.
- Une mise à jour liée n'est jamais appliquée silencieusement à une release.
- Un segment source modifié marque les traductions correspondantes obsolètes.
- Un export annonce les éléments non représentables et ne les remplace pas
  silencieusement.
- Une suppression d'asset utilisé est bloquée avec la liste des dépendances.

## Mesures de succès

- Délai brouillon → publication et nombre d'allers-retours de revue.
- Taux de contenus publiés avec version/changelog complet.
- Taux de réutilisation des modèles et blocs.
- Temps de mise à jour d'une famille multilingue.
- Incidents de modification rétroactive d'une tentative : cible zéro.

