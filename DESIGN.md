---
name: Brivia
description: All-in-one live quiz, poll, flashcard, presentation, course and exam platform
colors:
  brivia-indigo: "#4338ca"
  brivia-indigo-deep: "#312e81"
  brivia-indigo-soft: "#ecebfe"
  logo-diamond: "#4f46e5"
  ink: "#241b3a"
  muted: "#6d6288"
  paper: "#fff8ee"
  paper-2: "#f3ecdd"
  card: "#ffffff"
  line: "#efe6d3"
  line-2: "#d8ccb5"
  quiz-red: "#ff5a4d"
  quiz-red-deep: "#c93325"
  quiz-red-soft: "#fff3f0"
  presentation-green: "#15c08a"
  presentation-green-deep: "#0b8a63"
  presentation-green-soft: "#e8faf3"
  poll-blue: "#2f7bff"
  poll-blue-deep: "#1d55c0"
  poll-blue-soft: "#eef4ff"
  flashcard-amber: "#ffb020"
  flashcard-amber-deep: "#a86e00"
  flashcard-amber-soft: "#fff7e6"
typography:
  display:
    fontFamily: "Fredoka Variable, Fredoka, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-1.5px"
  headline:
    fontFamily: "Fredoka Variable, Fredoka, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-1px"
  subhead:
    fontFamily: "Fredoka Variable, Fredoka, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Fredoka Variable, Fredoka, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.5px"
  wordmark:
    fontFamily: "Sora Variable, Sora, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, ui-monospace, monospace"
  code-field-compact:
    fontFamily: "Fredoka Variable, Fredoka, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "8%"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "30px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brivia-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "13px 24px"
  button-primary-hover:
    backgroundColor: "{colors.brivia-indigo}"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "13px 24px"
  card-default:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 15px"
  badge-quiz:
    backgroundColor: "{colors.quiz-red-soft}"
    textColor: "{colors.quiz-red-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
---

# Design System: Brivia

## 1. Overview

**Creative North Star: "The Arcade Cabinet"**

Brivia's default skin, Arcade Pop, is a physical arcade machine translated to screen: a warm cream "paper" backdrop with a faint dotted-grid texture, an indigo brand color that lights up every CTA, and buttons that behave like real 3D switches — a solid color offset shadow that visibly compresses when pressed. Nothing here is flat-SaaS-cream trying to look neutral; the cream is a deliberate game-board surface, and the indigo, red, green, blue and amber accents are a functional color language, not decoration — each content type (quiz, presentation, poll, flashcard) owns its hue everywhere in the product, from tiny badges to full-bleed live-session answer tiles.

The system explicitly rejects the corporate SaaS-cream trap: no flat gray-on-beige cards, no generic icon-grid dashboards, no soulless enterprise-tool blandness. Energy is the differentiator. At the same time it is not a toy — typography is confident and legible, spacing is generous, and the same token system scales down to a dense in-session leaderboard or up to a hero headline without losing coherence.

Brivia also ships two alternate skins on the same token grammar — **Thales** (angular, no radius, cyan-on-navy, institutional) and **Innov Campus** (black/white/turquoise, light rounding) — proving the system out as genuinely themable rather than hardcoded. This document describes the default Arcade Pop skin; treat the tokens as the ones any new UI should reach for first.

A fourth skin, **Premium** (`theme-premium.css`, `.landing-premium` class), is scoped to the marketing landing page only rather than being a selectable site-wide theme like the other three — "/" opts in, the rest of the app stays Arcade Pop. Concept: restrained premium dev-tool SaaS register (Linear/Vercel/Ramp), explicitly moving away from Arcade Pop's playful arcade-cabinet feel for this one surface — Graphite `#0a0a0f` near-black surface (not a saturated color dominating the page), Ink White text, ONE precise indigo accent (`#6d5ef5`) used sparingly for CTAs/focus/links rather than color everywhere, content-type colors reduced to small desaturated status-tag dots. Typeface: Geist Sans + Geist Mono, a single confident family carrying both display and body via weight contrast. The pressed-shadow button mechanic is explicitly overridden to a flat/glow interaction — see `theme-premium.css`'s own header comment for the full rationale, token list, and contrast math. A first attempt (`theme-stage.css`, deleted) kept Arcade Pop's layout/copy/button-mechanic and only swapped colors; this replacement changes the interaction language itself, not just the palette.

