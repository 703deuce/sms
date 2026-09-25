# Next dev memory — Pass 2: boundary isolation (diagnostic)

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-14GB-ROOT-CAUSE-REPORT.md`, `docs/NEXT-DEV-MEMORY-PASS-1-SHELL-ISOLATION.md`  
**Pass 1 result:** Shell nav isolation reduced T3 by only **~2.6%** (~147 MB).  
**This pass:** Controlled probes — **no product refactors**, temporary routes **removed** after measurement.

---

## Executive conclusion

**The ~5 GB T2→T3 cliff is dominated by the authenticated `(app)` shell, not the MCTB overview page.**

| Probe | What compiles | `next-server` RSS after probe | Δ vs P2 (~415 MB) | `.next` total | Turbopack cache |
|--------|----------------|------------------------------|-------------------|---------------|-----------------|
| **P2** | `GET /api/health` | **~415 MB** | — | ~25 MB | ~19 MB |
| **Shell** | `(app)/layout` + `AppShell` + empty page | **4035.8 MB** | **~+3.6 GB** | **~1.15 GB** | **~714 MB** |
| **MCTB client** | Shell + `MctbOverviewView` (`initialData={null}`), **no loader** | **3799.2 MB** | **~+3.4 GB** | **~1.15 GB** | **~717 MB** |
| **MCTB server** | Shell + `loadMctbOverview()` only, **no view** | **5115.4 MB** | **~+4.7 GB** | **~1.22 GB** | **~749 MB** |
| **Real `/mctb`** | Shell + loader + view (production path) | **5062.2 MB** | **~+4.6 GB** | **~1.22 GB** | **~751 MB** |

**Interpretation (CASE A + partial C):**

1. **First authenticated HTML route** (any page in `(app)/`) costs **~3.5–4.0 GB RSS** beyond health — almost entirely **`(app)/layout.tsx` server graph + `AppShell` / sidebar / mobile nav client graph**, not route-specific UI.
2. **MCTB overview adds ~0.5–1.1 GB** on top of the shell (loader graph is the larger MCTB-specific slice: server probe **5115 MB** vs shell **4036 MB** ≈ **+1.1 GB**; real `/mctb` **5062 MB** vs shell **4036 MB** ≈ **+1.0 GB**).
3. **`MctbOverviewView` client tree alone** (probe without loader) is **not** larger than the empty shell probe (~**3.8 GB** vs ~**4.0 GB**) — within run-to-run variance; **no evidence of a separate multi-GB client-only bomb** beyond what the shell already pulls in.

**Stop blaming MCTB overview imports as the primary monster.** Next correction pass should target **authenticated layout / AppShell shared graph** (Pass 3), with a **secondary** trim of **`loadMctbOverview` server import graph** (~1 GB increment).

---

## Method

- Script: `scripts/next-dev-memory-pass2-probe.sh <label> <path>`
- Per probe: kill dev → `rm -rf .next` → one `DEV_AUTH_BYPASS=1 next dev --port 3000` → P0 (post-ready) → P1 (idle 60s) → P2 (`/api/health`) → dev-bypass cookie → P3 (probe path).
- Metric: RSS of first `next-server` PID (same as Pass 1).
- Temporary routes (removed after run):
  - `/dev/memory-probe-shell` — empty `<p>`
  - `/dev/memory-probe-mctb-server` — `loadMctbOverview` + `"Loaded"`
  - `/dev/memory-probe-mctb-client` — `MctbOverviewView` only, `initialData={null}`

Note: paths under `__memory-probe` returned **404** on Next 16; probes used `/dev/memory-probe-*` instead.

---

## Pass 1 vs Pass 2 (real `/mctb`)

| | Baseline audit | After Pass 1 nav | Pass 2 (this run) |
|--|----------------|----------------|-------------------|
| T3 `/mctb` RSS | 5637.9 MB | 5490.9 MB | **5062.2 MB** |

Pass 2 number is same experiment family; variance across runs ±~500 MB is expected.

---

## Proven boundaries (ranked)

| Rank | Boundary | Evidence | Approx. contribution to T3 |
|------|-----------|----------|---------------------------|
| **1** | **`(app)/layout` + `AppShell` + shared authenticated client chrome** | Empty shell probe **4036 MB** with **no** MCTB/Voice/product page imports | **~3.5–4.0 GB** of T2→T3 |
| **2** | **`loadMctbOverview` server module graph** | Server probe **5115 MB** vs shell **4036 MB** | **~+1.0 GB** when loader runs |
| **3** | Shell nav product extended modules (Pass 1) | Nav isolation | **~0.15 GB** |
| **4** | `MctbOverviewView` incremental over shell | Client probe ≈ shell probe (within noise) | **not dominant** |

---

## Import chains (read-only, not exhaustive)

### Authenticated shell (suspect #1)

```
src/app/(app)/layout.tsx (server)
  → getSession, getActiveWorkspaceId, loadShellData, loadWorkspace
  → getUserProductAccess, getWorkspaceProductFeatures
  → loadOutcomeInstances, loadPrimaryVoiceAgentId, getMaintenanceState
  → shouldShowTryItNav, loadShellData …
  → <AppShell …> (client)
      → Sidebar, MobileNav, Header, ProductActivityTracker
      → mctb-nav-only path (Pass 1) + TransovoSidebar (Kimi)
      → product-shell-tabs, call-handling-switcher
      → lib/nav.ts (large shared nav primitives)
