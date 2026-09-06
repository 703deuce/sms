# Transovo Visual Design Guide

**Status:** Active — required reference for all visual design and styling  
**Audience:** Engineers, designers, and Cursor agents (including Kimi) building Transovo UI  
**Layer:** Visual design system — **after** IA and page architecture, **before** individual page polish  

**Prerequisites (read in order):**

1. `docs/TRANSOVO-UI-DESIGN-GUIDE.md` — what goes where (IA, heuristics)  
2. `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` — how every page is structured  
3. **This document** — how everything looks, feels, scales, aligns, and behaves  

**Standards basis:** WCAG 2.2 (accessibility floor), professional design-system practice (semantic tokens, component states, restrained color), Gestalt hierarchy—not one company’s house style copied blindly.

**Related implementation (evolve toward this guide, do not bypass it):**

- Global tokens: `src/app/globals.css` (`:root`, `@theme inline`)
- Kimi surfaces: `src/styles/kimi/`
- Shared UI components: `src/components/ui/`

---

## When to use this guide

**Follow these rules whenever you:**

- Choose typography, color, spacing, radius, shadow, or motion  
- Style buttons, inputs, tables, badges, cards, drawers, modals, charts  
- Design empty, loading, error, or success states visually  
- Add a new component variant or “one-off” style on a page  

**Kimi must not design each page independently.** Design **within the Transovo system**.

If a visual choice conflicts with this guide, resolve it before shipping.

---

## The three questions this layer answers

| Layer | Question |
|-------|----------|
| IA | What goes where? |
| Page architecture | How is the page structured? |
| **Visual design** | How should it look, feel, scale, align, and behave so the product feels premium, consistent, and professional? |

---

## Visual direction (locked aesthetic)

**Professional, calm, precise, modern, medium-density operational SaaS.**

| Aim for | Avoid |
|---------|--------|
| Neutral foundation, one restrained accent | Futuristic AI neon, glowing gradients |
| Strong type hierarchy, deliberate spacing | Bubbly consumer SaaS, giant hero typography |
| Subtle borders, minimal shadow | Old gray enterprise boxes |
| Clear operational status | Giant-card startup dashboard |
| Advanced features quiet until needed | Decorative effects competing with data |

The product should feel comfortable for a dental office, consulting firm, sales team, healthcare office, or contractor to keep open all day.

**Density target:** Professional **medium-density** — not ultra-dense legacy enterprise, not luxurious consumer whitespace. ~14–16px body, compact-but-comfortable controls, efficient table rows, no giant in-app hero type.

---

## Design System Foundation (required before page redesign)

Do not let Kimi redesign Home, Appointments, or Booking until this foundation is specified and tokenized. Every page must consume it.

### Typography

- Font family (+ fallbacks)  
- Named size scale (display → caption)  
- Weight roles (regular / medium / semibold)  
- Line heights per text role  

### Color

- Page / surface / background levels  
- Primary / secondary / muted text  
- Borders (subtle, default, strong)  
- Accent (brand)  
- Semantic: success, warning, danger, info, neutral  
- Light theme tokens (+ dark theme if supported)  

### Spacing

- Base unit (4px grid)  
- Spacing scale  
- Page gutters  
- Section gaps (title→subtitle, header→tabs, section→content)  

### Shape

- Radius scale (controls, cards, panels, pills)  
- Border thickness  
- Elevation / shadows (when allowed)  

### Components (documented variants + states)

Buttons, inputs, selects, tabs, badges, alerts, cards, tables, drawers, modals, tooltips, dropdowns, toasts, skeletons.

Each component spec includes: **variants, sizes, states** (default, hover, pressed, focus, selected, disabled, loading, error).

### Interaction

Hover, active, selected, focus, disabled, loading, error — per component.

### Responsive

Breakpoints, sidebar behavior, drawer→sheet, table→cards, mobile spacing/type compression.

### Accessibility

WCAG AA contrast, focus visibility, 200% zoom, non-color state, touch targets, `prefers-reduced-motion`.

