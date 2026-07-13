# Sondages asynchrones (Chantier 5) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. Lire d'abord la mémoire projet `content-org-async-polls-program` et le design `docs/superpowers/plans/2026-07-13-content-org-and-async-polls-design.md`.

**Goal:** Permettre de lancer un sondage en **mode asynchrone** : un lien/QR public permanent, réponses de participants **anonymes à tout moment** (sans hôte live), résultats **agrégés en continu**.

**Architecture:** Réutilise la table `content` (type `'poll'`, colonne `is_open`) et la table `poll_responses` **déjà créées**. Un toggle « Mode asynchrone » ouvre le sondage (`is_open=true`) et expose un lien public `/p/:id`. La page publique insère dans `poll_responses` (RLS insert anonyme si `is_open`). Les résultats lisent l'agrégat.

**Tech Stack:** React + Vite + TS, Supabase (client anon existant `@/lib/supabase`), `@/components/QRCodeGenerator`, Arcade Pop tokens. Base = projet **lwwf** (`lwwfgdebmggxjuvlazwf`), cf mémoire.

---

## État déjà en place (NE PAS refaire)
- Table `content` : polls = `type='poll'`, blob dans `data` (un `SavedQuiz` avec `questions[]`), colonne `is_open boolean`.
- Table `poll_responses(id, content_id, answers jsonb, created_at)` + RLS :
  - `poll_responses_insert_open` : insert autorisé **anonyme** si le content lié est `type='poll' AND is_open=true`.
  - `poll_responses_owner_read` : SELECT réservé au propriétaire du sondage.
- `contentRepo.setOpen(id, bool)` existe déjà.
- Flux anonymes existants à copier : `src/pages/JoinQuiz.tsx`, `src/pages/JoinExam.tsx`, `src/components/PollSession.tsx` (live), `src/pages/PollResults.tsx`.
- `src/components/QRCodeGenerator.tsx` existe.
- ⚠️ Env : previews Vercel n'ont les env que sur le scope de la branche ; tsc/vitest hang localement (vérif via node ou build prod). Vérif runtime = login sur prod/preview.

## Décisions à valider en début de session
- **D1 — Résultats visibles aux répondants ?** La RLS `poll_responses_owner_read` bloque la lecture publique. Options : (a) résultats privés à l'hôte seulement (simple, RLS actuelle OK) ; (b) exposer un agrégat public via une **RPC `SECURITY DEFINER`** `poll_public_results(content_id)` (retourne des comptes, pas les lignes brutes). **Recommandé : (a) pour v1**, (b) en option.
- **D2 — Route publique** : `/p/:id` (courte) vs `/poll-async/:id`. Recommandé `/p/:id`.
- **D3 — Anti-abus** : hors scope v1 (pas de captcha/rate-limit). Noter le risque.

---

### Task 1 — Repo réponses async

**Files:** Create `src/lib/content/pollResponsesRepo.ts` ; Test `src/lib/content/__tests__/pollResponsesRepo.test.ts` (vitest, mocké — tourne en CI).

