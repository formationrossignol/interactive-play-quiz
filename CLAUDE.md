# Brivia

## Design Context

Full strategic and visual specs live in `PRODUCT.md` and `DESIGN.md` at the project root (see also `.impeccable/design.json`). Read them before design work; this is a quick pointer, not a substitute.

- **Register:** product — the app itself (builder, live sessions, admin, exams) is the point; marketing pages funnel into it.
- **Platform:** web (Vite + React SPA).
- **Positioning:** the only tool covering quiz, poll, flashcard, presentation, course, and exam in one product, with arcade energy and real depth — where Kahoot/Mentimeter/Wooclap each cover one or two of those.
- **Visual North Star:** "The Arcade Cabinet" — warm cream paper background, indigo (`#4338ca`) brand color, buttons with a pressed-shadow-and-compress interaction, four content-type accent colors (quiz red / poll blue / flashcard amber / presentation green) used as a functional system, not decoration.
- **Anti-reference:** corporate SaaS-cream — flat gray-on-beige dashboards, generic icon grids, soulless enterprise-tool blandness.
- **Theming:** three skins share one token grammar — Arcade Pop (default, `arcade-pop.css`), Thales (`theme-thales.css`, angular/institutional), Innov Campus (`theme-innov.css`, black/white/turquoise). Never hardcode a hex in new UI; use the `--ap-*` custom properties so all three skins stay correct.