---

## Recommended token map (semantic)

Prefer **semantic** tokens over literal names (`blue500`, `gray300`).

```
color-bg-page
color-bg-surface
color-bg-surface-raised
color-text-primary
color-text-secondary
color-text-muted
color-text-disabled
color-border-subtle
color-border-default
color-accent
color-accent-foreground
color-status-success
color-status-warning
color-status-danger
color-status-info
color-focus-ring
```

Map existing `:root` variables in `globals.css` toward this vocabulary over time; new work should use semantic names.

---

## Typography scale (named roles)

Do not freestyle font sizes. Use **named roles** only.

| Role | Size (target) | Use |
|------|----------------|-----|
| Display | 32–36px | Rare hero only (marketing/onboarding) |
| Page title | 24–28px | Every page header |
| Section heading | 18–20px | In-page sections |
| Card heading | 16px | Card/panel titles |
| Body | 14–16px | Default reading |
| Secondary body | 13–14px | Supporting copy |
| Label | 12–13px | Form labels, table headers |
| Caption / metadata | 11–12px | Timestamps, hints |

**Weights:** regular (body), medium (labels/actions), semibold (headings). Avoid excessive bold (600–700 everywhere). No ultra-light weights in UI.

**Line height:** Define per role—not browser default. Body gets breathing room; dense labels can be tighter.

**One typeface family** for the app (e.g. Plus Jakarta Sans via `--font-sans` / `--font-display`). No mixing heading/body/nav fonts without deliberate brand reason.

**Prose width:** Explanatory text ~50–75 characters per line. Tables, calendars, builders may span wide.

**Alignment:** Left-align body, labels, settings, forms, table text. Center only for empty states, small confirmations, marketing/login—not operational pages.

**Capitalization:** **Sentence case** for UI labels (`New appointment`, `Booking types`). Pick one system; never drift.

---

## Spacing scale (4px base)

