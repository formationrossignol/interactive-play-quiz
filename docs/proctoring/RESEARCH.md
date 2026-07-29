# Recherche — module de proctoring

## Objectif

Ajouter une surveillance d’examen entièrement optionnelle, progressive et vérifiable, sans transformer une alerte technique en preuve automatique de fraude.

## Intégration retenue

Le module s’appuie sur le flux d’examen existant :

- `ExamBuilder` configure un niveau et ses options ;
- `ExamRoom` réalise un contrôle préalable puis journalise la tentative ;
- `ExamAdmin` présente les alertes, médias et la décision modifiable ;
- Supabase conserve les événements, rapports et médias privés ;
- `proctoring-api` centralise les écritures anonymes, la vérification SEB et les accès enseignant.

Les anciens examens restent compatibles : l’absence de configuration équivaut à `enabled: false` et `level: none`.

## Safe Exam Browser

SEB expose, selon sa version et son moteur, la Browser Exam Key et la Config Key via des en-têtes HTTP ou son API JavaScript. La valeur fournie au site est un SHA-256 de l’URL absolue sans fragment concaténée à la clé.

Décision :

- stocker les clés brutes dans `exam_proctoring_secrets`, sans politique d’accès client ;
- ne publier dans `exams.proctoring_config` que `sebKeyConfigured: true/false` ;
- comparer côté Edge Function le hash reçu de SEB au hash attendu ;
- refuser le démarrage si la version, la présence de SEB ou la clé ne correspondent pas.

Référence : [SEB Developer Documentation — Config Key](https://safeexambrowser.org/developer/seb-config-key.html).

## Captures et limites navigateur

`getDisplayMedia()` exige HTTPS, une action explicite de l’utilisateur et une nouvelle autorisation à chaque session. L’application ne peut donc ni sélectionner silencieusement un écran ni mémoriser cette autorisation.

Décision :

- demander le partage dans le contrôle préalable ;
- conserver le flux uniquement pendant la tentative ;
- capturer en JPEG compressé, au maximum 1 280 px de large ;
- envoyer le média à une fonction serveur qui le place dans un bucket privé ;
- n’exposer que des URL signées de cinq minutes à l’enseignant.

Référence : [MDN — MediaDevices.getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).

## Vie privée

Les principes appliqués sont :

- minimisation : chaque source est désactivable ;
- information préalable avant toute permission ;
- confirmation explicite configurable ;
- durée de conservation par examen ;
- médias privés, sans URL publique ;
- accès aux rapports et captures journalisés ;
- purge physique des fichiers puis des métadonnées ;
- analyse automatique formulée comme alerte à vérifier.

Référence : [RGPD, article 5 — minimisation et limitation de conservation](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

La configuration technique ne remplace pas l’analyse juridique, la base légale, l’étude d’impact éventuelle, la politique de confidentialité ni la gestion des droits des personnes de chaque organisation.

## Limites connues

- Le navigateur peut bloquer ou ne pas proposer la détection multi-écrans.
- Le blocage des raccourcis JavaScript réduit les erreurs et tentatives simples, mais n’est pas une barrière système ; SEB apporte le verrouillage fort.
- Les options « absence de visage », « plusieurs visages » et « regard hors écran » sont prévues dans le contrat de configuration. Elles nécessitent le branchement d’un moteur de vision validé avant d’être activées en production.
- La purge automatique nécessite une tâche planifiée appelant `purge-expired`.