**Key Characteristics:**
- Warm cream paper background with a dotted-grid "game board" texture
- Indigo brand color (`#4338ca`) carrying every primary CTA and focus ring
- Buttons and cards use a solid pressed-shadow offset, not a diffuse blur
- Four content-type accent colors (quiz red, poll blue, flashcard amber, presentation green) used consistently as a functional system, not a decorative palette
- Fredoka for display/headline weight, Nunito for body — a rounded, friendly display face paired with a warm, legible workhorse sans
- Fully theme-able: every rule lives on a CSS custom property, never a hardcoded hex, so Thales and Innov Campus reskin the whole app for free

## 2. Colors

The palette is committed, not restrained: indigo carries brand identity everywhere a CTA or focus state appears, while four saturated content-type colors do real semantic work across the whole product.

### Primary
- **Brivia Indigo** (`#4338ca`): every primary CTA, focus ring, active nav state, and brand accent. `Brivia Indigo Deep` (`#312e81`) is its pressed-shadow offset; `Brivia Indigo Soft` (`#ecebfe`) is its background-tint form for badges, selected states, and the pricing "highlight" column.

### Secondary (content-type system)
- **Quiz Red** (`#ff5a4d`): quiz content type — badges, answer-tile 1, live-session accents.
- **Poll Blue** (`#2f7bff`): poll content type — badges, answer-tile 2.
- **Presentation Green** (`#15c08a`): presentation/slide content type, and doubles as the universal "success/correct answer" color across quiz, exam, and poll flows.
- **Flashcard Amber** (`#ffb020`): flashcard content type — badges, answer-tile 4, leaderboard first-place row tint.

Each has a `-deep` variant (pressed-shadow offset, ~30% darker) and a `-soft` variant (10-15% tint, for badge backgrounds and soft-selected states).

### Neutral
- **Ink** (`#241b3a`): primary text.
- **Muted** (`#6d6288`): secondary text — verified 4.6:1 on the cream paper background.
- **Paper** (`#fff8ee`): the app's base background.
- **Paper 2** (`#f3ecdd`): a more saturated cream for zoned sections (e.g. partners strip).
- **Card** (`#ffffff`): surface color for cards, inputs, modals.
- **Line** (`#efe6d3`) / **Line 2** (`#d8ccb5`): border and dashed-dropzone colors respectively.

### Named Rules
**The Functional Color Rule.** The four content-type colors (quiz/poll/flashcard/presentation) are never used decoratively or interchangeably — each one is tied to its content type across the entire product, from a tiny type badge to a full-bleed answer tile in a live session. Don't reach for "poll blue" because it looks nice on a marketing section; reach for it because the content is a poll.

**The Pressed-Button Rule.** Every primary action surface (buttons, code inputs, answer tiles) carries a solid `-deep` offset shadow that compresses to 0 on `:active`. This is the system's signature tactility — don't replace it with a generic diffuse `box-shadow` blur.

## 3. Typography

**Display Font:** Fredoka Variable (with Fredoka, system-ui fallback)
**Body Font:** Nunito Variable (with Nunito, system-ui fallback)
**Wordmark Font:** Sora Variable, 600 weight, -3.5% letter-spacing — reserved exclusively for the "brivia" logotype, never for UI copy.
**Mono Font:** JetBrains Mono (Fira Code, Cascadia Code fallback) — reserved for game codes, PINs, timers, and scores; always paired with tabular figures.

**Character:** Fredoka is rounded and friendly with real weight at large sizes — it carries the arcade energy in headlines and scores. Nunito is warm and highly legible at body size, giving reading passages (question text, help copy) a calmer register than the display face.