Fonctions :
- `submitPollResponse(contentId: string, answers: Record<string, unknown>): Promise<void>` — `supabase.from('poll_responses').insert({ content_id, answers })`, throw sur error. (Marche pour l'anon si `is_open`.)
- `getPollResponses(contentId: string): Promise<{ id: string; answers: Record<string, unknown>; created_at: string }[]>` — SELECT (hôte seulement via RLS), ordonné created_at.
- `aggregatePoll(questions, responses)` **PURE** (node-testable) : pour chaque question, compte les réponses par option (choix) et liste les textes libres. Retourne une structure `{ [questionId]: { counts: Record<optionIndex, number>, texts: string[], total: number } }`. S'inspirer de `src/lib/pollResults.ts` (agrégation live existante) pour le format.

**Verify:** node throwaway sur `aggregatePoll`. Commit `feat: poll async responses repo + aggregation`.

---

### Task 2 — Toggle « Mode asynchrone » + lien/QR (MyPolls / builder)

**Files:** Modify `src/pages/MyPolls.tsx` (menu ⋯ ou bouton par carte) ; Create `src/components/AsyncPollShareModal.tsx`.

- Ajouter une action **« Mode asynchrone »** sur chaque sondage (card `ItemMenu` déjà présent, cf cutover). Elle :
  - appelle `contentRepo.setOpen(row.id, true)`,
  - ouvre `AsyncPollShareModal` avec l'URL publique `${origin}/p/${row.id}` + `<QRCodeGenerator value=... />` + bouton copier + toggle « Ouvert/Fermé » (setOpen true/false) + lien « Voir résultats ».
- État `is_open` visible sur la carte (badge « Async · Ouvert/Fermé »).

**Verify (runtime):** login prod → ouvrir un sondage en async → modal affiche lien+QR → toggle ferme/ouvre → `is_open` persiste (REST/dashboard). Commit `feat: async poll share modal + open toggle`.

---

### Task 3 — Page publique de réponse `/p/:id`

**Files:** Create `src/pages/AsyncPollRespond.tsx` ; Modify `src/App.tsx` (route `/p/:id`, publique, hors auth — mettre à côté de JoinQuiz/JoinExam ; marquer noindex si besoin).

- Charge le content par id : `contentRepo.getContent(id)`. ⚠️ RLS : `content_public_read` autorise SELECT si `is_public OR is_open`. Donc un sondage `is_open=true` est lisible par l'anon → OK. Si non ouvert → message « Sondage fermé ».
- Rendu des questions du blob `data` (réutiliser les composants de rendu de `PollSession` côté participant : choix / échelle / texte libre / word-cloud — factoriser si possible).
- Sur submit → `submitPollResponse(id, answers)` → écran « Merci ! » (option : afficher l'agrégat public si D1=(b)).
- Sans compte, sans session live. Pas de `sessionState`/Supabase Realtime.

**Verify (runtime):** ouvrir `/p/:id` en navigation privée (déconnecté) → répondre → ligne dans `poll_responses` (dashboard). Sondage fermé → bloqué. Commit `feat: public async poll response page`.

---

### Task 4 — Résultats async (agrégation continue)

**Files:** Modify `src/pages/PollResults.tsx` (ou Create `src/pages/AsyncPollResults.tsx` si le live diffère trop).

- Pour un sondage async : `getPollResponses(id)` + `aggregatePoll(data.questions, responses)` → barres par option + feed textes libres (réutiliser le visuel de `PollSession`/`AnswerDistribution`).
- **Continu** : refetch périodique (ex. `setInterval` 5–10 s) OU Supabase Realtime sur `poll_responses` filtré `content_id`. Recommandé : polling simple v1.
- Bouton « Fermer le sondage » (`setOpen(false)`).

**Verify (runtime):** répondre depuis un 2e appareil/onglet → résultats se mettent à jour (refetch). Commit `feat: async poll results aggregation view`.

---

### Task 5 (option) — Résultats publics via RPC (si D1=(b))

**Files:** Create migration `supabase/migrations/<ts>_poll_public_results.sql`.

```sql
create or replace function public.poll_public_results(p_content_id uuid)
returns table(answers jsonb) language sql security definer set search_path = public as $$
  select r.answers from public.poll_responses r
  join public.content c on c.id = r.content_id
  where r.content_id = p_content_id and c.type = 'poll' and c.is_open = true;
$$;
grant execute on function public.poll_public_results(uuid) to anon, authenticated;
```
Appeler via `supabase.rpc('poll_public_results', { p_content_id })` dans la page publique pour montrer l'agrégat aux répondants sans exposer la table. **Appliquer la migration sur lwwf (dashboard)**.

---

## Risques
- **R1 RLS lecture** : par défaut seuls l'hôte voit les réponses (voulu). Résultats publics = Task 5 (RPC) sinon rien côté répondant.
- **R2 Anti-abus** : insert anonyme non limité (spam possible). v1 = accepté ; suivi : rate-limit edge function / captcha.
- **R3 `content_public_read`** rend le blob du sondage lisible par l'anon quand `is_open` — OK (nécessaire pour afficher les questions), mais ne pas y mettre de données sensibles (corrigé/réponses attendues) : pour un **sondage** il n'y a pas de bonne réponse, donc OK. (Pour un quiz async ce serait un problème — hors scope.)
- **R4** Migration Task 5 = DDL sur prod lwwf → application manuelle dashboard (pas de service_role/CLI dispo côté agent).

## Handoff
Après validation, généralisable : un « quiz async » (auto-évalué) est HORS scope (fuiterait le corrigé via `content_public_read`) — nécessiterait un scoring serveur (cf worktree/PR live-quiz-server-scoring).
