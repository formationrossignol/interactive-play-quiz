---
name: Brivia — Material 3
description: The calm, role-based skin for Brivia's correction and administration surfaces — one of five selectable themes, confirmed as the canonical design authority.
colors:
  primary: "#65558f"
  primary-container: "#eaddff"
  secondary: "#625b71"
  secondary-container: "#e8def8"
  tertiary: "#7d5260"
  tertiary-container: "#ffd8e4"
  danger: "#b3261e"
  danger-container: "#f9dedc"
  surface: "#fffbfe"
  surface-container-low: "#f7f2fa"
  surface-container: "#f3edf7"
  surface-container-high: "#ece6f0"
  ink: "#1d1b20"
  muted: "#49454f"
  outline: "#79747e"
  outline-variant: "#cac4d0"
  quiz: "#7a5900"
  quiz-soft: "#f6e8c8"
  poll: "#006a6a"
  poll-soft: "#9cf1f0"
  pres: "#386a20"
  pres-soft: "#b7f397"
  flash: "#7d5260"
  flash-soft: "#ffd8e4"
typography:
  display:
    fontFamily: "Roboto Flex Variable, Roboto Flex, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 475
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Roboto Flex Variable, Roboto Flex, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Roboto Flex Variable, Roboto Flex, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 560
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Roboto Flex Variable, Roboto Flex, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Roboto Flex Variable, Roboto Flex, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.5px"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 24px"
  button-ghost:
    backgroundColor: "{colors.secondary-container}"
    textColor: "#1d192b"
    rounded: "{rounded.pill}"
    padding: "0 24px"
  card:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  card-floaty:
    backgroundColor: "#ffffff"
    rounded: "{rounded.xl}"
  input:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "12px 16px"
  badge-quiz:
    backgroundColor: "{colors.quiz-soft}"
    textColor: "#5c4300"
    rounded: "{rounded.sm}"
---

# Design System: Brivia — Material 3

## Overview

**Creative North Star: "The Calm Instructor"**

Brivia ships five selectable visual skins; Arcade Pop (sticker-shadow buttons, dot-texture backgrounds, playful bounce) is the code default that live quiz sessions run in. Material 3 is a different register entirely — the skin for the correction, grading, and administration side of the product, and the one the team has confirmed as canonical design authority for future work. Where Arcade Pop performs energy for a room full of players, Material 3 is built for one person at a desk, working through a queue: grading submissions, reviewing exam results, managing an organization. It should never borrow Arcade Pop's vocabulary — no offset drop-shadows, no dotted texture, no elastic overshoot. Everything here is tonal, flat at rest, and quiet until touched.

The system runs on real Material 3 role tokens (primary/secondary/tertiary/surface/error), not a reskinned copy of Arcade Pop's four-color content system. Content-type colors (quiz/poll/flashcard/course) are deliberately *not* mapped onto Material's semantic roles — that coupling previously caused two real bugs (quiz content reading as an error state, then as visually identical to muted gray) — so they're hand-tuned hex values that coexist with, but never borrow meaning from, the role system.

**Key Characteristics:**
- One type family (Roboto Flex) carries every role; hierarchy is weight and optical size, not a family switch.
- Flat at rest. Elevation is something that happens in response to interaction, not a resting state.
- Full-radius (pill) buttons and navigation items; large-radius (16–28px) cards and menus. Nothing sharp-cornered.
- Role tokens for chrome and structure; hand-tuned hex for content-type identity. The two systems never share a token.

## Colors

Role-based and restrained: two saturated accents (primary, danger) carry almost all of the color weight; everything else is a tonal step of ink, surface, or outline.

### Primary
- **Muted Scholar's Violet** (`#65558f`): the one saturated color in the chrome layer. Primary buttons, active nav state (via its container), focus rings, selected states, logo tile, avatar background.

### Secondary
- **Quiet Plum** (`#625b71`): ghost/secondary button fills, hover states on menu items and sidebar rows, always via its container tone (`#e8def8`), never as a flat block on its own.

### Tertiary
- **Dusted Rose** (`#7d5260`): reserved for the "flashcards" content-type role and its own button variant (`.ap-btn--flash`) — the one place a content color and a Material role are allowed to coincide, since flashcards has no separate identity elsewhere in the system.

