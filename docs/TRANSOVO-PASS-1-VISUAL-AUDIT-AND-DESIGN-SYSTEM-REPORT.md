# Transovo Pass 1 — Visual UI/UX audit + design-system specification

**Mode:** Read-only audit (no implementation)  
**Authority:** `docs/KIRSTEN-TRANSOVO-MASTER-VISUAL-AUDIT-AND-DESIGN-SYSTEM-SPEC.md`  
**Evidence:** Production captures (`/opt/cursor/artifacts/screenshots/visual-audit/`), repo UI (`src/components/`, `src/styles/`), Fonio references (`docs/KIRSTEN-VISUAL-AUDIT-REFERENCES/fonio/`)  
**Date:** 2026-09-25  
**Executor:** Cursor Cloud agent (Pass 1 deliverable for product review)

---

## A. Executive visual diagnosis

Transovo today reads as **three products wearing one shell**: (1) newer **MCTB operational + Setup** built on `MctbPageContainer`, `mctb-design-tokens.css`, and **RefDeco** patterns (`mctb-premium-patterns`); (2) **Voice** on shared `PageHeader` + `max-w-[1200px]` gray canvas with heavier **StatCard** KPI treatment; (3) **Inbox** on Kimi `src/styles/kimi/conversations.css` three-pane layout with its own density and chrome.

The result is not “unprofessional,” but it is **not one visual language**. Users feel context switches when moving MCTB Setup → Voice Calls → Conversations, even though the app shell (product switcher, sidebar) is shared.

**Target direction:** Mature, calm, **medium-density operational SaaS** — closer to the stronger MCTB Setup/Missed Calls family, with Voice operational pages brought down from “marketing dashboard” card scale, and Inbox reconciled to shared tokens without losing the master/detail workflow.

**Fonio lesson (§8A):** “Simpler” means **progressive disclosure** (capability list → focused panel/modal; list → transcript → metadata), not more whitespace or removing capability. Transovo Setup already hints at this (main column + contextual summary on Consent/Recovery); Voice Receptionist and some Setup/Test pages still **surface too much at once** (long explanatory copy + status + nested cards).

**Root cause of “complicated” feeling:** Presentation stacks configuration, status, help text, and secondary metrics on the first paint — not excess product scope.

---

## B. Existing-pattern inventory

| Pattern | Location | Verdict | Notes |
|---------|----------|---------|-------|
| `MctbPageContainer` + `mctb-design-tokens.css` | MCTB routes | **KEEP + CONSOLIDATE** | Canvas `#e8ebf0`, max-width `90rem`, consistent padding — promote to **Transovo operational canvas** for MCTB + shared ops pages |
| RefDeco (`ref-deco-patterns`, `MctbPageHeader`, sections, status badges) | MCTB Setup, detail, AI Recovery | **REFINE** | Strong hierarchy; reduce purple accent overuse; unify with global status semantics |
| `MctbSetupShell` + horizontal setup nav | `/mctb/setup/*` | **KEEP** | Clear local IA; visually distinct from product nav (good) |
| `PageHeader` (`src/components/ui/page-header.tsx`) | Voice, some app pages | **CONSOLIDATE** | `font-display text-2xl` — merge with RefDeco header into **one Transovo page header primitive** with variants |
| `StatCard` / large KPI cards | Voice Overview, Voice Calls | **REPLACE** (density) | Oversized vs MCTB analytics KPI strip; use **compact KPI row** pattern from MCTB Analytics |
| Kimi Inbox layout | `/conversations`, `/mctb/conversations` | **REFINE** | Preserve 3-pane; reskin borders, typography, badges to shared tokens |
| `Button` (`ui/button`) | Global | **KEEP** | `primary` uses theme primary (often reads purple); audit black custom classes (`mctb-setup-btn`) vs `Button` |
| Hardcoded hex in MCTB (`text-[#1b1e23]`, `#626872`) | AI Recovery, setup rows | **CONSOLIDATE** | Map to semantic text tokens |
| `reference.css` imports per feature | MCTB kimi-ui, appointments | **CONSOLIDATE** | Single `transovo-surfaces.css` entry importing token layers |
| Voice `VoiceSubNav` | Voice product | **KEEP** | Tab-like product nav — style to match Setup subnav weight, not global sidebar |
| Legacy `setup-overview-premium` / duplicate overview components | Repo | **RETIRE** after migration | Audit routes for single canonical view per page |

