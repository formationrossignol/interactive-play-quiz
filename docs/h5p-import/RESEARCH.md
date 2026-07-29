# Recherche — Import et lecture H5P

## Besoin couvert

Le module doit permettre à un auteur d’importer un fichier `.h5p`, de le
prévisualiser puis de l’ajouter à une leçon. Côté apprenant, il doit conserver
la progression, le score, le statut de réussite, le temps disponible et l’état
nécessaire à la reprise.

## Sources techniques

- La [spécification `.h5p`](https://h5p.org/documentation/developers/h5p-specification)
  définit le paquet comme une archive ZIP avec `h5p.json`, un éventuel
  `content/content.json` et les bibliothèques nécessaires.
- La [définition de `h5p.json`](https://h5p.org/documentation/developers/json-file-definitions)
  rend obligatoires le titre, la langue, la bibliothèque principale, les types
  d’intégration et les dépendances préchargées.
- La [structure de fichiers officielle](https://h5p.org/node/1) place les
  ressources du contenu sous `content/` et chaque bibliothèque dans son propre
  dossier avec `library.json`.
- H5P expose les résultats via
  [`H5P.externalDispatcher` et les événements xAPI](https://h5p.org/node/2397).
  Le suivi JavaScript exige que le lecteur et l’intégration appartiennent au
  même site.
- Le lecteur
  [`h5p-standalone`](https://github.com/tunapanda/h5p-standalone) exécute un
  paquet extrait sans serveur H5P complet et documente le chargement d’un état
  antérieur via `contentUserData`.

## Décisions

### Lecteur

`h5p-standalone` est utilisé pour le MVP. L’application ne fournit pas
d’éditeur H5P : elle consomme des paquets déjà construits.

### Import

Le navigateur valide puis décompresse l’archive avec JSZip. Les fichiers sont
envoyés dans le bucket public `h5p-packages` sous :

```text
<uploader_id>/<package_id>/<chemin_du_paquet>
```

Une réécriture Vercel rend ces fichiers disponibles sous `/h5p-content/*`.
Elle garde le lecteur et les bibliothèques sur l’origine Brivia en production,
condition nécessaire à la collecte xAPI.

### Validation

Le validateur :

- limite l’archive à 100 Mo, 5 000 fichiers et 300 Mo décompressés ;
- refuse les chemins absolus et les traversées de répertoires ;
- exige `h5p.json` et `content/content.json` ;
- valide les champs essentiels de `h5p.json` ;
- vérifie que la bibliothèque principale est bien incluse ;
- applique la liste d’extensions H5P autorisées ;
- supprime les fichiers déjà envoyés si l’import échoue en cours de route.

### Suivi et reprise

Les événements xAPI alimentent `h5p_tracking` :

- `score.raw`, `score.max`, `score.scaled` ;
- `result.success` et les verbes `passed` / `failed` ;
- `result.completion` ;
- l’extension xAPI `progress`, lorsqu’elle existe ;
- `result.duration`, lorsqu’elle existe.

Le lecteur interroge aussi `getCurrentState()` toutes les dix secondes. Cet
état est réinjecté au prochain chargement. Le suivi est écrit d’abord dans
`localStorage`, puis synchronisé avec Supabase : une panne réseau ne supprime
donc pas la reprise locale.

### Limite de confiance

Une bibliothèque H5P contient du JavaScript exécutable. Le validateur empêche
les formats hors spécification et les archives mal structurées, mais il ne
constitue pas un antivirus ni une signature cryptographique des bibliothèques.
Les organisations doivent importer des paquets provenant de sources de
confiance. Une version ultérieure pourra ajouter analyse antivirus et registre
de bibliothèques approuvées côté serveur.