### Hierarchy
- **Display** (Fredoka 600, 56px, line-height 1, -1.5px tracking): hero headlines, live-session score reveals.
- **Headline** (Fredoka 600, 38px, line-height 1.05, -1px tracking): page titles.
- **Subhead** (Fredoka 600, 28px, line-height 1.15, -0.5px tracking): standalone promotional banner headlines that need more weight than Title but shouldn't compete with the page Headline — e.g. a mid-page join-session CTA banner. Not for section intros; those use Title.
- **Title** (Fredoka 600, 20px): section headers, strong sub-section labels.
- **Body** (Nunito 400, 15px, line-height 1.5): running copy; cap at 65-75ch for readability.
- **Caption** (Nunito 400, 14px, line-height 1.45): short descriptive text under a card or tile title — one clause, not a full paragraph. Distinct from Label: sentence case, not uppercase; regular weight, not bold; for description text, not metadata.
- **Label** (Nunito 700, 12px, 0.5px tracking, uppercase): form labels, metadata, dense UI captions.
- **Button** (Fredoka 600, 15.5px): all CTA text, always Fredoka even inside Nunito-body contexts.

### Named Rules
**The Tabular Score Rule.** Any number that changes in real time — scores, timers, leaderboard points, game codes — uses `font-variant-numeric: tabular-nums` so digits don't visually jump width as they update. Display/Headline sizes get this by default.

## 4. Elevation

Brivia does not use diffuse blur shadows as its primary depth language. Depth comes from a solid-color offset shadow that mimics a physical button being pressed: a flat colored rectangle sits below the element at rest, grows on hover, and collapses to zero on `:active`, giving every clickable surface a tactile "arcade cabinet button" feel. Diffuse blur shadows exist as a secondary, quieter layer — used only for cards that float above the page (modals, the "floaty" card variant) rather than for interactive controls.

### Shadow Vocabulary
- **Soft** (`0 4px 0 var(--ap-line)`): resting state for standard cards — a light structural offset, not a floating effect.
- **Card** (`0 30px 60px rgba(60,40,120,.12), 0 4px 0 var(--ap-line)`): elevated/floaty cards and modals — diffuse ambient blur plus the same structural offset line.
- **Float** (`0 14px 30px rgba(60,40,120,.16)`): decorative floating elements (stage pills) with no structural offset.
- **Button press** (`0 5px 0 [color]-deep`, growing to `0 7px 0` on hover, collapsing to `0 0px 0` on `:active`): the core interactive-element shadow, colored per content type.

### Named Rules
**The Compress-on-Click Rule.** Interactive elements don't just darken or scale on press — their shadow visibly collapses (`translateY` matches the shadow's vertical offset) so the element looks like it physically sinks into the surface. This is what makes buttons feel "arcade," not generic.

## 5. Components

### Buttons
- **Shape:** rounded, `16px` radius at default size (`24px` at large, `12px` at small); fully pill-shaped (`999px`) available as a modifier.
- **Primary:** Brivia Indigo fill, white text, Fredoka 600 15.5px, `13px 24px` padding, `0 5px 0` indigo-deep pressed shadow.
- **Content-type variants:** identical shape and behavior, background swapped to quiz/poll/flashcard/presentation color with matching `-deep` shadow — used when the action is scoped to that content type (e.g. "Create Quiz").
- **Ghost/secondary:** white card background, ink text, a neutral line-colored pressed shadow plus an inset border — for secondary actions that shouldn't compete with the primary CTA.
- **Hover / Active:** hover lifts 2px and deepens the shadow by 2px; active pushes down the full shadow depth to simulate a full press.
- **Note — two component layers coexist:** hand-authored `.ap-btn*` classes power marketing pages and in-session screens (the pressed-shadow language above); the shadcn `Button` component (Radix + CVA, `rounded-lg`, `hover:shadow-card`) powers the builder/admin app shell with a flatter, more conventional shadcn shadow. New product-app screens should default to the shadcn `Button`; new marketing or live-session surfaces should default to `.ap-btn`.

### Chips / Badges
- **Style:** pill-radius, uppercase, 800 weight, 11px, `-soft` background with `-deep` text color per content type.
- **Type badges (larger variant):** white background, `2px` colored border at 45% opacity, colored dot, slight rotate-on-hover for a playful "sticker" feel.