---

## C. Proposed Transovo design system (implementation spec)

### C.1 Color roles (semantic)

Build on existing CSS variables; **do not invent per-page hex.**

| Role | Use | Starting reference |
|------|-----|-------------------|
| `canvas` | Page background behind content | `--mctb-canvas` / `bg-background` |
| `surface-primary` | Main content panels | `bg-card` / white on canvas |
| `surface-secondary` | Insets, table zebra, side summaries | `bg-muted/30` |
| `border-subtle` | Dividers, table borders | `border-border` |
| `text-strong` | Titles, primary row labels | `text-foreground` |
| `text-default` | Body | `text-foreground` |
| `text-muted` | Secondary, meta, table sublines | `text-muted-foreground` |
| `action-primary` | One primary CTA per region | `Button` variant `primary` |
| `action-secondary` | Secondary | `outline` / `secondary` |
| `action-destructive` | Irreversible | `danger` / `destructive` |
| `state-success` | Verified, delivered (quiet) | RefDeco `ready` — **muted green dot + text**, not full green banners |
| `state-warning` | Needs attention | RefDeco `attention` — amber, always with label |
| `state-danger` | Failed, blocked | red text + icon, not neon |
| `state-info` | Informational | blue-gray, not saturated purple blocks |
| `focus-ring` | Keyboard | `ring-ring` existing |

**Rule:** Purple is **brand accent**, not default section accent on every Setup block. Limit purple to product chrome and **one** accent per page.

### C.2 Typography scale

| Token | Size / weight | Use |
|-------|----------------|-----|
| `type-page-title` | 24px / semibold (`font-display` or unified sans) | H1 — **one per page** |
| `type-page-desc` | 14px / regular, muted | Under title, max-width ~42rem |
| `type-section-title` | 15–16px / bold | Module headings (RefDeco section) |
| `type-section-desc` | 12.5–13px / regular, muted | Section helper |
| `type-body` | 14px / regular | Default copy |
| `type-body-sm` | 13px | Dense tables, setup rows |
| `type-label` | 13px / medium | Form labels |
| `type-helper` | 12px / muted | Hints |
| `type-eyebrow` | 11–12px / medium uppercase tracking-wide | Category labels (Setup groups) — **sparingly** |
| `type-metric-value` | 20–24px / semibold tabular | KPI numbers |
| `type-metric-label` | 12px / muted | KPI captions |
| `type-status` | 12px / medium | Badges |
| `type-table-header` | 12px / medium muted | `<th>` |
| `type-table-cell` | 13–14px | Primary cell |
| `type-table-meta` | 12px muted | Secondary column |

**Rule:** Ban ad-hoc `text-[15px] font-bold` outside tokens (migrate RefDeco to classes).

### C.3 Spacing scale (4px base)

`4, 8, 12, 16, 20, 24, 32, 40, 48` — map Tailwind `1–12`.

| Context | Token |
|---------|--------|
| Page padding | 24px desktop (`mctb-page-pad-*`), 16px mobile |
| Section gap | 24–32px between major sections |
| Card padding | 16–20px (setup), 12–16px (dense ops) |
| Form field gap | 12px label-to-control, 20px between fields |
| Table cell | 12px vertical, 16px horizontal |
| Inline controls | 8px gap |

### C.4 Radius & elevation

| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 6px | Inputs, small chips |
| `radius-md` | 8px (`rounded-lg`) | Buttons, cards |
| `radius-lg` | 12px | Modals, large panels only |
| `shadow-none` | default | Most surfaces |
| `shadow-sm` | dropdowns, sticky bars, modals |
| `shadow-md` | rare — popovers only |

**No** triple-nested rounded cards.

### C.5 Buttons

Canonical: `src/components/ui/button.tsx`.

| Variant | When |
|---------|------|
| `primary` | One main action per header or form footer |
| `outline` / `secondary` | Secondary actions |
| `ghost` | Tertiary, toolbar |
| `danger` | Delete, disable service |
| `icon` | Row actions with `aria-label` |

Heights: sm 32px, md 36px, lg 40px. **Retire** parallel `mctb-setup-btn` CSS where `Button` suffices.

### C.6 Forms

