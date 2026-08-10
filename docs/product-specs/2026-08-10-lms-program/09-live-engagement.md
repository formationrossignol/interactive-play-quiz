# 09 — Sondage live, Q&A, modération et coanimation

Date : 2026-08-10  
Statut : proposé  
Priorité : P1  
Dépendances : sessions live existantes, accessibilité (05), analytics (07)

## Contexte

Brivia propose quiz et sondages synchrones/asynchrones, réactions, résultats et
présentations. Il manque une Q&A structurée, une modération déléguée, des formats
de décision collective et des intégrations permettant d'animer sans changer
d'outil de réunion ou de présentation.

## Résultat utilisateur

Un animateur prépare ou improvise une interaction, délègue la modération,
collecte questions et votes anonymes, présente les résultats de façon
accessible et retrouve un rapport exploitable après la session.

## Objectifs

- Q&A avant, pendant et après une session.
- Anonymat maîtrisé, votes, modération et réponses.
- Coanimateurs avec permissions limitées.
- Formats de priorisation et décision collective.
- Historique de sessions récurrentes et comparaison.
- Premières intégrations PowerPoint/Teams/Zoom après stabilisation de l'embed.

## Non-objectifs V1

- Plateforme de visioconférence ou streaming propriétaire.
- Modération automatique punitive.
- Réseau social public hors organisation.
- Garantie d'anonymat face à une obligation légale ; l'interface doit expliquer
  précisément le niveau d'anonymat.

## Exigences fonctionnelles

### Événement et accès

- **LIVE-001** — Un événement regroupe plusieurs sessions/interactions et possède
  code, QR, URL, dates, branding et politique participant.
- **LIVE-002** — Accès anonyme, pseudonyme, authentifié ou sur liste ; politique
  fixée avant ouverture et modification auditée.
- **LIVE-003** — Réutiliser un événement crée une nouvelle session de résultats
  sans écraser l'historique.
- **LIVE-004** — Lobby, capacité, verrouillage, expulsion et reconnexion
  atomiques.

### Q&A

- **QNA-001** — Une question contient texte, auteur public facultatif, statut,
  votes, tags, contexte de slide et timestamps.
- **QNA-002** — Collecte ouverte avant/pendant/après selon fenêtre.
- **QNA-003** — Votes positifs, retrait de son vote et tri populaire/récent.
- **QNA-004** — Statuts `pending`, `approved`, `live`, `answered`, `dismissed`,
  `archived` ; transitions auditées.
- **QNA-005** — Modérateur : approuver, refuser, fusionner doublons, tagger,
  éditer uniquement pour correction signalée, mettre en avant et marquer répondu.
- **QNA-006** — Réponse publique ou privée ; l'auteur reçoit une notification si
  son identité est connue.
- **QNA-007** — Mode anonyme masque l'identité au présentateur ; une éventuelle
  conservation technique pour abus est documentée, limitée et inaccessible aux
  animateurs.

### Coanimation

- **LIVE-005** — Rôles événement : propriétaire, présentateur, modérateur,
  opérateur technique et analyste.
- **LIVE-006** — Invitation par compte ou lien temporaire à portée limitée.
- **LIVE-007** — Synchronisation temps réel de l'interaction active, résultats,
  verrouillage et messages ; une seule autorité de navigation à la fois.
- **LIVE-008** — Journal des actions de modération et de contrôle.

### Interactions supplémentaires

- **LIVE-009** — Priorisation : allocation d'un budget de points entre options.
- **LIVE-010** — Matrice 2×2 : deux axes configurables et placement accessible.
- **LIVE-011** — Brainstorm : idées, groupes/catégories, vote et export.
- **LIVE-012** — Classement forcé et comparaison avant/après.
- **LIVE-013** — Texte libre : regroupement manuel ; regroupement IA facultatif,
  modifiable et signalé comme tel.
- **LIVE-014** — Analyse de sentiment uniquement agrégée, avec correction humaine
  et désactivation organisationnelle.

### Présentation et intégrations

- **LIVE-015** — Mode présentateur, écran public, appareil participant et console
  modérateur sont des vues distinctes.
- **LIVE-016** — Embed sécurisé et responsive pour LMS/pages autorisées.
- **LIVE-017** — PowerPoint add-in : sélectionner/insérer une interaction, lancer
  et afficher les résultats sans quitter le diaporama.
- **LIVE-018** — Teams/Zoom : rejoindre et répondre dans l'application hôte via
  leurs SDK officiels, avec fallback navigateur.
- **LIVE-019** — Google Slides/Webex évalués après preuve de fiabilité des deux
  premières intégrations.

### Rapports

- **LIVE-020** — Participation, complétion, réponses, questions/votes,
  interactions et chronologie.
- **LIVE-021** — Comparaison entre sessions d'un même événement et segments
  autorisés.
- **LIVE-022** — Export PDF/XLSX/CSV, anonymisé selon la politique de collecte.
- **LIVE-023** — Le rapport distingue absence de réponse, perte de connexion et
  interaction non présentée.

## Modèle de données indicatif

- `live_events`, `live_event_members`, `live_runs`.
- `live_participants` : identité/pseudonyme et présence par run.
- `audience_questions`, `audience_question_votes`, `audience_question_actions`.
- `live_interactions`, `live_interaction_versions`, `live_responses`.
- `brainstorm_ideas`, `idea_groups`, `idea_votes`.
- `live_control_leases` pour l'autorité de navigation.
- `meeting_integrations` et `meeting_launches`.

## Temps réel et robustesse

- Identifiant client d'idempotence pour réponse, question, vote et contrôle.
- Reconnexion restitue état courant sans rejouer animation ni doubler un vote.
- Le serveur fixe ouverture/fermeture et horodatage des réponses.
- Les résultats publics sont agrégés côté serveur ; les réponses individuelles
  suivent les permissions de rapport.
- Mode dégradé : l'animateur peut continuer les slides si le canal live tombe,
  avec message clair aux participants et reprise contrôlée.

## Modération et sécurité

- Filtre de termes configurable comme assistance, jamais suppression invisible.
- Rate limits par participant, appareil et événement.
- Signalement d'abus distinct d'un simple refus de publication.
- Liens/codes courts expirables et révocables.
- Données anonymes soumises à rétention courte configurable.
- Aucun participant ne peut inférer le vote ou la question privée d'un autre.

## Accessibilité

- Navigation clavier et lecteur d'écran sur votes, questions et résultats.
- Mode faible animation et absence de compte à rebours visuel seul.
- Texte alternatif/table de données pour chaque visualisation.
- Matrice et placement possèdent une saisie numérique/textuelle alternative.
- Contraste et taille de l'écran public testés en contexte de projection.

## Critères d'acceptation

- Deux votes identiques rejoués ne comptent qu'une fois.
- Un modérateur externe n'obtient aucun accès au reste de l'organisation.
- Une question non approuvée n'apparaît jamais sur l'écran public.
- La reconnexion rétablit interaction et réponse déjà envoyée.
- Réinitialiser une session conserve l'ancien run et crée un nouvel historique.
- Les exports respectent le mode anonyme choisi.
- La Q&A est utilisable au clavier et avec lecteur d'écran.
- Perdre l'intégration Teams/PowerPoint propose un fallback sans perdre la
  session Brivia.

## Mesures de succès

- Taux de participation et de questions traitées.
- Latence p95 réponse → agrégat visible.
- Taux de reconnexion réussie sans doublon.
- Sessions animées depuis une intégration tierce.
- Incidents de contenu non modéré affiché : cible zéro en mode modéré.

