# QuizMaster — Redesign Design Spec

**Date:** 2026-04-07  
**Scope:** Full app redesign — all pages, components, live session, participant view  
**Stack:** React + TypeScript + Vite + shadcn/ui + Tailwind CSS

---

## Context & Goals

The current design uses a glassmorphism navy blue aesthetic ("premium minimalist") that feels corporate and cold. The target audience is teachers/trainers and their students/learners. The new design should feel **bright, modern, approachable** — edu-tech professional, not heavy SaaS.

**Direction chosen:** Bright & Minimal, edu-tech moderne (Option B)  
**Mode:** Light mode first (dark mode deferred)

---

## 1. Design Tokens

### Color Palette

| Role | Name | Hex |
|---|---|---|
| `--primary` | Indigo vif | `#6366F1` |
| `--primary-foreground` | White | `#FFFFFF` |
| `--secondary` | Violet doux | `#818CF8` |
| `--background` | Blanc quasi-pur | `#F8FAFC` |
| `--foreground` | Slate foncé | `#1E293B` |
| `--muted` | Slate clair | `#F1F5F9` |
| `--muted-foreground` | Slate moyen | `#64748B` |
| `--border` | Slate très clair | `#E2E8F0` |
| `--card` | Blanc pur | `#FFFFFF` |
| `--success` | Emeraude | `#10B981` |
| `--destructive` | Rouge | `#EF4444` |
| `--ring` | Indigo focus | `#6366F1` |

**Accent couleurs par type de contenu :**
| Type | Accent | Hex |
|---|---|---|
| Quiz | Corail | `#FF6B6B` |
| Poll | Cyan | `#06B6D4` |
| Flashcard | Amber | `#F59E0B` |
| Slide | Vert | `#10B981` |

### Typography

**Font:** Plus Jakarta Sans (single font family, all weights)  
**Import:** `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');`

| Usage | Weight | Size |
|---|---|---|
| Page titles (h1) | 800 | 2.25rem–3rem |
| Section titles (h2) | 700 | 1.5rem–1.875rem |
| Card titles (h3) | 600 | 1.125rem–1.25rem |
| Body text | 400 | 1rem (16px min) |
| Labels / captions | 500 | 0.875rem |
| Line height body | — | 1.6 |

Remove: Bebas Neue (trop display/uppercase), Merriweather, Playfair, Space Grotesk.  
Keep: Plus Jakarta Sans replaces Inter + Bebas Neue.

### Spacing & Shape

- **Border radius:** `0.875rem` (14px) default — `0.5rem` for small elements, `1.25rem` for large panels
- **Shadow:** `0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)` for cards
- **Shadow hover:** `0 4px 16px rgba(99,102,241,0.15)` (indigo tint)

---

## 2. Component Specifications

### Header

- Background: `white/95` + `backdrop-blur-sm`, `border-b border-slate-100`
- Logo: indigo icon (single color `#6366F1`), Plus Jakarta Sans bold, no gradient
- Navigation: text links, horizontal, no icon+label stacked layout
- "Se connecter": `outline` button, indigo border + text
- "Créer": filled indigo button, rounded-full
- Mobile: hamburger menu → slide-down dropdown

### Home Page (Index)

**Remove:**
- `floating-orb` decorative elements
- Glassmorphism (`glass-panel`, `glass-tile`)
- Gradient backgrounds on hero

**Hero section:**
- Background: `#EEF2FF` (indigo-50) with subtle dot pattern (optional)
- Badge pill: `bg-indigo-100 text-indigo-700`
- H1: Plus Jakarta Sans 800, `text-slate-900`, 3rem on desktop
- Subtitle: `text-slate-500`, 1.125rem, max 2 lines
- CTA primary: indigo filled, rounded-full, `h-12 px-8`
- CTA secondary: outline slate, rounded-full