- Persistent labels above controls  
- Helper below; errors linked via `aria-describedby`  
- Selection cards (Consent, Recovery) — **one** pattern: bordered row, selected = border-primary + subtle bg, not double card stacks  
- Switches for binary toggles; radios for mutually exclusive modes  
- Save: section footer or sticky bar **only** when form is long (Receptionist); Setup sections use header save (existing `MctbSetupSectionLayout`)

### C.7 Status system

Unify `RefDecoStatusBadge` + `StatusPill` + ad-hoc pills into **`TransovoStatusBadge`**:

| Semantic | Visual | Copy examples |
|----------|--------|----------------|
| healthy-quiet | muted dot + text | Active, Ready, Verified |
| info | blue-gray | Configured, Managed |
| attention | amber + icon | Needs attention, Pending |
| success-event | green (sparse) | Delivered, Replied |
| suppressed | neutral + label | Suppressed (not failed) |
| danger | red + label | Failed, Opted out |

Never color-only.

### C.8 Tables & lists

Shared **`TransovoDataTable`** behaviors (semantic `<table>`):

- Header: sticky optional on wide ops views  
- Row height: 44–48px touch-friendly  
- Primary column: link to detail  
- Status: right or dedicated column — consistent placement  
- Actions: icon menu or single primary row action — no hover-only critical actions  
- Empty/loading: in-table region  

Missed Calls = reference implementation; Voice Calls migrates toward same row typography.

### C.9 Navigation levels

1. **App shell** — product switcher + global sidebar (darkest, fixed)  
2. **Product nav** — MCTB sidebar items / Voice subnav (medium emphasis)  
3. **Setup horizontal nav** — under Setup title (tabs style, smaller than product nav)  
4. **Page tabs** — Receptionist internal / Analytics range toggles (segmented control, not sidebar duplicate)  
5. **Contextual links** — text + chevron, muted  

### C.10 Empty / loading / error

| State | Pattern |
|-------|---------|
| Loading | Skeleton matching layout — **no false zeros** on KPIs |
| Empty | Illustration optional; **one** primary next action |
| Error | `role="alert"`, plain language, Retry — **never** raw exception text |
| Partial | Inline banner per failed region (Voice Overview already uses `errors` map — extend pattern) |
| Success | Quiet “Saved” with check — auto-fade optional |

---

## D. Layout archetypes

| Archetype | Max width | Pages |
|-----------|-----------|--------|
| **Operational wide** | `90rem` (`mctb-page-max`) | MCTB Overview, Missed Calls, Analytics, Voicemail list, Voice Calls |
| **Standard** | `72rem` (`max-w-6xl`) | MCTB Setup sections, Voice Overview (after KPI downgrade) |
| **Focused editor** | `48rem` (`max-w-3xl`) center or split | AI Recovery (current), parts of Consent |
| **Focused editor wide** | `90rem` two-column | Receptionist, Call Handling (main + preview/summary) |
| **Inbox specialized** | Full width minus panes | Conversations — list ~320px, thread flex, context ~300px collapsible |

Map Voice Analytics from `max-w-[1200px]` to **operational wide** token for alignment.

---

## E. Component consolidation map

| UI need | Current implementations | Canonical target | Migrate |
|---------|-------------------------|------------------|---------|
| Page header | `PageHeader`, `MctbPageHeader`, inline h1 | `TransovoPageHeader` (variants: standard, operational, setup) | All MCTB + Voice pages |
| Section block | `RefDecoSection`, random `div` cards | `TransovoSection` | Setup, Voice editors |
| Status | `RefDecoStatusBadge`, `StatusPill`, custom spans | `TransovoStatusBadge` | Ops tables, setup rows |
| KPI strip | MCTB analytics strip, Voice `StatCard` grid | `TransovoKpiStrip` (4 max) | Overview, Analytics, Voice |
| Setup row | Setup overview rows | `TransovoConfigRow` (name, summary, status, manage) | Setup overview |
| Option select | Consent/Recovery cards | `TransovoChoiceCard` | Consent, Recovery, sender mode |
| Data table | MCTB missed calls, Voice calls table | `TransovoTable` wrapper | Missed Calls, Calls, Voicemail |
| Save bar | `MctbSetupSectionLayout`, sticky footers | `TransovoFormFooter` | Setup, Receptionist |

---

## F. Page-by-page visual audit

