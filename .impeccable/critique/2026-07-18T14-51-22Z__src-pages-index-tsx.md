---
target: landing page (src/pages/Index.tsx)
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-07-18T14-51-22Z
slug: src-pages-index-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live-visitor pill, countdown ring, score pill all update in real time; join button gives no transient loading state before navigation |
| 2 | Match System / Real World | 4 | Host-voice copy matches PRODUCT.md's "host hyping up a room" mandate precisely |
| 3 | User Control and Freedom | 3 | Docked for the mobile cookie banner's asymmetric decline path (see P1) |
| 4 | Consistency and Standards | 3 | Mostly consistent `.ap-*` system, but the hero underline squiggle breaks the system's own Functional Color Rule (see P2) |
| 5 | Error Prevention | 3 | Join-code input auto-uppercases and caps at 6 chars, but `joinQuiz()` only checks `.trim()`, not length — a 1-character code can be submitted |
| 6 | Recognition Rather Than Recall | 4 | Every CTA is descriptive; icons always paired with text labels |
| 7 | Flexibility and Efficiency | 2 | Enter-to-submit on the join field is a nice touch, but little else for a returning host — thin, if appropriate for the register |
| 8 | Aesthetic and Minimalist Design | 3 | Generally clean, but the "En ce moment" stats section reads as unfinished next to richer neighbors |
| 9 | Error Recovery | 2 | No visible error affordance on this page for a malformed code before redirect to `/join/:code` |
| 10 | Help and Documentation | 3 | FAQ answers real pre-sale objections, grounded, no fabricated figures |
| **Total** | | **30/40** | **Good — up from 29/40 last run** |

#### Anti-Patterns Verdict

**Does this look AI-generated? PASS — not AI slop.** No hits on the absolute-ban list this run: no side-stripe borders, no gradient text, no glassmorphism, no padded hero-metric template (the stats section deliberately shows only the one real number rather than inventing more), no identical decorative card grids, no numbered 01/02/03 markers (the 3-step section now uses icon tiles), no eyebrow-on-every-section (varied per the prior typeset pass). Brand-specific checks also pass: no zero-imagery gap (the interactive quiz demo substitutes for photography), mono reserved correctly for codes/scores, no all-caps body, palette genuinely committed, not editorial-magazine-by-reflex.

**Deterministic scan**: exit 0, **zero findings** across `Index.tsx` + `src/components/landing` + `CookieConsent.tsx` — clean, down from 4 findings (3 true positives + 1 false positive) last run.

**Visual overlays**: still unavailable — claude-in-chrome extension remains not connected this session too. Assessment A used a local Playwright fallback for reference screenshots at desktop and mobile widths with the cookie banner dismissed; Assessment B's browser step was correctly skipped rather than silently faked once the same connection error recurred. No `[Human]`-tab overlay exists from this run either.

#### Overall Impression

The visual system now reads as a distinctive, functioning brand rather than a template — the `HeroMiniQuiz`'s live confetti/shake/timer/score is a rare hero element that *proves* the product instead of decorating around it, and the prior fixes (no more shipped placeholders, varied section intros, real icons) all held up under a fresh, independent review. The new top issue is a genuine accessibility regression: illegible text on the join banner (pre-existing, not touched this session) at roughly 1.4:1 contrast, directly against PRODUCT.md's own WCAG 2.1 AA commitment.

#### What's Working

1. **`HeroMiniQuiz` is a real interactive demo, not a screenshot** — live timer, spring-eased answer tiles, confetti on correct, shake on wrong, animated score.
2. **Honest data discipline held up** — `StatsBand`, `LandingTestimonials`, `TrustSection` still explicitly refuse to pad with invented numbers/logos/badges.
3. **Functional color system executed correctly almost everywhere** — content-type tiles, badges, and answer-tile shapes consistently map color to content type per `DESIGN.md`.

#### Priority Issues

**[P1] Illegible exam-code link on the join banner — real contrast bug, pre-existing.**
- **Why it matters**: `Index.tsx:543` sets `color: var(--ap-muted)` (`#6d6288`, calibrated for ~4.6:1 on the cream paper background) on the solid indigo `#4338ca` join-banner background. Computed contrast is roughly 1.4:1 — confirmed in both desktop and mobile screenshots, where "Vous avez un code d'examen ?" is nearly unreadable. Directly contradicts PRODUCT.md's "WCAG 2.1 AA baseline... across both host and player views" commitment.
- **Fix**: use `rgba(255,255,255,.78)` (matching the paragraph directly above it in the same banner) instead of the paper-calibrated muted token.
- **Suggested command**: `/impeccable audit landing` (contrast) or a direct one-line fix.