### Cards / Containers
- **Corner Style:** `24px` radius by default (`30px` for the "floaty" variant).
- **Background:** white (`#ffffff`) on the cream paper background — the contrast between card and page is itself the primary layout signal, no borders needed to separate sections.
- **Shadow Strategy:** Soft shadow at rest; Card shadow plus a 3px lift on hover for interactive cards (see Elevation).
- **Border:** `2px solid` line color as a light structural edge, always present even when the shadow is doing the separation work.
- **Internal Padding:** `24px`.

### Inputs / Fields
- **Style:** white background, `2px` line-colored border, `12px` radius, bold (700 weight) text — inputs are visually heavier than typical form fields to match the confident type system.
- **Focus:** border shifts to Brivia Indigo plus a `4px` indigo-soft glow ring — assumed as a style choice, not hidden as an accessibility afterthought.
- **Game code fields:** a distinct large mono variant (25-32px, 6-14% letter-spacing, tabular numerals) for PINs and join codes — always visually distinct from regular text inputs.
- **Game code fields — compact:** in width-constrained inline contexts (e.g. the join-session banner's inline code entry, sitting next to its submit button in a fixed-width pill), the same field drops to 22px with letter-spacing pushed up to 8% to keep the 6-character code readable without widening the container. Only use this variant when the standard 25-32px size would overflow its container; the standalone `/join` code field always uses the full-size variant.

### Navigation
- **Style:** pill-shaped nav container with `2px` border and a light structural shadow; individual items are ghost buttons that gain a `paper-2` background on hover/active. Mega-menu chevrons rotate 180° on open. Mobile treatment collapses into the same pill pattern within a drawer.

### Answer Tiles (signature component)
Live-session and quiz-builder answer options render as cards with a colored geometric shape and matching border/shadow keyed to position (1-4 map to quiz/poll/presentation/flashcard colors). Selection floods the tile with the `-soft` background and `-deep` border/shadow; correct answers get a spring-eased bounce animation and flood fully with the presentation-green "correct" color; incorrect answers shake; unselected answers dim to 45% opacity. This is the product's most distinctive, most-reused pattern — any new question-type UI should extend it rather than invent a new answer-selection language.

## 6. Do's and Don'ts

### Do:
- **Do** use the pressed-shadow-and-compress pattern (`0 5px 0 [deep-color]` → `0 0px 0` on `:active`) for every primary interactive control — it's the system's signature tactility.
- **Do** tie each of the four content-type colors (quiz red, poll blue, flashcard amber, presentation green) strictly to its content type across badges, buttons, and answer tiles.
- **Do** use tabular numerals (`font-variant-numeric: tabular-nums`) on any live-updating number: scores, timers, leaderboard points.
- **Do** keep the wordmark in Sora at -3.5% tracking; never set the "brivia" logotype in Fredoka or Nunito.
- **Do** respect `prefers-reduced-motion`: every bounce, shake, confetti burst, and cascade entrance has a defined reduced-motion fallback (already implemented in `arcade-pop.css` §"Réduction des animations").
- **Do** vary section-intro treatment on long-scroll pages: the `ap-badge ap-badge--brand` kicker above a section H2 is one option, not mandatory scaffolding. Drop it where the section already carries its own framing (an internal heading, a self-explanatory H2 like "FAQ") and keep it only where the section genuinely needs the extra label.

### Don't:
- **Don't** default to corporate SaaS-cream: flat gray-on-beige cards, generic icon-grid dashboards, or soulless enterprise-tool blandness. The cream paper background is a deliberate warm "game board," not a safe neutral.
- **Don't** use a generic diffuse `box-shadow` blur as the primary depth cue on buttons or answer tiles — that's the shadcn/app-shell language, not the Arcade Pop marketing/live-session language; don't mix them on the same screen.
- **Don't** use border-left/border-right colored stripes as an accent anywhere; the system already has badges, dots, and pill borders for that job.
- **Don't** hardcode hex values in new components — every color, radius, and shadow in this system exists as a `--ap-*` custom property specifically so Thales and Innov Campus can reskin it. A hardcoded hex breaks all three themes at once.
- **Don't** make the interface feel childish or toy-like despite the playful shape language — type stays confident and legible, copy stays sharp, and the exam/grading surfaces stay visually rigorous even inside the same system.