```

First compile of **any** `(app)` page pulls this entire unit.

### MCTB server loader (suspect #2)

```
src/lib/mctb/overview.ts (server-only)
  → loadMissedCallTextConfig, prisma, overview-kpis, onboarding, telnyx sync
  → compliance-helpers, workspace-data, missed-call-text-back save
  → lead-recovery config/policy/scenarios, ai-booking readiness
  → inbound-handling line-config/router
  … (broad MCTB runtime surface for one read model)
```

Runs on real `/mctb` and server probe; **not** on shell-only probe.

### MCTB client view

```
src/components/mctb/overview-view.tsx ("use client")
  → mctb/home/mctb-home-sections (many section components)
  → call-handling-switcher card
```

Does **not** explain a cliff **beyond** shell alone in isolation probes.

---

## Turbopack cache correlation

| Probe | Cache after P3 |
|--------|----------------|
| Shell empty | ~714 MB |
| MCTB client | ~717 MB |
| MCTB server | ~749 MB |
| Real `/mctb` | ~751 MB |

Cache tracks **first authenticated compile size**, not a separate 48 GB mechanism in these clean runs. Long-session **44 GB** pathology remains **accumulated compiles** without `rm -rf .next` (Pass 0 audit).

---

## Turbopack vs webpack dev

**Skipped:** no supported alternate dev bundler flag was enabled without changing committed `package.json` / Next config. Pass 3 may add **one** diagnostic `next dev --webpack` comparison if Next 16 documents it for this repo.

---

## Proposed corrections (do not implement in Pass 2)

### Tier A — authenticated shell (~4 GB target)

- Binary-split **`(app)/layout.tsx`** server data loading (which `Promise.all` fan-out dominates compile/retain).
- Binary-split **`AppShell` / `Sidebar` / `Header`** client imports (halving strategy from user spec).
- Defer or split **Kimi `TransovoSidebar`** vs legacy sidebar if both graphs compile on every auth page.

### Tier B — MCTB overview loader (~1 GB target)

- Narrow **`loadMctbOverview`** to a minimal read-model module; break imports from full MCTB runtime / lead-recovery / ai-booking / telnyx sync where not needed for overview KPIs.
- Audit **server-only** boundary: ensure client never imports `overview.ts` or barrels that re-export it.

### Not recommended yet

- Dynamic-import entire MCTB overview.
- Route-group split `(mctb)` before shell Pass 3 halving.
- Production build / bundle analyzer.

---

## Pass 3 next step (when approved)

**CASE A path:** Diagnostic halves on `(app)/layout` and `AppShell` only — measure P3 with layout stubbed to minimal server props, then restore and halve client shell children.

**Do not** start MCTB view binary isolation until shell RSS for empty probe is **materially below ~2 GB** or shell halves identify a single import chain.

---

## Artifacts retained

- `scripts/next-dev-memory-pass2-probe.sh`
- `scripts/next-dev-memory-audit.sh`

Temporary probe **pages removed** from `src/app/(app)/dev/` before commit.

---

## STOP

Pass 2 complete. No further optimization in this pass.
