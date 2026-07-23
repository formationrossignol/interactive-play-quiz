---
target: landing page (src/pages/Index.tsx)
total_score: 29
p0_count: 1
p1_count: 3
timestamp: 2026-07-18T14-20-49Z
slug: src-pages-index-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `LandingTestimonials` returns `null` while loading, no skeleton — pop-in on resolve |
| 2 | Match System / Real World | 4 | PIN/QR/code language matches how hosts and players actually run sessions |
| 3 | User Control and Freedom | 3 | Cookie banner gives Refuse/Personalize/Accept, but on mobile blocks the secondary hero CTA before the user can act |
| 4 | Consistency and Standards | 3 | Tokens applied faithfully, but the identical eyebrow-badge intro repeated across 7 sections reads templated |
| 5 | Error Prevention | 3 | Join-code input force-uppercases and disables when empty, but no length/format check before routing to `/join/:code` |
| 6 | Recognition Rather Than Recall | 4 | Content-type color system always paired with a text label, never color-only |
| 7 | Flexibility and Efficiency | 2 | Enter-to-submit on the code field is the only efficiency nod; single path for all visitor types |
| 8 | Aesthetic and Minimalist Design | 2 | Strong palette/type system, undercut by two shipped "coming soon" placeholders on the money page |
| 9 | Error Recovery | 2 | No inline feedback for a malformed/short game code — silently routes downstream instead of catching it here |
| 10 | Help and Documentation | 3 | FAQ + footer "Centre d'aide" / "Guides" present and reasonably discoverable |
| **Total** | | **29/40** | **Good — solid foundation, address weak areas** |

#### Anti-Patterns Verdict

**Start here. Does this look AI-generated?** No — not in the generic-slop sense. No gradient text, no glassmorphism, no side-stripe borders, no timid palette, no editorial-magazine drift. The Arcade Cabinet system (cream paper, indigo, pressed-shadow buttons, functional 4-color content typing, Fredoka/Nunito) is genuinely and consistently executed. Someone would ask "how was this made?", not "which AI made this?"

But it fails a narrower test: **templated scaffolding**. Two things land squarely on documented ban lists:

1. **Repeated uppercase-badge → H2 → centered-subtext intro on 7 consecutive sections** ("Comment ça marche", "Cas d'usage", "Démo", "Avis", "Confiance", "Questions fréquentes", plus the strip label). `brand.md` names this exact pattern: *"Repeated tiny uppercase tracked labels above every section heading… is AI scaffolding unless it's a deliberate, named brand system."* Neither `DESIGN.md` nor `.impeccable/design.json` documents this eyebrow-chip as a system component.
2. **"Comment ça marche" uses numbered 1/2/3 circle badges** — matches the shared ban on numbered section markers as default scaffolding almost verbatim.

Plus a non-ban-list failure with the same signature: **two literal placeholder sections shipped to production** (`DemoShowcase.tsx`'s "GIF de démo à venir" dashed box, `StatsBand.tsx`'s two "Bientôt disponible" dashes). Not a slop pattern, but the same "unfinished template" tell, at exactly the point a landing page most needs to look finished.

**Deterministic scan** (`detect.mjs --json` on `src/pages/Index.tsx` + `src/components/landing`): exit 2, 4 findings.
- `Index.tsx:356`, `:481`, `:518` — rule `design-system-font-size`: inline `fontSize` values (`13.5px`, `28px`, `22px`) that don't match `DESIGN.md`'s documented type ramp (Display 56 / Headline 38 / Title 20 / Body 15 / Label 12 / Button 15.5). True positives — cross-checked against the ramp directly.
- `DemoShowcase.tsx:2` — rule `broken-image`. **False positive**: the flagged `<img>` tag sits inside a JSX comment (`{/* <img src="/demo/product-demo.gif" ... /> */}`) documenting the intentional placeholder; it never renders. The detector is scanning raw text for `<img>` tokens without excluding commented-out JSX.