### Neutral
- **Ink** (`#1d1b20` light / `#e6e0e9` dark): primary text, `on-surface`.
- **Muted** (`#49454f` light / `#cac4d0` dark): secondary text, captions, `on-surface-variant`.
- **Surface** (`#fffbfe` → `#f3edf7` → `#ece6f0`, light): the app background, then two steps of container tone used for card stacking and hover states. No pure white-on-gray; every surface is a step in the same tonal ramp.
- **Outline** (`#79747e`) / **Outline Variant** (`#cac4d0`): borders and dividers, used sparingly — most separation comes from surface-tone contrast, not lines.

### Content-type colors (not Material roles)
- **Quiz — Burnished Amber** (`#7a5900`): hand-tuned, not a system role. Originally sat on the error role, then on secondary — both created real visual collisions (quiz content reading as a warning, then as indistinguishable from muted gray, ~1.4:1 contrast). Amber was chosen specifically because it doesn't collide with any role or other content color.
- **Poll — Deep Teal** (`#006a6a`), **Course/Slide — Field Green** (`#386a20`): each hand-tuned per content type, consistent with how the other four skins (Arcade Pop, Thales, Innov, Studio) also give quiz/poll/flashcard/slide their own bespoke hue rather than inheriting a system role.

### Named Rules
**The Role Discipline Rule.** Material's semantic roles (primary/secondary/tertiary/error) style chrome, structure, and system state. Content-type identity (quiz/poll/flashcard/slide) is a separate, hand-tuned palette. The two must never alias to the same token — that coupling has caused two shipped bugs already.

**The Danger Is Not Content Rule.** `--ap-danger` (`#b3261e`, the real Material error role) is reserved for destructive actions, validation failures, and load errors. It is never reused as a content-type color, even when a content color happens to also be reddish elsewhere in the system.

## Typography

**Display Font:** Roboto Flex Variable (with Roboto Flex, system-ui fallback)
**Body Font:** Roboto Flex Variable — same family as display
**Label Font:** Roboto Flex Variable, uppercase, heavy weight

**Character:** One variable family doing all the work. Where Arcade Pop pairs a display face (Fredoka) against a body face (Nunito) for playful contrast, Material 3 stays inside a single optical system — Roboto Flex's variable axes (weight, width, optical size) supply the hierarchy instead of a family switch.

### Hierarchy
- **Display** (475, 56px, line-height 1, -0.02em): scores, hero numbers, the biggest number on a page.
- **Headline** (500, 38px, line-height 1.05, -0.015em): page titles.
- **Title** (560, 20px, line-height 1.2): section headings, card titles, strong labels.
- **Body** (400, ~15px, line-height 1.5): running text, descriptions. Not formalized into a single CSS class — set per component, observed in the 13–15px range depending on density.
- **Label** (800, 12px, letter-spacing 0.5px, uppercase, muted color): field labels, eyebrow text, badges.

### Named Rules
**The Single Family Rule.** Every text role uses Roboto Flex. If a new role is needed, adjust weight and optical size before reaching for a second font family — a family switch is an Arcade Pop move, not a Material 3 one.

## Layout

Container-driven, generous but not loose: cards sit in a `repeat(auto-fit, minmax(200px, 1fr))`-style responsive grid, gap 16px. Density is moderate — 40px minimum touch target on every interactive control (buttons, icon buttons, sidebar rows), 48px on menu items and sidebar nav buttons specifically, matching Material's own touch-target guidance rather than Arcade Pop's tighter 36px rhythm.

## Elevation & Depth

