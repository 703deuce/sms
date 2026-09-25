# TRANSOVO PASS 2A — REPRESENTATIVE VISUAL PROOF REFINEMENT

**Branch:** `cursor/pass-2a-visual-refinement-2304`  
**Base:** Pass 2 (`cursor/pass-2-visual-foundation-2304`)  
**Stop gate:** Phase 3 **not** authorized.

---

## A. Root findings

| Issue | Cause | Layer | Change |
|-------|--------|-------|--------|
| KPI false zeros while table loading | `apiMetrics ?? { answered: 0, … }` while `loading === true` | **Page + shared KPI** | `CallsMetrics` accepts `null` metrics; `loading` shows skeletons; no numeric fallback |
| KPI trends during load | Same object used before fetch resolved | **Shared KPI** | Trends hidden while `loading`; only shown when comparison data present (`trendPct != null`) |
| Too many horizontal strips | Search, period, two tab rows each with full tab chrome | **Shared + page** | `transovo-operating-region` + operational toolbar; view tabs vs filter chips |
| Row A / Row B look identical | Both used `transovo-tab-link` | **Shared + page** | Row A = view tabs (`?attention=` queue); Row B = compact filter chips (client outcome filter) |
| KPI too “dashboard” | Four bordered cards with icon boxes | **Shared KPI** | Default `inline` summary bar (one border, dividers, no icons) |
| Table loading blank box | `TransovoPageLoading` in tbody | **Shared state** | `TransovoTableBodySkeleton` keeps header + skeleton rows |
| Excess canvas / padding | Pass 2 tokens + stacked margins | **Shared tokens** | Tighter page padding, `transovo-page-stack`, reduced table shadow |
| Shell “Loading call handling…” | `CallHandlingSwitcher` text-only loading | **Shared shell** | Pulse skeleton placeholder (no misleading copy) |
| Search a11y | Placeholder-only | **Page** | `sr-only` label + `id` association |
| Mobile table | Wide grid | **Page family** | Bounded `overflow-x: auto` on table shell; min-width grid; no card conversion |

### Voice Calls filter semantics (verified in code)

| Row | Control | State | Behavior |
|-----|---------|-------|----------|
| **A** | All calls / Needs attention | URL `attention=open` via `router.push` | Switches between main calls list and embedded `NeedsAttentionView` (operational **queue/view**) |
| **B** | All Calls, Leads, … | React `filter` (+ initial read from `?filter=` URL) | Client-side **outcome category** filter on loaded rows; chip `aria-pressed` |

Dimensions are **not merged**; presentation only differentiated.

---

## B. Files changed

- `src/styles/transovo-visual-foundation.css`
- `src/components/transovo/kpi-strip.tsx`
- `src/components/transovo/state-feedback.tsx`
- `src/components/transovo/operational-toolbar.tsx` (new)
- `src/components/calls/calls-metrics.tsx`
- `src/app/(app)/voice/calls/page.tsx`
- `src/components/call-handling/call-handling-switcher.tsx`
- `scripts/capture-pass-2-visual-proof.ts`
- `docs/TRANSOVO-PASS-2A-IMPLEMENTATION-REPORT.md`

---

## C. Shared primitives

| Primitive | Action |
|-----------|--------|
| `TransovoKpiStrip` | **Extended** — `variant: inline \| cards`, `loading`, `degraded`, skeletons |
| `TransovoTableBodySkeleton` | **Created** — table-region loading without blank card |
| `TransovoOperationalToolbar` | **Created** — thin layout wrapper (no duplicate filter logic) |
| Foundation CSS | **Extended** — operating region, view tabs, filter chips, inline KPI, tighter density |
| `CallHandlingSwitcher` loading | **Extended** — skeleton instead of text |

---

## D. Voice Calls

- **KPI loading:** Skeleton values; no `0` / `0s` until `apiMetrics` resolves.
- **KPI loaded zero:** Real `0` from API when `loading === false`.
- **KPI degraded:** If fetch completes without `analytics`, strip shows “Summary unavailable” (no fabricated numbers).
- **Toolbar:** Search + period in one `TransovoOperationalToolbar`.
- **Filter dimensions:** View tabs (queue) vs outcome chips (category).
- **Table loading:** Header + 8 skeleton rows.
- **Table prominence:** Flatter shell (no shadow), tighter row padding, operating block above table with single bottom rule.
- **Responsive:** Horizontal scroll within table shell at narrow widths (`transovo-data-table-scroll`); page does not overflow.
- **Search a11y:** Visible `sr-only` label.
- **Shell:** Call handling loading uses skeleton, not “Loading call handling…”.

---

## E. Other representative surfaces

| Surface | Pass 2A effect |
|---------|----------------|
| Missed Calls | Global token spacing only; no structural change |
| Consent | Shared canvas tokens; no workflow change |
| Receptionist | Tighter page container tokens via foundation |
| Inbox | Unchanged behavior; foundation tokens via shell |

No regressions observed in recapture; changes are predominantly Voice Calls + shared primitives.

---

## F. Screenshots

| Phase | Path |
|-------|------|
| Before | `/opt/cursor/artifacts/screenshots/pass-2-visual-proof/before/` |
| Pass 2 | `/opt/cursor/artifacts/screenshots/pass-2-visual-proof/pass-2/` (copied from first `after/`) |
| Pass 2A | `/opt/cursor/artifacts/screenshots/pass-2-visual-proof/pass-2a/` |
| Voice Calls loading | `pass-2a/03_voice_calls_desktop_loading.png` |
| Comparison index | `/opt/cursor/artifacts/screenshots/pass-2-visual-proof/index.html` |

---

## G. Behavior preservation

Confirmed unchanged: routes, IA, filter/pagination semantics, API contracts, Voice/MCTB runtime, entitlements, analytics definitions.

---

## H. Responsive

- Desktop: operating region composes toolbar + tabs + chips; table dominates.
- Mobile 390px: table scrolls inside shell; toolbar wraps; chips wrap.
- Risk: horizontal scroll requires user gesture — acceptable per deliberate strategy (table semantics preserved).

---

## I. Accessibility (targeted)

- Search: labeled.
- View tabs: `role="tablist"` / `tab` / `aria-selected`.
- Filter chips: `aria-pressed`.
- Table loading: `sr-only` message + skeleton `aria-hidden`.
- Pagination / row text actions: `aria-label` on prev/next and text caller.
- Full WCAG 2.2 AA: **not claimed**.

---

## J. Functional defects (parallel, unchanged)

1. AI Recovery — `b.filter is not a function`  
2. Voice Analytics — undefined `count`  
3. Unidentified Voice route failure  

---

## K. Remaining design-system questions

- Whether inline KPI should become the default on MCTB Overview/Analytics when those pages migrate (family decision).
- Whether outcome filter chips should sync to URL on every change (functional; out of visual pass scope).

---

## Recommendation

**REPRESENTATIVE PROOF READY FOR PRODUCT APPROVAL**

(Product review decides Phase 3 authorization.)