Worth noting where the two assessments converge without coordinating: the detector independently flagged `DemoShowcase.tsx` (for a syntactic reason, on inert code) at the exact file the manual review flagged for a real UX problem (the visible placeholder box) — same hotspot, different diagnosis.

**Visual overlays**: not available this run. The claude-in-chrome browser extension was not connected for Assessment B ("Browser extension is not connected... ensure the extension is installed and running, logged into the same claude.ai account"), so the injected-detector-overlay step (`live-server.mjs` + `detect.js` console findings) never ran, and the background live-server process was never started (nothing to clean up). Assessment A worked around this independently using a Playwright fallback purely to take reference screenshots (desktop 1440×900 and mobile 390×844) for its manual review — no `[Human]`-tab overlay exists from this run. To get the live in-browser overlay next time, connect the claude-in-chrome extension first.

#### Overall Impression

The visual system is the strongest asset here and it's executed with real discipline — the `HeroMiniQuiz` in particular is a genuinely distinctive "show, don't tell" move that few landing pages bother building. The page's core problem isn't taste, it's finish: two "coming soon" placeholders sit back-to-back in the middle of the scroll, at exactly the two moments a skeptical visitor is looking for proof, and a repeated section-intro template makes 7 sections blur into each other. The single biggest opportunity is closing those two proof gaps — everything else here is a good page.

#### What's Working

1. **`HeroMiniQuiz`** — a visitor answers a real quiz question inline, with the answer-tile shape+color language (triangle/red, square/blue, circle/amber, diamond/green) executed exactly per `DESIGN.md`'s Answer Tile spec. The strongest single element on the page.
2. **Disciplined, faithful execution of the Arcade Cabinet system** — pressed-shadow buttons that visibly compress on click, tabular-numeral PIN tile, functional content-type coloring carried through consistently. Nothing reads as swapped-in shadcn defaults.
3. **Honest data practices** — `StatsBand`, `LandingTestimonials`, and `TrustSection` all explicitly refuse to fabricate numbers or reviews in code comments, and `LandingTestimonials` has a real empty state rather than a fake placeholder quote. Good engineering discipline, even though its visible result (dashed placeholder tiles) currently hurts the page.

#### Priority Issues

**[P0] `DemoShowcase.tsx` ships a literal "coming soon" placeholder as the product's proof section.**
- **Why it matters**: the section titled "Voir une session en direct" renders a dashed beige box saying "GIF de démo à venir" at the exact scroll position where a visitor evaluating the core promise (real-time sync, arcade energy) looks for evidence — and finds an empty box instead. For a page whose whole job is conversion, this directly undercuts the one thing it's supposed to do.
- **Fix**: cut the section until a real asset exists, or replace it with something already built and real — e.g. reuse the `HeroMiniQuiz` interaction pattern for a second live-demo moment, or embed an actual screen recording.
- **Suggested command**: `/impeccable harden` (production-readiness: no shipped placeholder states) or `/impeccable distill` (remove the section rather than patch it).

**[P1] `StatsBand.tsx` displays 2 of 3 "live" stat tiles as dashes labeled "Bientôt disponible."**
- **Why it matters**: padding a 3-column grid to a shape rather than to real content reads as broken, not restrained — and it sits directly above the P0 demo placeholder, compounding into a two-section "empty patch" mid-page, right where `UseCaseTabs` has just made the pitch.
- **Fix**: show the one real stat as a standalone live badge (the pattern already used as a floating pill in the hero) instead of forcing a 3-up grid that's 2/3 empty.
- **Suggested command**: `/impeccable layout`.

**[P1] Repeated identical section-intro scaffolding across 7 sections.**
- **Why it matters**: the same badge → H2 → centered muted subtext pattern repeats for Comment ça marche / Cas d'usage / Démo / Avis / Confiance / Questions fréquentes / the strip label — `brand.md` flags this exact structure as AI scaffolding unless documented as a deliberate system, and it isn't in `DESIGN.md`.
- **Fix**: vary treatment per section — some sections drop the kicker, some integrate the color-coded content-type language already established instead of a neutral indigo pill every time (brand.md explicitly permits "art direction per section").
- **Suggested command**: `/impeccable typeset` or `/impeccable layout`.

