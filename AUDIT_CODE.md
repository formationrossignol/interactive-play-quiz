# Audit technique

> Application : **Arcade Pop** (nom interne `vite_react_shadcn_ts`) — plateforme de quiz interactifs, sondages, flashcards, présentations, cours (LMS léger) et examens.
> Branche auditée : `feat/supabase-auth-premium-design` — commit `511caf6`.
> Date : 2026-07-12.
> Auditeur : analyse statique + exécution des commandes du dépôt. Aucune donnée modifiée, aucune migration exécutée.

---

## 1. Résumé exécutif

**Verdict global : NON PRÊT pour un usage « examen / évaluation notée » en production. PRÊT SOUS CONDITIONS pour un usage « quiz ludique local ».**

Le constat central, **factuel et vérifié**, est architectural : **il n'existe aucun backend applicatif**. C'est une SPA Vite/React pure. Tout le domaine métier (quiz, sondages, flashcards, cours, examens, tentatives, notes, progression, banque de questions, corbeille) est stocké **dans le `localStorage` du navigateur**. La seule ressource serveur est Supabase, utilisée uniquement pour (a) l'authentification et (b) une table `session_state` servant de canal de synchronisation temps réel pour les parties live.

Conséquences directes :

- **Les données « privées » ne le sont pas** entre appareils : un quiz, un cours ou un examen créé sur un poste n'existe que sur ce poste. Le partage cross-device passe uniquement par la copie des questions (réponses correctes incluses) dans `session_state`.
- **Toute la notation est calculée côté client** (`PlayerView.tsx`, `examStorage.ts`) et **les réponses correctes sont livrées au client** avant/pendant la réponse. La fraude au score est triviale.
- **Aucune autorisation côté serveur** : les contrôles de propriété (`userId === user.id`) sont des `if` JavaScript sur des données locales, contournables par édition du `localStorage`.
- Les tentatives d'examen, notes et « attestations » n'ont **aucune valeur probante**.

En revanche, la **qualité front-end est bonne** : TypeScript strict compile sans erreur, build OK, tests unitaires passent (8/8), lazy-loading des routes, découpage propre des couches `lib/`, gestion soignée de la concurrence des writes Supabase en live (debounce, RPC atomique upsert par joueur). Le code est lisible et cohérent.

Le produit est **excellent comme jouet de quiz en salle** (façon Kahoot local) et **inadapté comme LMS / plateforme d'examen certifiante** tant qu'un backend avec autorisation et notation serveur n'est pas ajouté.

---

## 2. Méthodologie

### Fichiers inspectés (intégralement ou en partie)
`package.json`, `vite.config.ts`, `vercel.json`, `.gitignore`, `eslint.config.js`, `tailwind.config.ts`, `index.html`, `src/App.tsx`, `src/lib/{supabase,auth,authMigration,quizStorage,examStorage,courseStorage,sessionState,pollResults,importParsers,questionBank,questionTypes}.ts`, `src/pages/{JoinExam,ExamRoom,JoinQuiz,CourseViewer}.tsx`, `src/components/{PlayerView,QuizSession}.tsx` (partiel), `src/lib/__tests__/authMigration.test.ts`. Arborescence complète listée (203 fichiers source).

### Commandes exécutées (résultats réels)
| Commande | Résultat |
|---|---|
| `git status` / `git log -5` | OK — 3 fichiers plan non suivis, sinon propre |
| `npx tsc --noEmit -p tsconfig.app.json` | **Exit 0** ⚠️ voir note ci-dessous |
| `npm run lint` (eslint) | **Exit 0** mais **274 problèmes (230 errors, 44 warnings)** rapportés en sortie |
| `npm test` (vitest) | **Exit 0 — 8 tests passent** (1 fichier : `authMigration`) |
| `npm run build` (vite) | **Exit 0** — build en 12,7 s ; 4 chunks > 370 kB |
| `npm audit` | **16 vulnérabilités (11 high, 5 moderate)** |