Tonal, not shadow-driven. Material 3 surfaces sit flat at rest — cards, buttons, and menus carry `box-shadow: none` by default — and depth is communicated by stepping through the surface-container tonal ramp (surface → surface-container-low → surface-container → surface-container-high) rather than by casting a shadow. Real elevation (Material's own `elevation-1/2/3` shadow tokens) appears only as a response to state: button hover, card hover (`.ap-card--hover`), open menus and dropdowns.

### Shadow Vocabulary
- **Elevation 1** (`0 1px 2px rgb(29 27 32 / .3), 0 1px 3px 1px rgb(29 27 32 / .15)`): button hover.
- **Elevation 2** (`0 1px 2px rgb(29 27 32 / .3), 0 2px 6px 2px rgb(29 27 32 / .15)`): card hover, open menus/mega-menu.
- **Elevation 3** (`0 1px 3px rgb(29 27 32 / .3), 0 4px 8px 3px rgb(29 27 32 / .15)`): floaty cards (`.ap-card--floaty`).

### Named Rules
**The Flat-Until-Touched Rule.** Every filled surface is flat at rest. A shadow appearing on a surface that isn't being hovered, focused, or actively open is a bug, not a stylistic choice.

## Shapes

Rounded and continuous, scaling up with the size and importance of the element: 4px on inputs, 8px on badges/chips, 12px on tile icons, 16px on cards, 28px on floaty cards and menus, full pill radius (999px) on every button and every active sidebar row. Border width is 1px throughout (half of Arcade Pop's 2px) — Material 3 draws hierarchy through surface tone, not line weight, so borders are used sparingly and thinly when they appear at all.

## Components

Tonal and unhurried: nothing here announces itself with a shadow or a bright flat color at rest. Every filled surface is a container tone; the one saturated accent (primary) is spent on the actions that actually matter (primary CTA, active state, focus ring).

### Buttons
- **Shape:** full pill radius (999px), min-height 40px (56px for `--lg`, 40px for `--sm`).
- **Primary:** primary role fill (`#65558f`), white text, no shadow at rest; hover brightens (`filter: brightness(1.06)`) and gains elevation-1; active scales down to 0.98 and dims.
- **Ghost/Secondary:** secondary-container fill (`#e8def8`) with on-secondary-container text — never a bare outline-only ghost button under this skin.
- **Content-type variants** (`--quiz`, `--poll`, `--flash`, `--pres`): each takes its hand-tuned content color as a flat fill; `--quiz` is the one exception that still uses the Material error role for its text/background pairing (`.ap-btn--quiz`), a legacy coupling worth revisiting since it reintroduces the same role/content conflation the rest of the system was fixed to avoid.
- **Icon buttons:** perfect circle, 40×40px, zero padding.

### Cards / Containers
- **Corner Style:** 16px standard, 28px for `--floaty`.
- **Background:** `surface-container-low` at rest; `surface-container` on hover (`.ap-card--hover`).
- **Shadow Strategy:** none at rest; elevation-2 on hover, elevation-1 for the floaty variant at rest.
- **Border:** none. Tone alone separates card from page.
- **Internal Padding:** 20px, matching the `spacing.lg` step.

### Inputs / Fields
- **Style:** 1px outline border, 4px radius (the tightest radius in the system — inputs read as precise, not soft), `surface-container-highest` fill.
- **Focus:** border widens to 2px and switches to primary color; no glow, no box-shadow.

### Badges / Chips
- **Style:** 8px radius, no shadow, 600 weight text. Each content type gets a soft-tone background paired with its own deep-tone text (`quiz-soft` + a dark amber text, `poll-soft` + deep teal text, etc.) — the same container-pairing logic as the role system, applied to content colors.

### Navigation
- **Sidebar:** `surface-container-low` background, no border. Menu buttons are 48px tall, full pill radius, `on-surface-variant` text at rest. Active state fills with `secondary-container` and switches the row's icon to the filled Material Symbol variant — the one place icon weight itself carries state, not just color.
- **Menus/dropdowns:** 28px radius, `surface-container` background, elevation-2, no border. Menu items are 48px tall with 12px radius and highlight with `secondary-container` on hover/focus.

## Do's and Don'ts

### Do:
- **Do** keep every filled surface flat at rest; earn elevation only through hover, focus, or an open state.
- **Do** use full pill radius on every button and active navigation row — it's the single most consistent shape signal in this skin.
- **Do** pair a soft-tone background with its matching deep-tone text for any badge/chip (never a flat saturated fill with white text, except on primary/danger buttons).
- **Do** keep content-type colors (quiz/poll/flash/pres) hand-tuned and independent from Material's semantic roles.

### Don't:
- **Don't** borrow Arcade Pop's vocabulary — no offset/sticker shadows, no dot-texture backgrounds, no elastic/bounce easing. Material's motion is a single `cubic-bezier(0.2, 0, 0, 1)` curve, decelerate-only, no overshoot.
- **Don't** alias a content-type color to a Material system role (see `.ap-btn--quiz`'s lingering use of the error role — a known exception to fix, not a pattern to repeat).
- **Don't** add a border where a tonal surface step would do the job — this skin separates content by color value, not by line.
- **Don't** introduce a second type family. Every role runs on Roboto Flex; reach for weight and optical size before reaching for a new face.