Evidence paths: `visual-audit/mctb/*.png`, `visual-audit/voice/*.png` (refreshed 2026-09-25 where noted).

### MCTB operational

| Page | Works | Inconsistent / fix via system | Page-specific |
|------|-------|------------------------------|---------------|
| **Overview** | Canvas, compact sections | KPI treatment vs Voice; ensure quiet healthy state | Link density to Setup |
| **Missed Calls** | Density, filters, table | — | Row actions menu a11y names |
| **Inbox** (`/mctb/conversations`) | Thread workflow | Shell colors/fonts vs MCTB; three dimensions (§14) need clearer badges | MCTB context panel |
| **AI Recovery** | Focused width, toggles | Hex colors; error state if API fails | Booking link progressive block |
| **Voicemail** | List + detail pattern | Align player/transcript typography with Calls | — |
| **Analytics** | Funnel + KPI compactness | Chart colors vs Voice | — |

### MCTB Setup

| Page | Works | Inconsistent | Page-specific |
|------|-------|--------------|---------------|
| **Overview** | Grouping, health rows | — | — |
| **Phone & Forwarding** | Hierarchy, verification UX | Customer language (see G) | Number identity labels |
| **Consent** | Two-message preview, summary column | — | Press-1 locked copy presentation |
| **Text Back** | Template preview bubbles | `{{link}}` surfacing in UI | — |
| **Recovery** | Option cards + summary | — | — |
| **Voicemail** | Greeting editor separation | Ensure ops page doesn’t duplicate | — |
| **Notifications, Links, Exclusions, Test** | Setup shell | Test page dev language | Test = operational checklist tone |

### Voice

| Page | Works | Inconsistent | Page-specific |
|------|-------|--------------|---------------|
| **Overview** | Dependency rows idea | Large stat cards; gray page not canvas | — |
| **Calls** | Table data | KPI header scale; visual family drift | Master/detail opportunity (Fonio) |
| **Receptionist** | Editor depth | Purple/black button mix; long first paint | Progressive disclosure for advanced |
| **Business Knowledge** | Content structure | Separate hierarchy / spacing | — |
| **Call Handling** | Operational focus | Match Receptionist tokens | — |
| **Analytics** | Range toggle | Layout width; **runtime error risk** (J) | Outcome chart density |

### Shared

| Page | Notes |
|------|-------|
| **Conversations (global)** | Kimi CSS — consolidate shell; preserve panes |

**Fonio (principle only — see lock doc §3):** Where presentation stacks too much on first paint, *consider* progressive disclosure after workflow review. **Not** automatic drawers, accordions, capability-list/detail restructures, or table→card conversions.

---

## G. Customer-language audit

| Current (implementation-facing) | Suggested customer-facing | Location / notes |
|--------------------------------|---------------------------|------------------|
| “production ingress” | “Make sure missed calls reach Transovo” | `setup-test-view.tsx` |
| “Validates workspace routing…” | “Checks forwarding, consent, and text delivery” | same |
| “authoritative request form” | “Request form fields” | `setup-links-view.tsx` |
| “Same setting as onboarding” | Remove or “Matches your setup choices” | `mctb-recovery-goal-setup-section.tsx` |
| “live system compiles” | “Matches your published call handling” | `transfer-effective-status-card.tsx` |
| `{{link}}` in template preview | “Booking link” chip or resolved sample URL in preview only | Text Back editor |
| “PLATFORM” / “WORKSPACE” in UI | “Transovo-managed texting” / “Your messaging number” | sender settings |
| Expose Telnyx/Twilio | Hide in customer paths | Numbers, setup diagnostics |

**Compliance:** Press-1 disclosure, STOP/HELP, consent labels — **flag only**, do not rewrite in visual pass without legal review.

---

## H. Number-identity semantics (UI audit)

| Label (canonical) | Must bind to | Risk in UI |
|-------------------|--------------|------------|
| Business line | Customer public DID | Confused with forwarding destination |
| Forwarding destination | Ingress E.164 | Must not label as “business number” |
| Text-back sender | `smsPhoneNumberId` or platform sender resolver | Must not show ingress DID as sender when roles split |
| Platform managed sender | Identity #3 when `senderMode=PLATFORM` | ws_1 dual-role — UI must still **label role**, not imply one number = one concept globally |