> **Note tsc :** la sortie `tsc` a affiché **6 erreurs de types** (`RichTextEditor.tsx:84`, `courseGenerator.ts:168`, `ExamAdmin.tsx:337`, `Index.tsx:340` ×3) **mais le process a renvoyé exit 0** — parce que la commande shell a évalué le code retour du `echo` final, pas celui de `tsc`. **Déduction (confiance élevée) : `tsc -p tsconfig.app.json` échoue réellement.** Le `npm run build` réussit malgré tout car Vite/SWC transpile sans vérification de types (`vite build` n'invoque pas `tsc`). Il n'existe **pas de script `typecheck`** dans `package.json`.

### Commandes non exécutées / non disponibles
Pas de scripts `typecheck`, `test:integration`, `test:e2e`, `test:coverage`, `analyze`. Aucun CI détecté (`.github/` absent). Aucune migration/seed Supabase dans le dépôt.

### Zones NON auditées (voir §24)
Schéma Supabase et politiques RLS (hors dépôt), composants volumineux non lus ligne à ligne (`QuizBuilder` 1427 l., `QuizSession` 1745 l. lu partiellement, `PlayerView` 1572 l. lu partiellement, `CourseBuilder`), la plupart des pages marketing, le rendu des types de questions avancés.

### Limites d'environnement
Impossible d'inspecter la base Supabase, les policies RLS, les Edge Functions, les variables d'environnement de production, ou d'exécuter l'app avec un backend réel. Les conclusions sur RLS sont des **déductions** à partir du code client.

---

## 3. Architecture observée

**Stack (fait, confiance élevée) :**
- **Frontend** : React 18 + Vite 5 + TypeScript 5.8, SWC. Router : `react-router-dom` v6 (SPA, `BrowserRouter`, rewrites Vercel vers `index.html`).
- **UI** : shadcn/ui (Radix) + Tailwind + CSS maison (`arcade-pop.css`, styles inline massifs).
- **State** : état local React + `@tanstack/react-query` (installé, `QueryClient` monté, mais **quasi inutilisé** — pas de `useQuery` sur le domaine ; les données viennent du `localStorage` en synchrone).
- **Backend** : **aucun**. Persistance = `localStorage` / `sessionStorage`.
- **BaaS** : Supabase (`@supabase/supabase-js`) — Auth (email/password, TOTP MFA, reset) + une table `session_state` + Realtime (`postgres_changes`) + 3 RPC (`upsert_session_player`, `remove_session_player`, et un upsert de state).
- **Build/Deploy** : Vite → Vercel (statique). `vercel.json` : headers de cache + `X-Content-Type-Options: nosniff`, SPA rewrite.
- **Tests** : Vitest (1 fichier).
- **Package manager** : ambigu — présence simultanée de `bun.lockb` **et** `package-lock.json` (npm). Risque de dérive de versions.

**Couches (`src/lib/`)** : découpage clair par domaine (`quizStorage`, `examStorage`, `courseStorage`, `sessionState`, `pollResults`, `questionBank`, `folderStorage`). Chaque module = accès `localStorage` + règles. Bonne cohésion. Le couplage à `getCurrentUser()` (cache synchrone) est central.

**Points d'entrée / chemins critiques** :
- Création : `/builder*`, `/exam-builder`, `/course-builder` → `saveQuiz`/`createExam`/`createCourse` (localStorage).
- Live host : `/quiz/:gameCode` → `QuizSession` → écrit `session_state` Supabase + `quiz_data`.
- Live player : `/join/:gameCode` → `JoinQuiz` → `PlayerView` → lit `quiz_data`, calcule score, écrit son joueur via RPC.
- Examen : `/take/:joinCode` → `ExamRoom` → `startAttempt`/`submitAttempt` (localStorage, **même appareil uniquement**).

---

## 4. Cartographie fonctionnelle (ce qui existe réellement)

| Fonction | Présent | Réalité technique |
|---|---|---|
| **Quiz** | ✅ | Création riche, ~9 types de questions, live multi-joueurs via Supabase, scoring client |
| **Sondage** | ✅ | Types échelle/NPS/étoiles/likert/open-text, live, résultats localStorage |
| **Flashcards** | ✅ | Éditeur + session de révision |
| **Présentations (slides)** | ✅ | Éditeur + session de présentation |
| **LMS / Cours** | ⚠️ partiel | Modules/leçons, progression (localStorage), leçons texte/vidéo/quiz/flashcard/document/PDF. **Pas d'inscription, pas de cohortes, pas de multi-tenant** |
| **Examens** | ⚠️ | Tentatives, durée, tentatives max, shuffle, seuil, politiques de résultat. **Mono-appareil, localStorage, notation client** |
| **Attestation / Certificat** | ⚠️ | Bouton « Obtenir mon attestation » (`CourseViewer`), génération purement cliente, **aucune vérification/anti-fraude** |
| **Collaboration temps réel** | ⚠️ | Uniquement sessions live quiz/poll (host→players). Pas d'édition collaborative |
| **Reporting** | ⚠️ | Stats examen + export CSV, calculés localement sur données locales |
| **Carte mentale** | ❌ | **ABSENT** — aucune trace de mind-map/nœuds/graphe dans le code |
| **Standards SCORM/xAPI/LTI/H5P** | ❌ | Absents |
| **Multi-tenant / organisations / rôles** | ❌ | Absents — un seul « rôle » implicite (utilisateur connecté = auteur ; participant = anonyme) |

> Les phases 8 (carte mentale) du cahier des charges sont **sans objet** : la fonctionnalité n'existe pas.

---

## 5. Points positifs (réellement observés)

1. **TypeScript strict** — le code applicatif compile (hors 6 erreurs récentes non bloquées par le build) ; typage des domaines soigné (`examStorage.ts`, `sessionState.ts`).
2. **Concurrence live bien pensée** — `sessionState.ts` : writes joueurs via RPC atomique `upsert_session_player` (jamais d'écrasement des autres joueurs), debounce 800 ms des heartbeats, flush urgent pour les réponses, host n'écrit jamais le tableau `players`. C'est le point d'ingénierie le plus mûr du projet.
3. **Lazy-loading complet des routes** (`App.tsx`) avec chunks séparés builder/player.
4. **Gestion d'erreur défensive** sur les lectures `localStorage` (try/catch systématiques, fallbacks).
5. **MFA TOTP correct** — enrôlement, challenge, vérification AAL2, gating de session (`auth.ts:61-65`) empêchant l'accès tant que le 2ᵉ facteur n'est pas satisfait. Nettoyage des facteurs `unverified` orphelins.
6. **`changePassword` re-vérifie le mot de passe courant** avant modification (`auth.ts:171`).
7. **Corbeille avec purge à 30 j** et soft-delete cohérent (quiz + cours).
8. **`.env.local` bien ignoré** par git ; aucun secret committé détecté.
9. **Export CSV correctement échappé** (guillemets doublés + BOM UTF-8, `examStorage.ts:377`).

---

## 6. Problèmes CRITIQUES

### [C-1] Notation entièrement côté client + réponses correctes exposées au participant
- **Domaine** : quiz / examen / sécurité — **Gravité : Critique — Priorité : P0 — Confiance : élevée — Type : fait**
- **Fichiers** : `src/components/PlayerView.tsx:447-513`, `src/lib/examStorage.ts:289-315`, `src/lib/sessionState.ts:114-129`
- **Preuve** : le score est calculé dans le navigateur du joueur (`const correct = …; const earnedPoints = …; upsertPlayerInSession(gameCode, updated, true)`) puis écrit tel quel dans Supabase via RPC. Les questions — **avec `correctAnswer`, `correctOrder`, `correctMatches`, `blanks[].correctAnswer`, `correctValue`** — sont chargées côté client depuis `session_state.quiz_data` (`PlayerView.tsx:232`, `JoinQuiz.tsx:88`).
- **Impact** : un participant peut (a) lire la bonne réponse dans le state React / la réponse réseau avant de répondre, (b) poster n'importe quel score arbitraire via la console ou en appelant directement l'RPC. Idem examens : `submitAttempt` écrit le score en localStorage, modifiable à volonté.
- **Scénario** : joueur ouvre les DevTools → inspecte `quiz_data.questions[i].correctAnswer` → répond juste ; ou appelle `supabase.rpc('upsert_session_player', { p_player: {…score: 999999} })`.
- **Recommandation** : déplacer la notation **côté serveur** (Edge Function / RPC SECURITY DEFINER) ; ne transmettre au client que les énoncés et options, jamais les clés de correction ; valider le score serveur. Sans backend, le mode « quiz ludique » reste acceptable mais tout usage noté doit être marqué comme non fiable.
- **Effort** : élevé.

### [C-2] Absence d'autorisation côté serveur — RLS probablement absente sur `session_state`
- **Domaine** : sécurité / permissions — **Gravité : Critique — Priorité : P0 — Confiance : moyenne (RLS hors dépôt) — Type : déduction**
- **Preuve** : le client lit/écrit `session_state` librement (`JoinQuiz` fait un `select('game_code')` anonyme réussi ; les joueurs appellent des RPC d'écriture). La clé utilisée est `VITE_SUPABASE_ANON_KEY` (publique, embarquée dans le bundle). Aucune vérification d'appartenance côté client au-delà du `game_code`.
- **Impact** : si les policies RLS sont permissives (ce que suggère l'accès anonyme en lecture), n'importe qui connaissant/brute-forçant un `game_code` à **6 chiffres** (10⁶, énumérable) peut lire `quiz_data` (donc les réponses), injecter des joueurs, ou corrompre l'état de partie d'autrui. Fuite d'événements entre salles possible.
- **Scénario** : script itérant `100000`→`999999` sur `session_state.game_code`, extraction de tous les quiz actifs et de leurs réponses.
- **Recommandation** : **vérifier et durcir les policies RLS** (lecture publique limitée aux colonnes non sensibles ; écriture joueur bornée par RPC contrôlée). Allonger/aléatoiriser les game codes. À confirmer par un accès à la console Supabase (hors périmètre de cet audit).
- **Effort** : moyen.

### [C-3] XSS stocké via `dangerouslySetInnerHTML` sur contenu de leçon non nettoyé
- **Domaine** : sécurité — **Gravité : Critique — Priorité : P0 — Confiance : élevée — Type : fait**
- **Fichiers** : `src/pages/CourseViewer.tsx:481` (`__html: lesson.content`), `:606` (`renderMarkdown(lesson.content)`)
- **Preuve** : `lesson.content` (HTML issu de l'éditeur TipTap **ou** d'un import de document/markdown) est injecté sans sanitisation. `renderMarkdown` (`:83-97`) fait des `replace` regex et **n'échappe pas** le HTML brut d'entrée — un `<img src=x onerror=…>` dans le markdown importé passe tel quel.
- **Impact** : un cours importé (fichier `.md`/`.docx` via `mammoth`) ou partagé public peut exécuter du JS arbitraire dans la session de la victime (vol de session Supabase, actions au nom de l'utilisateur). Aujourd'hui l'exposition est limitée (contenu surtout auto-produit, pas de partage serveur), mais la surface existe dès qu'un contenu externe est rendu.
- **Recommandation** : sanitiser avec DOMPurify avant tout `dangerouslySetInnerHTML` ; échapper l'entrée dans `renderMarkdown`. Ajouter une CSP stricte (voir [H-4]).
- **Effort** : faible.

### [C-4] Données métier « privées » stockées uniquement en localStorage — perte de données & non-confidentialité
- **Domaine** : fiabilité / confidentialité / LMS — **Gravité : Critique — Priorité : P0 — Confiance : élevée — Type : fait**
- **Fichiers** : `quizStorage.ts`, `examStorage.ts`, `courseStorage.ts`, `pollResults.ts`, `questionBank.ts`, `folderStorage.ts` (tous `localStorage`)
- **Preuve** : aucune persistance serveur du contenu créé. `writeAllCourses` gère même explicitement `QuotaExceededError` (`courseStorage.ts:65`) — les PDF importés en base64 saturent le quota ~5–10 Mo du navigateur.
- **Impact** : vider le cache, changer de navigateur/appareil, ou dépasser le quota = **perte totale et irréversible** des quiz, cours, examens, notes, progression et résultats de sondage. Les « résultats d'examen » n'existent que sur l'appareil du participant (`ExamRoom` lit/écrit `lms_exam_attempts` localement) — le formateur ne les voit **jamais**.
- **Recommandation** : persister le domaine dans Postgres/Supabase avec RLS par `userId`. C'est le chantier structurant du produit.
- **Effort** : élevé.

---

## 7. Problèmes ÉLEVÉS

### [H-1] Examens non collaboratifs — le participant et le formateur ne partagent aucune donnée
- **Gravité : Élevé — P1 — Confiance : élevée — Type : fait.** `ExamRoom.tsx` et `ExamAdmin` lisent le même `localStorage` (`lms_exams`, `lms_exam_attempts`). Un participant sur son propre appareil crée une tentative **dans son localStorage**, invisible du formateur. Le module examen ne fonctionne que si formateur et élève partagent le même navigateur. **Le cas d'usage « examen à distance » est non fonctionnel.**

### [H-2] Contrôle du nombre de tentatives et du temps contournable
- **Gravité : Élevé — P1 — Confiance : élevée — Type : fait.** `startAttempt` (`examStorage.ts:184-186`) compte les tentatives dans le localStorage local ; l'effacer réinitialise le compteur. La deadline se recalcule à partir de `attempt.startedAt` local (`ExamRoom.tsx:135`), modifiable. `identify` génère un `participantId` aléatoire (`ExamRoom.tsx:198`) → nouvelle identité = nouvelles tentatives. Aucune unicité serveur.

### [H-3] 16 vulnérabilités npm dont 11 « high » (résultat de commande)
- **Gravité : Élevé — P1 — Confiance : élevée — Type : résultat de commande.** `npm audit` : **`xlsx` (Prototype Pollution + ReDoS, aucun correctif disponible)**, `rollup` (écriture arbitraire via path traversal, dev), `yaml` (DoS stack overflow). `xlsx` et `js-yaml` traitent des **fichiers importés par l'utilisateur** → surface d'attaque réelle (prototype pollution via un `.xlsx`/`.yaml` malveillant). Recommandation : remplacer `xlsx` (SheetJS communautaire non patché) par une alternative maintenue ou isoler le parsing.

### [H-4] Aucune Content-Security-Policy
- **Gravité : Élevé — P1 — Confiance : élevée — Type : fait.** `index.html` et `vercel.json` ne définissent aucune CSP. Seul `X-Content-Type-Options: nosniff` est présent. Combiné à [C-3], rien ne limite l'exécution de scripts injectés ni l'exfiltration. Ajouter une CSP (`default-src 'self'` + domaines Supabase + `frame-src` YouTube).

### [H-5] `tsc` échoue réellement + 230 erreurs ESLint non bloquantes
- **Gravité : Élevé — P2 — Confiance : élevée — Type : résultat de commande.** 6 erreurs de types réelles masquées par un exit code trompeur (voir §2) ; le build ne fait aucune vérification de types. 230 erreurs ESLint (surtout `no-explicit-any`). **Aucun CI** ne bloque ces régressions. Ajouter un script `typecheck: tsc -p tsconfig.app.json --noEmit` et un workflow CI (lint + typecheck + test) obligatoire.

### [H-6] `git_data` expose les réponses correctes en clair dans le canal live
- **Gravité : Élevé — P1 — Confiance : élevée — Type : fait.** Corollaire de [C-1] : même sans DevTools, un participant peut sniffer la réponse réseau Supabase (`quiz_data`) qui contient l'intégralité des corrections dès le chargement de la session. Pour un quiz noté c'est disqualifiant. Solution liée à [C-1] (ne pas transmettre les clés).

### [H-7] Chunks JS très lourds (résultat de build)
- **Gravité : Élevé — P2 — Confiance : élevée — Type : résultat de commande.** `index-DZL1UYDI.js` 537 kB, `index-DRIIybu_.js` 495 kB, `CourseBuilder` 431 kB, `PollResults` 373 kB (avant gzip). Vite avertit explicitement. Impact TTI sur mobile/3G. Introduire `manualChunks` (séparer `recharts`, `xlsx`, `mammoth`, TipTap) et charger `xlsx`/`mammoth` en dynamique à l'usage.

---

## 8. Problèmes MOYENS

### [M-1] Score de vitesse en virgule flottante sans normalisation cohérente
`PlayerView.tsx:482` : `Math.round(base * (timeLeft / timeLimit))`. `timeLeft` côté client peut dériver ; pas de plancher/plafond serveur. Scores potentiellement incohérents entre joueurs selon la latence. **Moyen — P2 — déduction.**

### [M-2] `getPollOptions` / résultats de sondage calculés et stockés client
`pollResults.ts` : agrégation dans le localStorage du host. Pas d'unicité de vote garantie autrement que par la session du navigateur. Bourrage d'urne trivial (rejoindre plusieurs fois). **Moyen — P2 — fait.**

### [M-3] `rateQuiz` — anti double-note contournable
`quizStorage.ts:202-227` : l'unicité repose sur `quiz_user_ratings` en localStorage. Effacer la clé permet de re-noter. Moyenne recalculée localement, aucune source de vérité. **Moyen — P3 — fait.**

### [M-4] Deux lockfiles concurrents (`bun.lockb` + `package-lock.json`)
Risque de builds non reproductibles selon l'outil. Choisir un gestionnaire unique. **Moyen — P2 — fait.**

### [M-5] `react-query` monté mais inutilisé pour le domaine
`QueryClientProvider` présent, mais les données sont lues en synchrone depuis localStorage. Dette : la couche cache/invalidation n'apporte rien et masque l'absence de vraie couche données. **Moyen — P3 — déduction.**

### [M-6] Composants monolithiques
`QuizSession.tsx` (1745 l.), `PlayerView.tsx` (1572 l.), `QuizBuilder.tsx` (1427 l.) mélangent logique de jeu, réseau, scoring et rendu (dont styles inline massifs). Testabilité et maintenabilité dégradées. **Moyen — P2 — fait.**

### [M-7] `getAnswerOrder` — mélange déterministe par hash faible
`ExamRoom.tsx:34-47` : shuffle des réponses dérivé d'un hash `attemptId+questionId` fait maison. Prévisible ; suffisant pour l'affichage mais ne doit pas être considéré comme une protection. **Moyen — P3 — fait.**

---

## 9. Problèmes FAIBLES

- **[L-1]** 44 warnings `react-hooks/exhaustive-deps` — risque de bugs de synchronisation d'état. P3.
- **[L-2]** `tailwind.config.ts:126` utilise `require()` (erreur ESLint). P3.
- **[L-3]** Styles inline omniprésents au lieu de classes → poids DOM et duplication. P3.
- **[L-4]** `console.error`/`console.warn` verbeux en prod (`sessionState.ts`) exposant `game_code` et états — nettoyer avant prod. P3.
- **[L-5]** `PreviewPage.tsx:378` bloc vide (`no-empty`). P3.

---

## 10. Audit du moteur de quiz

**Types supportés (fait)** : `multiple-choice`/`single-choice`, `true-false`, `short-answer`, `ranking`, `matching`, `fill-blank`, `slider` — validation de correction présente pour chacun dans `PlayerView.tsx:447-478`. `drag-drop` et `hotspot` déclarés dans `questionTypes.ts` mais **pas de branche de correction** dans le live (confiance moyenne : non traités = jamais « corrects »).

- **Création/édition** : brouillon → sauvegarde localStorage, duplication, import (YAML/CSV/MD/xlsx/docx), banque de questions, tags, catégories. Pas de versioning ; **modifier un quiz après le début d'une partie live est possible** (le host peut ré-uploader `quiz_data`).
- **Passage** : démarrage/reprise via `sessionStorage` joueur ; heartbeat 5 s ; détection déconnexion >15 s ; ordre aléatoire host-contrôlé.
- **Notation** : **cliente** (voir [C-1]). Bonus vitesse arrondi, plancher 10 % (`:482`). Pas de recalcul serveur, pas d'idempotence forte (protégée par `hasAnsweredRef` local uniquement).
- **Risques majeurs** : [C-1], [H-6], [M-1].

---

## 11. Audit du moteur de sondage

- Types : `single/multiple-choice`, `likert-scale`, `frequency-scale`, `star-rating`, `nps-scale`, `open-text`, `ranking` (`pollResults.ts:9-23`).
- Live via la même infra `session_state`. Résultats agrégés et **stockés localement** (`savePollSession`).
- **Anonymat** : les réponses ouvertes sont tronquées à 500 car. et rattachées au joueur (`PlayerView.tsx:502`) → **pseudonymat, pas anonymat** ; le nom du joueur est lié à sa réponse dans `session_state.players`.
- **Risques majeurs** : double vote / bourrage ([M-2]), résultats non fiables sous concurrence multi-appareils, réidentification des répondants.

---

## 12. Audit du moteur de carte mentale

**Sans objet — la fonctionnalité n'existe pas dans le dépôt.** Aucun module `mindmap`, nœud, graphe, ni dépendance de layout de graphe. (Phase 8 du cahier des charges non applicable.)

---

## 13. Audit LMS

- **Cours** : modules/leçons, types text/video/quiz/flashcard/document(PDF/markdown), duplication (régénère les IDs — correct), soft-delete + purge 30 j, progression par `completedLessonIds` en localStorage.
- **Progression** : `markLessonComplete` — pas de bornage, complétion possible **sans consultation réelle** (le clic suffit). Purement client → [C-4].
- **Inscriptions / cohortes / prérequis / parcours adaptatifs** : **absents**.
- **Attestations** : bouton présent, génération cliente, **aucune vérification, aucun identifiant infalsifiable, aucune révocation** → un certificat peut être « obtenu » sans réussite réelle. **Critique fonctionnel** (regroupé sous [C-4]/[C-1]).
- **Reporting** : `computeExamStats` + `exportCSV` corrects **mais sur données locales** (donc partielles/non fiables).
- **Standards** (SCORM/xAPI/LTI/H5P) : absents malgré aucune dépendance les nommant — pas de fausse promesse ici.

---

## 14. Authentification et permissions

**Solide au niveau Supabase Auth (fait)** : signup avec confirmation email, login, reset password, `updatePassword`, `changePassword` (re-vérifie l'ancien mdp), MFA TOTP complet avec gating AAL2 (`auth.ts`). Sessions/refresh gérés par supabase-js. Pas de mot de passe stocké côté app.

**Faible au niveau autorisation métier (fait/déduction)** :
- **Aucun système de rôles** (admin/formateur/apprenant/…). Un utilisateur connecté = auteur de tout ce qu'il crée localement.
- Les contrôles `userId === user.id` (`quizStorage`, `courseStorage`, `examStorage`) sont des `if` **sur des données localStorage** → contournables en éditant le storage. Aucune valeur de sécurité, seulement de l'ergonomie.
- **Le cache `getCurrentUser()`** lit `localStorage['quiz_auth_user']` (`auth.ts:35-50`) : un attaquant local peut forger un `id` arbitraire → toutes les données locales « appartenant » à cet id deviennent accessibles. Sans backend, l'impact reste local à l'appareil.
- **`register` accepte un `plan`** via `user_metadata` (`auth.ts:28,183`) → un utilisateur peut potentiellement s'auto-attribuer `plan: 'entreprise'` via `updateProfile({ plan })` si aucune policy serveur ne le bloque. **Élévation de privilège de facturation possible — Confiance moyenne — à vérifier.**

---

## 15. Sécurité et confidentialité

| Vecteur | État |
|---|---|
| Secrets committés | **Aucun** (`.env.local` ignoré) — bon |
| Clé anon Supabase dans le bundle | Normale (publique), mais **sécurité repose entièrement sur RLS** — voir [C-2] |
| XSS | **Présent** — [C-3] |
| CSP | **Absente** — [H-4] |
| Dépendances vulnérables | **16** — [H-3] |
| IDOR / énumération | game codes 6 chiffres énumérables — [C-2] |
| Fraude score/certificat | **Triviale** — [C-1] |
| Bourrage d'urne | **Possible** — [M-2] |
| Données perso dans les logs | `game_code`, états, IDs joueurs en `console.*` — [L-4] |
| Anonymat sondage | **Non garanti** — §11 |
| Upload de fichiers | Parsés client (`xlsx`/`mammoth`/`js-yaml`) sans validation MIME robuste, stockés base64 en localStorage — surface [H-3] |

---

## 16. Performance

- **Mesures (build réel)** : 4 chunks > 370 kB, 2 > 490 kB — [H-7].
- **Résultats de commande** : build 12,7 s, OK.
- **Estimations (non benchmarkées)** :
  - Live : polling host 800 ms (question) / 2 s (attente) + heartbeats joueurs 5 s. Débounce des writes bien fait. À **30 joueurs**, charge Supabase raisonnable ; au-delà de ~100 joueurs, le polling + réécriture du tableau `players` complet en lecture risque de coûter cher (chaque poll relit tout le state).
  - LMS : `getAllCourses()`/`getSavedQuizzes()` reparsent tout le localStorage à chaque appel — O(n) répété, acceptable à petite échelle, mais PDF base64 → saturation quota [C-4].
- **Risques théoriques** : re-parse localStorage massif, re-renders des composants monolithes (state de jeu à haute fréquence dans un composant de 1500+ lignes).

---

## 17. Tests manquants (prioritaires)

| Test | Scénario | Attendu | Priorité | Type |
|---|---|---|---|---|
| Score serveur anti-fraude | Joueur poste un score forgé | Rejeté / recalculé | P0 | sécurité |
| RLS `session_state` | Lecture/écriture par un tiers non autorisé | Refusée | P0 | sécurité |
| Sanitisation contenu leçon | `content` avec `<img onerror>` | Neutralisé | P0 | sécurité |
| `calculateScore` — partiels/true-false/short-answer | jeux de données limites | scores exacts | P1 | unitaire |
| Tentatives max & expiration | reset localStorage / nouvelle identité | bloqué serveur | P1 | intégration |
| Import `xlsx`/`yaml` malveillant | prototype pollution | isolé | P1 | sécurité |
| Concurrence live 30 joueurs | réponses simultanées | pas de perte/écrasement | P1 | charge |
| Anonymat sondage | vérifier non-réidentification | pas de lien nom↔réponse | P2 | intégration |

Actuel : **1 fichier de test** (`authMigration`, 8 cas). Couverture domaine ≈ nulle sur quiz/exam/notation.

---

## 18. Plan d'action

**Immédiat (P0)** : sanitiser `dangerouslySetInnerHTML` (DOMPurify) ; ajouter une CSP ; auditer/durcir les policies RLS Supabase ; **cesser de transmettre les réponses correctes au client** ; marquer clairement le mode examen comme « non certifiant » tant que la notation serveur n'existe pas.

**Court terme (P1)** : script `typecheck` + CI (lint+typecheck+test) bloquant ; corriger les 6 erreurs de types ; remplacer/isoler `xlsx` ; `manualChunks` + import dynamique des gros parsers ; empêcher l'auto-attribution de `plan`.

**Moyen terme (P2)** : introduire un **backend de persistance** (Postgres/Supabase + RLS par userId) pour quiz/cours/examens/résultats ; notation et vérification de tentatives côté serveur ; décomposer les composants monolithes ; unifier le gestionnaire de paquets.

**Long terme (P3)** : rôles/permissions (formateur/apprenant/admin), multi-tenant, certificats vérifiables, standards LMS (xAPI), collaboration.

---

## 19. Tableau de priorisation

| ID | Domaine | Problème | Gravité | Priorité | Impact | Effort | Fichier | Confiance |
|----|---------|----------|---------|----------|--------|--------|---------|-----------|
| C-1 | quiz/exam | Notation client + réponses exposées | Critique | P0 | Fraude totale | Élevé | PlayerView.tsx:447 | Élevée |
| C-2 | sécurité | RLS `session_state` probablement permissive | Critique | P0 | Fuite/altération | Moyen | supabase/RLS | Moyenne |
| C-3 | sécurité | XSS via innerHTML leçon | Critique | P0 | Exéc. JS arbitraire | Faible | CourseViewer.tsx:481,606 | Élevée |
| C-4 | données | Domaine 100% localStorage | Critique | P0 | Perte irréversible | Élevé | *Storage.ts | Élevée |
| H-1 | LMS | Examens non partagés élève↔formateur | Élevé | P1 | Module inopérant à distance | Élevé | ExamRoom.tsx | Élevée |
| H-2 | exam | Tentatives/temps contournables | Élevé | P1 | Fraude examen | Moyen | examStorage.ts:184 | Élevée |
| H-3 | sécurité | 16 vulns npm (xlsx sans fix) | Élevé | P1 | Prototype pollution | Moyen | package.json | Élevée |
| H-4 | sécurité | Aucune CSP | Élevé | P1 | Amplifie XSS | Faible | index.html | Élevée |
| H-5 | qualité | tsc échoue + 230 lint, pas de CI | Élevé | P2 | Régressions | Faible | tsconfig/CI | Élevée |
| H-6 | quiz | Corrections dans quiz_data live | Élevé | P1 | Triche live | Moyen | PlayerView.tsx:232 | Élevée |
| H-7 | perf | Chunks > 500 kB | Élevé | P2 | TTI mobile | Moyen | vite.config.ts | Élevée |
| M-1 | quiz | Score vitesse float non normalisé | Moyen | P2 | Incohérence | Faible | PlayerView.tsx:482 | Moyenne |
| M-2 | sondage | Bourrage d'urne | Moyen | P2 | Résultats faussés | Moyen | pollResults.ts | Élevée |
| M-3 | quiz | Double-note contournable | Moyen | P3 | Notes faussées | Faible | quizStorage.ts:202 | Élevée |
| M-4 | build | 2 lockfiles | Moyen | P2 | Non-reproductible | Faible | bun.lockb | Élevée |
| M-6 | archi | Composants monolithes | Moyen | P2 | Maintenabilité | Élevé | QuizSession.tsx | Élevée |

---

## 20. Score technique

| Axe | Note /10 | Justification |
|---|---|---|
| Architecture | 4 | Couches `lib/` propres, mais **absence de backend** = choix structurel bloquant pour le domaine visé |
| Qualité du code | 6 | TS strict, lisible ; mais 230 lint, `any` fréquents, monolithes, tsc en échec masqué |
| Sécurité | 2 | XSS, pas de CSP, notation cliente, RLS incertaine, 11 vulns high |
| Confidentialité | 3 | Anonymat sondage non garanti, données locales non protégées, logs bavards |
| Performance | 6 | Lazy-load + debounce live bien fait ; chunks lourds, re-parse localStorage |
| Fiabilité | 3 | Perte de données localStorage, examens non partagés, pas de transactions |
| Testabilité | 3 | 1 seul fichier de test ; monolithes difficiles à tester |
| Maintenabilité | 6 | Découpage domaine clair, nommage cohérent ; monolithes et styles inline pénalisent |
| Gestion des permissions | 2 | Aucune autz serveur, pas de rôles, contrôles contournables |
| Moteur de quiz | 5 | Riche fonctionnellement, mais notation/anti-triche absents |
| Moteur de sondage | 4 | Complet en types, faible en intégrité/anonymat |
| Moteur de carte mentale | N/A | Fonctionnalité absente |
| Fonctionnalités LMS | 3 | Cours OK localement ; examens/inscriptions/certificats non fiables |
| Extensibilité | 5 | Types de questions extensibles ; couplage localStorage limite |
| Préparation production | 3 | OK pour quiz ludique local ; inadapté LMS/examen certifiant |

---

## 21. Verdict de production

**PRÊT SOUS CONDITIONS** — uniquement pour un usage **quiz/sondage ludique en salle, non noté, faible enjeu**, où la triche et la perte de données locales sont acceptables.

**NON PRÊT** pour tout usage **LMS, examen, évaluation notée ou certifiante** : la notation cliente ([C-1]), l'absence d'autorisation serveur ([C-2]), le XSS ([C-3]) et la persistance 100 % localStorage ([C-4]) rendent les résultats **non fiables et non probants**, et exposent à la fraude et à la perte de données. Le module « examen à distance » est de plus **non fonctionnel** ([H-1]).

Justification : verdict fondé sur des faits vérifiés dans le code, hors validation du schéma RLS Supabase (hors périmètre) qui pourrait aggraver [C-2] mais ne peut pas résoudre [C-1]/[C-4].

---

## 22. Cinq actions prioritaires (impact/effort)

1. **Sanitiser tous les `dangerouslySetInnerHTML`** (DOMPurify) — [C-3]. *Impact critique, effort faible.*
2. **Ajouter une CSP** dans `vercel.json` — [H-4]. *Impact élevé, effort faible.*
3. **Auditer + durcir les policies RLS Supabase** sur `session_state` et les RPC — [C-2]. *Impact critique, effort moyen.*
4. **Ajouter script `typecheck` + CI bloquant** (lint/typecheck/test) et corriger les 6 erreurs de types — [H-5]. *Impact élevé, effort faible.*
5. **Ne plus transmettre les clés de correction au client** et recalculer le score serveur pour les modes notés — [C-1]/[H-6]. *Impact critique, effort moyen-élevé.*

---

## 23. Risques majeurs par domaine

**Quiz** : (1) triche au score triviale [C-1] ; (2) réponses correctes exposées en live [H-6] ; (3) score vitesse incohérent [M-1].
**Sondage** : (1) bourrage d'urne [M-2] ; (2) anonymat non garanti / réidentification ; (3) résultats non fiables sous concurrence.
**Carte mentale** : néant (absente).
**LMS** : (1) examens non partagés élève↔formateur [H-1] ; (2) certificats falsifiables sans réussite ; (3) perte de progression/résultats [C-4].
**Sécurité** : (1) XSS stocké [C-3] ; (2) autz serveur absente [C-2] ; (3) 11 vulns npm high [H-3].
**Performance** : (1) chunks > 500 kB [H-7] ; (2) re-parse localStorage O(n) répété ; (3) polling live coûteux à grande échelle.

---

## 24. Limites de l'audit

- **Schéma Supabase et policies RLS non vérifiés** (hors dépôt) — [C-2] et [§14 plan] restent des déductions.
- **`tsc` exécuté mais code retour masqué** par la commande shell (voir §2) — les 6 erreurs affichées sont réelles ; l'échec du process est déduit.
- **Composants volumineux lus partiellement** : `QuizSession` (1745 l.), `PlayerView` (1572 l.), `QuizBuilder` (1427 l.), `CourseBuilder`, `ExamAdmin`, `ExamBuilder` non lus ligne à ligne.
- **Pas d'exécution E2E / navigateur** ni de test avec un backend réel.
- **Accessibilité non auditée en profondeur** : très peu d'attributs ARIA détectés (`PlayerView`+`ExamRoom` : ~2), navigation clavier des options de réponse (divs `onClick` sans `role`/`tabIndex`) probablement non accessible au lecteur d'écran — **à confirmer par audit manuel WCAG dédié** (non réalisé ici).
- **Analyse de bundle détaillée** (tree-shaking, doublons) non effectuée au-delà de la sortie de build.

---

*Fin de l'audit. Aucun fichier autre que `AUDIT_CODE.md` n'a été modifié. Aucune migration, aucune donnée, aucun environnement distant n'a été touché.*