**Feature tiles (quiz/slide/poll/flashcard):**
- White card, `rounded-2xl`, soft shadow
- Left border accent (4px) in type color (coral for quiz, cyan for poll, etc.)
- Icon in colored circle (type accent color, 20% opacity background)
- Title: Plus Jakarta Sans 600, `text-slate-800`
- Description: `text-slate-500`
- Hover: `translateY(-2px)`, shadow with indigo tint, 200ms ease-out
- `cursor-pointer` on all

**Join section:**
- Centered white card, `max-w-xl`
- Input: `h-12 rounded-xl`, indigo focus ring
- Button: indigo filled, `h-12`

### Internal Pages (MyQuizzes, MyPolls, MyFlashcards)

- Page background: `#F8FAFC`
- Page title: Plus Jakarta Sans 700, `text-slate-900`
- Tabs: underline style, indigo active indicator
- Quiz cards: white, `rounded-2xl`, soft shadow, left accent border by type
- Card actions: ghost icon buttons with `cursor-pointer` and tooltip
- Empty state: centered, SVG illustration inline, muted text, CTA button

### QuizBuilder

- Toolbar: white sticky bar, `border-b border-slate-100`
- Question list: white cards, drag handle visible on hover
- Editor panel: `bg-slate-50`, white form sections

### Live Session (Host view)

- Background: `bg-indigo-600` or quiz theme color (not black)
- Question card: white, `rounded-2xl`, large text (readable on projector)
- Timer: circular, indigo → red in last 5s
- Participant count: pill badge, white/20 background

### Participant View (PlayerView)

- Full-screen, background matches quiz accent color
- Answer buttons: white cards, `min-h-[44px]`, color tint on selection
- Selected state: filled with type accent, white text
- Submit button: indigo filled, full-width on mobile

---

## 3. Animation & Interaction

### Micro-interactions

| Element | Animation | Duration |
|---|---|---|
| Card hover | `translateY(-2px)` + shadow increase | 200ms ease-out |
| Button click | `scale(0.98)` | 100ms |
| Color transitions | `transition-colors` | 150ms |
| Focus rings | Instant | — |

### Loading States

- Lists: skeleton screens (not spinners)
- Async buttons: inline spinner, button disabled during operation
- Page transitions: none (instant, no route animation needed)

### Live Session Specific

- Timer: smooth CSS animation, color transition to red at ≤5s
- Question transition: `opacity 0→1` fade, 300ms
- Results bars: width animate from 0 to value, 600ms ease-out, staggered 100ms per bar

### Accessibility

- `prefers-reduced-motion`: all animations disabled when set
- Focus rings: visible indigo `outline-2 outline-offset-2 outline-indigo-500` on all interactive elements
- All icon-only buttons: `aria-label` required
- Contrast: minimum 4.5:1 guaranteed with chosen palette
- Touch targets: minimum 44×44px

---

## 4. What Changes vs Current Design

| Current | New |
|---|---|
| Navy `#0f1a3d` primary | Indigo `#6366F1` primary |
| Glassmorphism (`backdrop-blur`, `bg-white/70`) | Opaque white cards |
| Floating orbs | Removed |
| Bebas Neue uppercase headings | Plus Jakarta Sans, normal case |
| Gradient buttons | Solid color buttons |
| Mixed glass + shadcn cards | Consistent white cards everywhere |
| `--radius: 1.5rem` | `--radius: 0.875rem` |
| Transition 450ms on tiles | 200ms |
| Dark navy vibe | Light, open, airy |

---

## 5. Out of Scope

- Dark mode (deferred)
- New features / logic changes
- Backend / data model changes
- i18n string changes

---

## 6. Implementation Order

1. Design tokens (`index.css` + `tailwind.config.ts`)
2. Typography (`index.css` font import + `font-heading` class removal)
3. Header component
4. Home page (Index.tsx)
5. MyQuizzes / MyPolls / MyFlashcards pages
6. QuizBuilder & QuizBuilderStart
7. LiveQuiz & PlayerView (session views)
8. Remaining pages (Auth, Pricing, Features, etc.)