**Action for implementation phase:** Audit `setup-phone-forwarding-view`, Numbers drawers, Test page, missed-call detail — report functional mismatches separately from visual work.

---

## I. Responsive strategy

| Family | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Operational tables | Full columns; filter bar wraps | Hide low-priority columns | Per-table strategy (scroll, stacked meta, expandable row, or list) — **not** default card-list (lock §11) |
| Setup | Two-column when summary column | Stack summary below | Single column; save in header |
| Inbox | Three panes | List + thread; context drawer | List ↔ thread full screen |
| Voice Receptionist | Split editor | Stack | Accordion sections |
| KPI strip | 4-column | 2×2 | 2×2 scroll optional |

Use existing `mctb-design-tokens.css` breakpoints; extend to global `transovo-layout.css`.

---

## J. Accessibility findings

| Issue | Severity | Remediation |
|-------|----------|-------------|
| Mixed heading levels (skipping h1) | Medium | One h1 per page via header primitive |
| Color-only status in some Voice pills | Medium | Add text/icon per status system |
| Table row actions | Medium | Visible focus, `aria-label` on icon buttons |
| Custom checkboxes (AI Recovery) | Low | Ensure focus ring visible |
| Error surfaces showing raw JS messages | **High** | Blocker — customer-safe error component |
| Touch targets &lt; 44px on dense rows | Medium | Increase row padding or hit area |
| Inbox pane keyboard order | Medium | Document tab order in Inbox polish |

Target: WCAG 2.2 AA per `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`.

---

## K. Functional blockers discovered (separate from visual)

| Area | Symptom | Likely boundary | Engineering before polish lock |
|------|---------|-----------------|--------------------------------|
| **AI Recovery** | `b.filter is not a function` (screenshot evidence) | **Trace first incorrect boundary** (persistence → API → client) — do not assume endpoint or add client guards without contract proof | Parallel engineering; blocks **certification** of this page only |
| **Voice Analytics** | `Cannot read properties of undefined (reading 'count')` | **Trace authoritative analytics contract** — likely `sentimentCounts` shape; avoid zero-fill if backend should supply data | Parallel engineering; blocks **certification** of this page only |
| **Voice route** | Full-page “couldn’t load” | Identify exact route + first failing data boundary | Parallel engineering; blocks **certification** of that page only |

**Do not** hide these with mock data or empty states in the visual phase.

---

## L. Proposed implementation sequence

**Superseded by product lock:** `docs/TRANSOVO-PASS-1-PRODUCT-REVIEW-AND-DESIGN-SYSTEM-LOCK.md` §17–18 (Phase 0–5, representative proof gate, controlled first pass).

Summary: shared foundation → **five representative pages** (side-by-side proof) → family migration → page-specific refinement → certification. Engineering §K fixes run **in parallel**; they block certification of affected pages only.

---

## §35. Implementation readiness verdict

### Original (Pass 1)

`NOT READY — FUNCTIONAL / ARCHITECTURAL BLOCKERS MUST BE RESOLVED FIRST`

### Corrected (product review 2026-09-25)

## **`READY FOR SHARED VISUAL-SYSTEM IMPLEMENTATION`**

**Parallel track:** **`PARALLEL ENGINEERING BLOCKERS FOR AFFECTED-PAGE COMPLETION`**

The three runtime defects in §K are real and must be traced to the first incorrect boundary (not patched speculatively). They do **not** block building shared tokens, primitives, or migrating unaffected pages. They **do** block final visual certification of AI Recovery, Voice Analytics, and the failing Voice route until fixed.

**Authoritative lock:** `docs/TRANSOVO-PASS-1-PRODUCT-REVIEW-AND-DESIGN-SYSTEM-LOCK.md`

---

## Appendix: Evidence index

| Asset | Path |
|-------|------|
| MCTB screenshots | `/opt/cursor/artifacts/screenshots/visual-audit/mctb/` |
| Voice screenshots | `/opt/cursor/artifacts/screenshots/visual-audit/voice/` |
| Fonio references | `docs/KIRSTEN-VISUAL-AUDIT-REFERENCES/fonio/` |
| MCTB tokens | `src/components/mctb/shell/mctb-design-tokens.css` |
| RefDeco patterns | `src/components/appointments/kimi-ui/shared/ref-deco-patterns.tsx` |
| Shared header | `src/components/ui/page-header.tsx` |
