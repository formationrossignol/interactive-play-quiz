# Spec — Auth commerciale (Supabase) + passe design premium

**Date** : 2026-07-11
**Objectif** : préparer la commercialisation. Deux phases : (1) authentification réelle avec MFA et changement de mot de passe via Supabase Auth, (2) unification des backgrounds et passe premium/fluidité.

## Contexte

- L'auth actuelle (`src/lib/auth.ts`) est 100 % localStorage : utilisateurs dans `quiz_users`, hash SHA-256 des mots de passe dans `quiz_passwords`. Aucune sécurité réelle, pas de multi-appareils, pas de reset par email. Rédhibitoire pour commercialiser.
- Supabase est déjà intégré (`src/lib/supabase.ts`, sessions live). Supabase Auth fournit comptes serveur, MFA TOTP, changement/reset de mot de passe.
- Les contenus (quiz, exams, cours, flashcards, sondages, banque de questions, dossiers) restent en localStorage, liés à `userId`. Leur migration vers la base est un projet ultérieur, hors scope ici.
- Le motif de fond (trame de points) est appliqué globalement par `.ap-app` (`src/arcade-pop.css:135`, wrapper dans `App.tsx:56`), mais certaines pages posent un fond opaque pleine page par-dessus (ex. `ProfilePage.tsx:132` : `backgroundColor: "var(--ap-paper)"`), ce qui masque le motif.

## Phase 1 — Migration Supabase Auth

### Architecture

- `src/lib/auth.ts` réécrit autour de `supabase.auth` :
  - `register` → `supabase.auth.signUp` (email + password, `username` dans `user_metadata`)
  - `login` → `signInWithPassword`
  - `logout` → `signOut`
  - changement de mot de passe → `updateUser({ password })`
  - mot de passe oublié → `resetPasswordForEmail`
  - préférences (`theme`, `language`, `plan`) → `user_metadata` via `updateUser`
- Nouveau `AuthProvider` (contexte React) : écoute `onAuthStateChange`, maintient un cache synchrone de l'utilisateur courant. `getCurrentUser()` conserve sa signature synchrone en lisant ce cache → les pages existantes ne changent presque pas.
- `AuthPage` : flux async, gestion d'erreurs i18n FR/EN, lien « Mot de passe oublié ». Page/route de définition du nouveau mot de passe après clic sur le lien email de reset.
- Emails : service email intégré Supabase (par défaut) pour confirmation et reset. SMTP custom hors scope.

### Changement de mot de passe

Réglages (`ProfilePage`) → nouvelle section « Sécurité » :
- Champs : mot de passe actuel, nouveau, confirmation.
- Re-vérification du mot de passe actuel via `signInWithPassword` avant `updateUser({ password })`.
- Validation : minimum 8 caractères, confirmation identique. Messages i18n.

### MFA TOTP

Même section « Sécurité » :
- Activation : `supabase.auth.mfa.enroll({ factorType: 'totp' })` → affichage QR code + secret en clair (fallback) → saisie code 6 chiffres → `mfa.challenge` + `mfa.verify` → badge « MFA activée ».
- Désactivation : re-vérification du mot de passe, puis `mfa.unenroll`.
- Login : après mot de passe, si l'utilisateur a un facteur TOTP vérifié (AAL1 → AAL2 requis), écran intermédiaire de saisie du code 6 chiffres.

### Migration des comptes localStorage existants

- Au premier login/signup Supabase réussi : si `quiz_users` contient un compte avec le même email, remapper son ancien `userId` vers l'id Supabase dans toutes les données locales : `saved_quizzes`, `questionBank`, cours, exams, flashcards, sondages, dossiers (audit des clés au moment de l'implémentation).
- Après remap : supprimer l'entrée de `quiz_users` et le hash correspondant de `quiz_passwords`. Une fois `quiz_users` vide, supprimer les deux clés.
- Idempotent : re-login ne doit rien casser si déjà migré.

### Configuration Supabase requise (dashboard)

- Auth email/password activée, confirmation email activée.
- MFA TOTP activée.
- URL de redirection pour le reset de mot de passe.

## Phase 2 — Backgrounds unifiés + premium/fluidité

### Backgrounds

- Audit de toutes les pages sous `src/pages/` : suppression des fonds opaques pleine page (`backgroundColor`/`background: var(--ap-paper)` sur le wrapper racine) qui masquent la trame de points de `.ap-app`.
- Exceptions volontaires : écrans de session live (quiz/poll en cours, thème sombre dédié) et tout écran avec fond thématique délibéré.
- Vérification du rendu du motif en light et dark (le motif utilise `--ap-line-2`, défini dans les deux thèmes).

### Fluidité

- Transitions de route : fade + léger translate (150–200 ms), CSS pur, respect de `prefers-reduced-motion`.
- Micro-interactions unifiées sur les écrans principaux (accueil, dashboards Mes quiz/exams/cours, réglages, builders) : press scale, hover cartes, focus rings — mêmes timings et courbes partout (tokens Arcade Pop existants).
- Skeletons : états de chargement pour les routes lazy et les listes (remplacement des flashs blancs), stylés selon le design system.

## Ordre et découpage

1. Phase 1 (bloquant commercialisation).
2. Phase 2.

## Hors scope

- Migration du contenu (quiz, exams, etc.) vers la base Supabase.
- SMTP custom / templates emails de marque.
- Facturation et plans payants réels.
- Suppression de compte (RGPD) — à traiter dans le projet « migration contenu ».

## Critères de succès

- Inscription, login, logout, reset et changement de mot de passe fonctionnels via Supabase.
- MFA TOTP activable/désactivable dans Réglages, exigée au login quand active.
- Comptes localStorage existants rattachés automatiquement (données visibles après migration).
- Trame de points visible sur toutes les pages standard, light et dark, sans régression sur les écrans live.
- Navigation avec transitions douces, aucun flash blanc au chargement des routes.