**[P1] Mobile cookie banner obscures the secondary hero CTA on first load.**
- **Why it matters**: at 390×844, the 3-button consent block covers roughly the bottom 40% of the first viewport, hiding "Rejoindre une partie" — a distracted mobile visitor's first screen is a legal modal, not the product.
- **Fix**: collapse to a slim single-line bottom bar with a "Personnaliser" link on mobile instead of the full 3-button stack, or defer the banner until first scroll.
- **Suggested command**: `/impeccable adapt`.

**[P2] "Comment ça marche" uses numbered 1/2/3 circle badges**, matching the shared ban on numbered section markers as default scaffolding almost verbatim.
- **Why it matters**: cheap tell that the section was built from a template shape rather than a specific idea.
- **Fix**: swap for action-specific icons (compose / QR / play), reusing the icon language already established in the content-type tiles directly above.
- **Suggested command**: `/impeccable delight`.

**[P2] Three inline font sizes deviate from the documented type ramp** — `Index.tsx:356` (13.5px), `:481` (28px), `:518` (22px) — none of Display 56 / Headline 38 / Title 20 / Body 15 / Label 12 match. Cross-checked against `DESIGN.md` §3; true positives from the deterministic scan.
- **Fix**: snap each to the nearest documented step, or add the value to the ramp in `DESIGN.md` if it's a deliberate new step.
- **Suggested command**: `/impeccable typeset`.

#### Persona Red Flags

**Riley (stress-tester)**: scrolls past the use-case pitch looking for proof, hits `StatsBand`'s two dashes and then `DemoShowcase`'s placeholder back to back — the exact two moments a skeptic checks credibility both come up empty. The persona most likely to bounce, and the page currently hands them the strongest reason to.

**Casey (distracted mobile user)**: the full mobile page is ~10,250px tall (≈12× the viewport) with the cookie banner eating the first screen and two near-identical "Créer gratuitement" CTAs (join banner + final CTA) separated by only a thin gap — a skimming visitor gets a long, repetitive scroll and two nearly redundant closing asks instead of one well-placed peak-end moment.

**Jordan (confused first-timer)**: actually served well by the hero — the interactive mini-quiz teaches the product by doing, which is rare and effective. The narrower risk: on mobile the eyebrow chip wraps to two lines above the headline, adding a beat of clutter before the actual value prop.

#### Minor Observations

- `LandingTestimonials` returns `null` during load with no skeleton, causing a layout pop-in once reviews resolve.
- The "Quatre formats, un langage" type-badge tile in the 3-tile proof strip duplicates the 4 content-type tiles one screen below almost one-for-one (same 4 types, same colors, same routes) — could be consolidated.
- Final CTA repeats the hero's primary button verbatim ("Créer gratuitement," same route) with no new information or reassurance added at the point the visitor has already read the whole page — a missed peak-end opportunity.
- No inline validation on the 6-digit join-code field; a short/malformed code still navigates to `/join/:code` and presumably fails downstream rather than catching the problem on this page.

#### Questions to Consider

1. If "the live moment is sacred" and proof-of-fun is the differentiator, why does the section literally titled "Voir une session en direct" ship as an empty dashed box instead of reusing the `HeroMiniQuiz` interaction pattern already built and proven three screens up?
2. The eyebrow-badge-into-heading pattern repeats 7 times — deliberate rhythm, or did each section get built independently without checking what the section above it just did?
3. Two "Créer gratuitement" CTAs sit within one scroll of each other with no new information between them — is the goal to give a hesitant visitor two chances, or did the page grow by accretion without anyone reviewing the closing sequence as a whole?