Use the scale—not random values.

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64
```

**Proximity = relationship:** title + subtitle (small gap) → status badges (moderate) → new section (large).

**Vertical rhythm:** Same gaps everywhere for title→subtitle, header→tabs, section→content, card→card, field→field.

---

## Surface hierarchy

| Level | Use |
|-------|-----|
| App background | Shell; subtle neutral |
| Primary content surface | Main workspace |
| Elevated surface | Cards, drawers; slight differentiation |
| Overlay surface | Modals, popovers; above scrim |

Not 15 slightly different grays. **Borders before heavy shadows** for B2B panels. Shadows for genuinely elevated UI: dropdowns, menus, popovers, modals, drawers—not every card.

---

## Radius system

| Element | Radius |
|---------|--------|
| Small controls | 4–6px |
| Cards / fields | 6–8px |
| Large panels | 8–12px |
| Pills | Full round **only** for compact states/categories |

Premium ≠ everything extremely round.

---

## Color discipline

**Most UI:** neutral backgrounds, neutral text, neutral borders.

**Color for:** primary action, active/selected state, semantic status, limited data viz—not decoration.

**One accent** for: primary action, active nav, selection, focus emphasis. If everything is accent-colored, accent means nothing.

**Semantic colors (fixed meanings):**

| Token | Meaning |
|-------|---------|
| Success / green | Successful, healthy, confirmed |
| Warning / amber | Needs attention |
| Danger / red | Error, destructive, failure |
| Info / accent | Active, interactive, informational |

Never swap meanings by page. **Never state with color alone** — always pair with label/icon (`Failed`, not red dot only).

**Contrast (WCAG AA minimum):** 4.5:1 normal text, 3:1 large text; ~3:1 for component boundaries/state indicators. No trendy ultra-light gray for labels, placeholders, or metadata.

**No transparency shortcuts** for text (`rgba(0,0,0,.45)` everywhere). Use defined `text-primary`, `text-secondary`, `text-muted`, `text-disabled` tokens.

**Dark mode:** Real theme tokens per role—not inverted white/black.

**Reserve red** for destructive/error. **Reserve accent** for meaningful interaction—not decorative backgrounds.

---

## Icons

- **One visual family** (e.g. Lucide): consistent stroke, corners, optical alignment  
- **Sizes:** 16 (small), 20 (standard), 24 (prominent)—not per-screen improvisation  
- **Icon + text** when concept is unfamiliar (Routing, Automations, AI booking)  
- Icon-only OK for search, close, more, back  

---

## Buttons

| Variant | Use |
|---------|-----|
| Primary | One dominant action per cluster |
| Secondary | Important, not dominant |
| Tertiary / ghost | Low-emphasis contextual |
| Destructive | Delete / revoke in danger zone |

**One primary button** per action cluster. Match visual hierarchy to consequence (Publish > Test > overflow > Delete).

**Heights:** compact / default / large — standardized; no 34, 39, 43px randomness.

**Touch targets:** ~44px effective hit area when practical (WCAG 2.5.8).

**States:** default, hover, pressed, focus, selected, disabled, loading — all designed. **Do not remove focus outline** without a visible replacement.

**Disabled:** Visually distinct + user must understand why (or link to fix). Not the default way to explain unavailable actions.

---

## Forms

**Anatomy (every field):**

```
Label
[ input                         ]
Helper text / error
```

Visible label always. Placeholder = example only (`name@example.com`), not the label.

**Order:** required/common → optional → advanced → destructive.

**Max widths** match content (business name ≠ 1200px wide; phone/ZIP/date = short).

**Errors:** color + marker + text (`⚠ Enter a complete email address.`).

**Validation timing:** not hostile red on every keystroke; blur/submit where appropriate; clear when fixed.

**Conditional fields:** hidden until relevant (round-robin controls only when round-robin selected).

**Defaults:** prefill sensible workspace defaults.

---

## Tables and data

- **Density** without cramping: consistent row height, aligned columns, quiet secondary text  
- **Right-align** numbers and money where comparison matters  
- **One date/time format system** (see Page Architecture Rules)  
- **Status density:** at most ~2 badges per row; rest in detail  
- **Row states:** hover, selected, focus — distinct and keyboard-accessible  
- **Full width** when comparison matters  

**Numbers:** `$1,250.00`, `23%`, `1,204` — consistent formatting.

---

## Cards, dividers, whitespace

**Cards** for distinct regions—not card-in-card-in-card. Prefer whitespace and section headings first.

**Whitespace** before borders/shadows for grouping.

**Dividers:** subtle, between true sections or table rows—not after every field.

---

## Motion

**Purpose:** show relationship, state transition, spatial context.

| Duration | Use |
|----------|-----|
| Fast | Small feedback, dropdowns |
| Moderate | Drawer, modal |
| Restrained | Page transitions |

Respect `prefers-reduced-motion`. No decorative bounce/pulse.

**Stability:** skeletons match final geometry; buttons don’t jump width on loading; tables don’t collapse to 20px.

---

## Charts and analytics

- **Separate palette** from UI accent (categorical, sequential, diverging)  
- **Chart only when pattern matters** — big KPI may beat a chart for `86%`  
- **Data ink:** quiet gridlines, clear labels, no gradient chart chrome  
- No 3D, no rainbow donuts without categorical need  

---

## Empty and loading states

**Empty:** compact, professional — icon, heading, short explanation, one action. Not enormous illustrations on operational pages.

**Loading:** skeleton shaped like final content (table rows, cards, detail blocks).

**Success:** subtle for toggles (`Saved`); more substantial for consequential flows (A2P submitted).

---

## Layout width by task

| Width | Pages |
|-------|--------|
| **Wide / full** | Calendar, tables, builders, analytics |
| **Medium** | Detail pages, booking type editor |
| **Narrow** | Settings forms, onboarding, confirmations |

Shell is consistent; **workspace width follows the job**.

**Desktop:** not overly airy—operational efficiency over landing-page whitespace.

**Navigation:** visually quieter than content. Active = clear; inactive = subdued; section labels = quietest.

---

## Drawers, modals, sticky UI

| Surface | Width |
|---------|--------|
| Modal small | Confirm delete |
| Modal medium | Add contact |
| Modal large | Complex preview only |
| Drawer standard / wide | Fixed tokens—not random per page |
| Mobile | Drawers → full-screen sheets |

**Sticky:** save bar, table header, calendar controls, builder toolbar — yes.  
**Not:** header + subheader + tabs + filters + banners all sticky.

**Tooltips:** supplementary only. Required info (why SMS disabled) must be visible or behind explicit info action.

**Truncation:** recovery via tooltip, detail view, or expand—not permanent loss of critical text.

---

## Visual emphasis budget

Per viewport, only a few elements demand strong attention:

- Page title  
- Primary action  
- One critical warning  
- Selected object  

If 8 colored cards + 5 bright buttons + 7 badges compete, hierarchy is broken.

**Healthy status** (`Connected`, `Synced`, `Paid`) = quiet. **Exceptions** = prominent.

---

## Alignment and grid

- Invisible alignment lines: titles, toolbars, columns, form labels share x-positions  
- Macro grid: sidebar + gutters + 12-column (or equivalent) content  
- **Optical alignment** for icons next to text (not only mathematical center)  

---

## Writing supports visual hierarchy

Short labels: `Needs attention`, `Send reminder`—not paragraph button text.

---

## Brand restraint

Brand through logo, accent, typography—not gradients and motifs on every operational page. No glassmorphism, glowing borders, animated backgrounds on productivity surfaces.

**Operational transparency** (reminder times, sync state, slot diagnostics) should look **clean**, not flashy—that is premium for Transovo.

---

## The 90 rules (index)

### System and hierarchy (1–11)

1. Build a system, not pretty one-offs — tokens for type, space, color, radius, borders, elevation, heights, icons, motion, breakpoints, status  
2. Visual hierarchy obvious before reading — size, weight, spacing, contrast, position, grouping; premium = quieter  
3. One primary typeface family  
4. Fixed typography scale with named roles  
5. Weight communicates hierarchy — regular / medium / semibold  
6. Line height per text style  
7. Constrain prose line length (~50–75 chars)  
8. Left-align operational text  
9. Spacing scale (4px base), no random margins  
10. Spacing communicates relationship (Gestalt proximity)  
11. Consistent vertical rhythm  

### Surfaces and shape (12–16)

12. Don’t overuse cards  
13. Clear surface hierarchy (background → content → elevated → overlay)  
14. Borders before heavy shadows  
15. Standardized radius scale  
16. Pills for compact states/categories only  

### Color and accessibility (17–23)

17. Restrained color — neutrals dominate  
18. One accent with clear meaning  
19. Fixed semantic color meanings  
20. Never state with color alone  
21. WCAG contrast minimums  
22. No transparency shortcuts for text — use text tokens  
23. Dark mode = real theme tokens  

### Icons and controls (24–32)

24. Single icon family, consistent size/weight  
25. Icons support labels for unfamiliar concepts  
26. Strict button hierarchy (variants)  
27. One primary button per cluster  
28. Standardized component heights  
29. Usable touch targets (~44px)  
30. Designed focus states (WCAG 2.4.11+)  
31. Full interactive states per component  
32. Disabled needs explanation, not mystery  

### Forms and tables (33–38)

33. Consistent input anatomy (label, field, helper/error)  
34. Errors: color + marker + text  
35. Table density without cramping  
36. Number alignment and formatting  
37. One date/time formatting system  
38. Controlled status density in rows  

### Layout polish (39–51)

39. Whitespace before decorative separators  
40. Subtle, purposeful dividers  
41. Motion clarifies state change  
42. Standard animation timing + reduced motion  
43. Charts have their own visual system  
44. Charts only when they reveal patterns  
45. Data ink favors meaning  
46. Empty states intentional, not broken-looking  
47. Loading skeletons match geometry  
48. Avoid visual jumping  
49. Responsive spacing/type scale (not 70% shrink)  
50. Content width responds to task type  
51. Desktop layouts not overly airy  

### Navigation and language (52–55)

52. Navigation quieter than content  
53. Selected state unmistakable but restrained  
54. Consistent capitalization (sentence case)  
55. Concise UI writing  

### Craft details (56–70)

56. Icons aligned to text baseline  
57. Restrained in-app branding  
58. Premium ≠ gradients everywhere  
59. Decorative effects never compete with data  
60. Consistency beats novelty — reuse components  
61. Documented component variants  
62. Semantic design tokens  
63. Accessibility part of visual design  
64. Errors win hierarchy over decoration  
65. Don’t make every healthy status loud  
66. Page density reflects frequency  
67. Explicit medium-density target  
68. Visual emphasis budget  
69. Alignment as design tool  
70. Optical alignment where needed  

### Grid, surfaces, responsive (71–81)

71. Macro layout grid  
72. Forms: controlled max widths  
73. Tables: use available width  
74. Modal width matches complexity  
75. Standard drawer widths  
76. Sticky UI sparingly  
77. Tooltips supplementary only  
78. Truncation with recovery path  
79. Row hover/selected/focus distinct  
80. Design for real messy content  
81. Layout survives i18n / longer strings  

### Forms and feedback (82–90)

82. Visible labels, not placeholder-as-label  
83. Validation at the right time  
84. Success feedback proportional to consequence  
85. Red reserved for destructive/error  
86. Accent reserved for meaningful interaction  
87. Typography and spacing carry most of the design  
88. Calm despite powerful functionality  
89. Clean status treatment exposes product quality  
90. **Foundation spec before page redesign** (see Design System Foundation above)  

---

## Component checklist (before shipping any new component)

```markdown
### Component: [Name]
**Variants:** ______
**Sizes:** compact / default / large
**States:** default, hover, pressed, focus, selected, disabled, loading, error
**Tokens used:** (semantic only)
**Contrast checked:** Y/N
**Focus visible:** Y/N
**Touch target:** Y/N
**Reduced motion:** Y/N
**Reuses existing component:** Y/N (if no, justify)
```

---

## Quick reject triggers (visual)

- New font size or gray not from scale/tokens  
- New button style “because it looks good on this page”  
- Card nested in card in card  
- Heavy shadow on every panel  
- Status communicated by color dot only  
- Placeholder used as label  
- Red or accent used decoratively  
- Icon-only for unfamiliar feature  
- Focus outline removed with no replacement  
- Chart when a KPI number suffices  
- Giant hero typography on operational page  
- 8+ competing emphasized elements in one viewport  
- Modal used for long complex editor  
- Random drawer/modal width  

---

## Doc stack (full UI pipeline)

```
1. TRANSOVO-UI-DESIGN-GUIDE.md                    → IA, mental models, heuristics
2. TRANSOVO-PAGE-ARCHITECTURE-RULES.md            → Page structure and behavior
3. TRANSOVO-VISUAL-DESIGN-GUIDE.md                → Look, feel, tokens, components
4. TRANSOVO-ACCESSIBILITY-STANDARDS.md            → Guide #1: WCAG 2.2 AA
5. TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md    → Guide #2: ISO 9241 HCD
6. TRANSOVO-IA-NAVIGATION-STANDARDS.md            → Guide #3: IA & navigation
7. TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Guide #4: Interaction, keyboard & focus
8. TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md   → Guide #5: Forms & validation
9. TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md   → Guide #6: Responsive/reflow/zoom
10. TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md    → Guide #7: Tables & grids
11. TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Guide #8: Privacy/consent/compliance
12. TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Guide #9: Security & authentication
13. TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Guide #10: Date/time/timezone/locale
14. TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Guide #11: Internationalization & localization
15. Page-by-page spec                             → Per-screen worksheet
16. Implementation in Kimi / components           → Must satisfy all applicable guides
```

---

*This document is the authoritative visual design ruleset for Transovo. Design within the system; do not freestyle per page.*