**[P1] Mobile cookie banner removes the one-tap "reject" option — a side effect of last session's `adapt` fix.**
- **Why it matters**: `arcade-pop.css:840` (`@media (max-width: 640px) { .ap-cookie-banner__decline { display: none; } }`) hides "Tout refuser" on mobile entirely, leaving only "Personnaliser" (opens a modal, 2 more taps to reject) or "Tout accepter" (1 tap). The prior fix correctly slimmed the banner, but over-corrected: it made accepting easier than declining, cutting against "choose the most privacy-preserving option" and GDPR/CNIL guidance that reject-all shouldn't be harder than accept-all.
- **Fix**: keep a one-tap reject affordance on mobile — e.g. restyle "Tout refuser" the same way "Personnaliser" was restyled (plain text link) instead of hiding it outright.
- **Suggested command**: direct fix, small scope — a second pass on the same component from last session's `adapt`.

**[P2] Hero squiggle underline breaks the system's own Functional Color Rule.**
- **Why it matters**: the underline under "qui dorment" (`Index.tsx:210`) uses `stroke="var(--ap-flash)"` (Flashcard Amber) as a purely decorative highlight under indigo text, unrelated to flashcard content. `DESIGN.md`'s own Named Rule: "don't reach for 'poll blue' because it looks nice on a marketing section" — this is that exact mistake, with amber. Pre-existing, not touched this session.
- **Fix**: use `--ap-brand` or a neutral accent for the underline instead of a content-type color.
- **Suggested command**: `/impeccable typeset landing` or `/impeccable colorize landing`.

**[P2] Partners marquee looks broken with only one real partner.**
- **Why it matters**: `PartnersStrip.tsx` duplicates the logo set to build a seamless infinite marquee. With one configured partner, the effect is the same logo endlessly sliding past itself; under `prefers-reduced-motion` it renders as the identical logo twice, statically, with an awkward crop. A social-proof section built for scale, running with n=1, reads as a glitch rather than "we have real partners." Pre-existing, not touched this session.
- **Fix**: skip the marquee/duplication under a low partner-count threshold and render a simple static row instead.
- **Suggested command**: `/impeccable harden landing` (matches this session's placeholder-content pattern) or a direct fix.

**[P3] "En ce moment" stats section now reads as an unfinished placeholder — a side effect of last session's `layout` fix.**
- **Why it matters**: the single live-visitor pill (correctly refusing to pad with invented stats, per its own comment) is visually thin — one small pill centered in a full-width section, sandwiched between a rich `UseCaseTabs` card above and a 3-card testimonial grid below. The restraint is right in principle; the execution currently under-communicates it, reading as missing content rather than deliberate minimalism.
- **Fix**: give the pill more visual weight (larger badge, or pair it with a short supporting line) so it reads as "deliberately simple" rather than "unfinished" against its denser neighbors.
- **Suggested command**: `/impeccable layout landing` (second pass) or `/impeccable delight landing`.

#### Persona Red Flags

- **Jordan (confused first-timer)**: on mobile, rejecting non-essential cookies now requires finding "Personnaliser" and navigating a modal — most first-timers won't locate the actual "no" path and will default into "Tout accepter" by omission (a direct consequence of the P1 mobile-banner finding above). Separately, Jordan lands with 7 competing header actions (5 nav links + language toggle + login) before even reading the hero.
- **Riley (stress-tester)**: `joinQuiz()` only checks `gameCode.trim()`, not length — a 1-character code fires `navigate('/join/A')` with zero inline validation on the landing page itself, pushing the error downstream instead of preventing it here. (Carried over from last run, still unaddressed — was not in the original 6-item punch list.)
- **Casey (distracted mobile user)**: mobile is one long uninterrupted single-column stack — 4 content-type cards, 3 step cards, persona tabs, the thin stats pill, 3 testimonials, 3 trust cards, a 5-item FAQ — before the join banner reappears as a conversion moment, where the exam-code alternative is the illegible P1 text.

#### Minor Observations

- Three different section-kicker treatments coexist (`ap-eyebrow`, `ap-strip-label`, `ap-badge ap-badge--brand`) — each individually permitted per DESIGN.md's "vary section-intro treatment" guidance, but "Avis" and "Confiance" still use the identical badge back-to-back, a smaller-scale echo of the pattern fixed elsewhere last session.
- `Index.tsx` mixes large inline `style={{...}}` objects with Tailwind utility classes throughout the same file — not a visible defect today, but a consistency smell worth watching as the page keeps getting edited.
- The join-code field's auto-uppercase + `maxLength={6}` are good inline error-prevention touches; the gap is only that 6 characters isn't enforced as a *minimum* before submit.

#### Questions to Consider

1. The mini quiz demo is the single most persuasive thing on this page — why is it visually equal-weighted beside generic hero copy instead of being the dominant anchor?
2. With one real partner logo, is the infinite-scroll marquee earning its keep, or is constant motion drawing more attention to "we don't have many customers yet" than a plain static logo would?
3. PRODUCT.md says "the live moment is sacred" — so why does the page's closing beat trail off into FAQ-and-compliance copy instead of calling back to the arcade energy established in the hero?
