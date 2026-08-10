# 05 — Accessibilité, inclusion et aménagements individuels

Date : 2026-08-10  
Statut : proposé  
Priorité : P0 transverse  
Dépendances : design system, identité et inscriptions (02)

## Contexte

Brivia vise une base WCAG AA mais ne possède pas encore d'exigence produit
spécifique, de déclaration de conformité indépendante ni de modèle
d'aménagement par apprenant. Cette spec couvre le produit auteur, les contenus
créés et l'expérience de participation.

## Résultat utilisateur

Une personne utilise Brivia au clavier, avec lecteur d'écran, zoom ou réglages
de lecture sans perdre d'information ni de fonctionnalité. Les aménagements
attribués s'appliquent automatiquement et confidentiellement aux activités.

## Cibles

- WCAG 2.2 niveau AA pour l'application et les contenus natifs.
- RGAA courant pour le marché français.
- EN 301 549 lorsque nécessaire aux appels d'offres publics.
- Publication d'une déclaration d'accessibilité factuelle après audit externe.

La cible ne constitue pas une revendication de conformité avant validation.

## Objectifs

- Rendre les parcours critiques utilisables sans souris.
- Fournir des aménagements individualisés réutilisables.
- Empêcher ou signaler les erreurs d'accessibilité dans les builders.
- Proposer des alternatives aux médias et interactions chronométrées.
- Industrialiser tests automatiques, manuels et utilisateurs.

## Non-objectifs V1

- Corriger le code interne d'un package SCORM/H5P tiers.
- Diagnostiquer un handicap à partir du comportement.
- Exposer le motif médical d'un aménagement aux formateurs.
- Garantir qu'un PDF importé est accessible sans analyse.

## Exigences fonctionnelles

### Socle application

- **A11Y-001** — Ordre de focus logique, focus visible, liens d'évitement et
  landmarks sur toutes les pages authentifiées.
- **A11Y-002** — Toute action disponible au pointeur l'est au clavier ; le
  glisser-déposer possède une alternative déplacer avant/après.
- **A11Y-003** — Modales, menus, toasts et panneaux annoncent leur état, gèrent
  le focus et rendent celui-ci à l'élément déclencheur.
- **A11Y-004** — Zoom 200 %, reflow 400 % et tailles tactiles conformes sans
  chevauchement ni perte d'action.
- **A11Y-005** — Couleur, son et animation ne sont jamais l'unique vecteur
  d'information ; `prefers-reduced-motion` est respecté.
- **A11Y-006** — Messages d'erreur reliés au champ, synthèse d'erreurs et
  prévention avant action irréversible.

### Création de contenu

- **A11Y-007** — Toute image informative exige un texte alternatif ou la
  déclaration « décorative ».
- **A11Y-008** — Vidéo et audio possèdent sous-titres/transcription avant
  publication selon la politique organisation.
- **A11Y-009** — Titres, listes, tableaux, contraste et langue sont contrôlés.
- **A11Y-010** — Un vérificateur retourne erreurs, avertissements, localisation,
  explication et correction proposée.
- **A11Y-011** — Une publication peut être bloquée sur erreur critique selon la
  politique, jamais sur un simple avertissement sans explication.
- **A11Y-012** — La prévisualisation inclut clavier, contraste élevé et
  simulation de largeur/zoom ; elle ne prétend pas remplacer un audit.

### Aménagements

- **ACC-001** — Profil d'aménagement par organisation et apprenant, séparé du
  profil public.
- **ACC-002** — Paramètres : temps supplémentaire, pause autorisée, absence de
  limite, date prolongée, lecture à voix haute, saisie vocale, taille/espacement,
  police de lecture, contraste, réduction de mouvement et langue préférée.
- **ACC-003** — Paramètres d'évaluation facultatifs : nombre réduit d'options,
  tentative supplémentaire, indice, modalité alternative et salle/session
  distincte.
- **ACC-004** — Priorité : dérogation activité > inscription/session > profil
  organisation > préférences personnelles non certifiées.
- **ACC-005** — Le participant voit les aménagements actifs avant le démarrage ;
  les autres participants ne les voient jamais.
- **ACC-006** — Le formateur voit les effets nécessaires à l'activité, pas le
  diagnostic ou motif confidentiel.

### Alternatives d'interaction

- **A11Y-013** — Hotspot, dessin, classement et drag-drop disposent d'un mode
  clavier et d'une représentation textuelle équivalente.
- **A11Y-014** — Les graphiques possèdent titre, résumé et table de données
  accessible.
- **A11Y-015** — Les résultats live ne reposent pas uniquement sur une animation
  et peuvent être annoncés à la demande sans flux vocal continu.

## Permissions et confidentialité

- `registrar` ou rôle délégué gère les aménagements institutionnels.
- L'apprenant gère uniquement ses préférences d'affichage non certifiées.
- Le formateur peut proposer une dérogation ponctuelle mais pas consulter la
  justification administrative.
- Toute lecture ou modification d'un profil d'aménagement est auditée.
- Les exports généraux excluent les aménagements ; un export dédié exige un
  scope et une finalité explicites.

## Modèle de données indicatif

- `accessibility_preferences` : préférences personnelles.
- `accommodation_profiles` : org, learner, période de validité, état.
- `accommodation_rules` : type, valeur, périmètre et priorité.
- `accommodation_overrides` : activité/session ciblée.
- `content_accessibility_checks` : version de contenu, règle, sévérité, cible.
- `accessibility_audits` : périmètre, méthode, date, résultats et statut public.

Ne jamais stocker diagnostic médical ou pièce médicale si Brivia n'en a pas
besoin pour appliquer l'aménagement.

## Processus qualité

- Axe ou équivalent sur composants et pages dans la CI.
- Tests clavier et lecteur d'écran sur auth, dashboard, builder, join, activité,
  remise, résultat et paramètres.
- Matrice NVDA/Firefox, JAWS/Chrome, VoiceOver/Safari et TalkBack/Chrome selon
  audience supportée.
- Audit externe avant revendication, puis réaudit à chaque évolution majeure.
- Registre public des écarts connus, contournements et dates de correction.

## Critères d'acceptation

- Un quiz complet est réalisable au clavier et avec lecteur d'écran.
- Un temps supplémentaire est calculé côté serveur et survit à une reconnexion.
- Un formateur ne peut voir le motif d'un aménagement.
- Une image informative sans alternative déclenche une erreur localisée.
- Une interaction drag-drop peut être accomplie sans glisser.
- Les graphiques critiques ont une table de données équivalente.
- Les parcours critiques n'ont aucune violation automatique critique ; les
  tests manuels sont documentés.
- La déclaration publique distingue conforme, partiellement conforme et non
  audité sans formulation trompeuse.

## Mesures de succès

- Violations critiques par version et délai de correction.
- Taux de contenus publiés sans erreur d'accessibilité.
- Taux de réussite des parcours pour utilisateurs d'aménagements, analysé sans
  profiler individuellement.
- Nombre de demandes support liées à une barrière d'accès.

