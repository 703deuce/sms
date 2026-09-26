# Next dev memory — Pass 3: server layout vs client AppShell

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-MEMORY-PASS-2-BOUNDARY-ISOLATION.md`  
**Objective:** Split the ~3.6 GB authenticated-shell delta into **(app)/layout server graph** vs **AppShell client graph**. Diagnostic only — no optimizations shipped in this pass.

---

## Executive conclusion

**Dominant side: Server layout graph (primary), with a large shared floor from entering `(app)` + AppShell (secondary).**

| Interpretation | Verdict |
|----------------|---------|
| Result A (server-only ≈ 3–4 GB, client-only &lt; 1.5 GB) | **Partial** — server-only is ~4.2 GB, but client-only is **~3.4 GB**, not &lt; 1.5 GB |
| Result B (client-only ≈ 3–4 GB, server-only low) | **No** |
| Result C (both ~2–3 GB each) | **Yes** — both probes are multi-GB |
| Result D (both low, Real+Real high) | **No** |

**Key finding:** **Probe A (real server / minimal client) ≈ Pass 2 Real+Real (~4.15–4.19 GB).** Adding the real AppShell on top of the full server pipeline does **not** materially increase RSS beyond measurement noise. The **full `(app)/layout` server import/execute graph** is what you pay for on the first authenticated HTML route.

**Secondary finding:** **Probe B (minimal server / real AppShell) still reaches ~3.4 GB.** Shared authenticated chrome is expensive on its own; Pass 1 nav trimming did not remove that floor.

**Do not start Pass 4 optimizations in this branch without review.** Smallest high-value boundary to investigate next: **`loadShellData` via `src/lib/workspace-data.ts`** (Half A ≈ 3.94 GB) and **`loadOutcomeInstances` → `src/lib/outcomes/registry`** (Half B ≈ 3.61 GB) — both remain ~3–4 GB because Turbopack still compiles the `(app)` segment and overlapping shared modules on first auth hit.

---

## Core table

Probe path: `/dev/memory-probe-shell` (empty `<p>`, removed after run).  
Script: `scripts/next-dev-memory-pass3-probe.sh <label> <env> <path>`  
Env modes: `none` | `server-only` | `client-only`  
Per probe: clean `.next`, one `DEV_AUTH_BYPASS=1 next dev --port 3000`, P2 = `/api/health`, P3 = dev-bypass + probe path.  
Metric: RSS (MB) of first `next-server` PID.

| Probe | Server graph | Client shell | P2 health RSS | P3 RSS | Δ vs P2 | `.next` after P3 | Turbopack cache after P3 |
|--------|----------------|--------------|---------------|--------|---------|------------------|---------------------------|
| Health | minimal | none | ~402–411 MB | — | — | ~25 MB | ~19 MB |
| Pass 2 empty shell | REAL | REAL | ~415 MB | **4036 MB** | **~+3620 MB** | ~1.15 GB | ~714 MB |
| **Probe A** — real server / minimal client | REAL | `<main>` only | 405.4 MB | **4185.2 MB** | **~+3780 MB** | ~1.18 GB | ~748 MB |
| **Probe B** — minimal server / real AppShell | `getSession` only | REAL | 411.0 MB | **3397.9 MB** | **~+2987 MB** | ~454 MB | ~19 MB |
| **Real+Real** (Pass 3 rerun) | REAL | REAL | 402.3 MB | **4151.8 MB** | **~+3750 MB** | ~1.76 GB | ~1.32 GB |
| Server half A† | auth + maintenance + `loadShellData` + `loadWorkspace` | minimal | 418.0 MB | **3943.6 MB** | **~+3526 MB** | ~652 MB | ~215 MB |
| Server half B† | outcomes + voice agent + entitlements + try-it | minimal | 420.3 MB | **3607.8 MB** | **~+3188 MB** | ~1.15 GB | ~716 MB |

†Half A/B used temporary `memory-probe-half-*.ts` modules (removed after measurement). Layout probe env flags removed before merge.

**Compile time (P3 curl, ms):** Probe A ~23928 · Probe B ~12654 · Real+Real ~22631 · Half A ~16196 · Half B ~20389.

---

## Decision table (Pass 3)

| Probe A | Probe B | Conclusion |
|---------|---------|------------|
| **~4185 MB** | **~3398 MB** | **Server wins for the full authenticated page** (A ≈ Real+Real). **Both are substantial** — client-only is not negligible. |

---

## Binary isolation (server loaders)

Split of `runAppLayoutServerPipeline` imports (see `src/lib/shell/app-layout-server-pipeline.ts`):

**Half A — workspace / shell data**

- `getSession`, `getMaintenanceState`, `getActiveWorkspaceId`, `getActiveWorkspaceType`
- `loadShellData`, `loadWorkspace` (`@/lib/workspace-data`)

**Half B — products / outcomes / voice / MCTB try-it**

- `loadOutcomeInstances`, `loadPrimaryVoiceAgentId`, `getUserProductAccess`, `getWorkspaceProductFeatures`
- `shouldShowTryItNav`, `isAiAfterHoursEntitled`, `isActiveEntitlement`
- `loadWorkspace` (for try-it billing/custom fields only)

| Half | P3 RSS | vs full Probe A |
|------|--------|------------------|
| A | 3943.6 MB | −241 MB |
| B | 3607.8 MB | −577 MB |

Neither half drops to &lt;1.5 GB. **Both halves still pull multi-GB compile graphs** — consistent with a **wide shared `(app)` boundary** plus **fat modules in each half** (not a single loader name in isolation).

**Next binary split (Pass 4, not done here):** Within Half A, compare **`loadShellData` only** vs **`loadWorkspace` only** vs **auth/maintenance only** using separate probe modules with **no static import** of `workspace-data.ts` in the auth-only probe.

---

## Import chains (read-only trace)

### Server — `loadShellData` (suspect #1 for surgical split)

```
(app)/layout.tsx
  → runAppLayoutServerPipeline()
  → loadShellData() in src/lib/workspace-data.ts
      → static: @/lib/mappers, @/lib/contacts/visible-contacts,
                 @/lib/contacts/workspace-membership, getPrisma
      → runtime dynamic: @/lib/messaging/preferred-sending-number
      → loadDashboardMetrics, loadPhoneNumbers, loadInboxUnreadConversationCount
         (same file — campaign/contact/conversation mappers at module top)
```

`loadShellData` is a **small function** at the bottom of a **large module**; Turbopack compiles the **whole `workspace-data.ts` graph** when the layout imports `loadShellData`.

### Server — `loadOutcomeInstances` (suspect #2)

```
runAppLayoutServerPipeline()
  → loadOutcomeInstances() in src/lib/outcomes/instances.ts
      → @/lib/outcomes/registry
      → @/lib/solutions/appointment-receptionist/*
      → @/lib/agents/types
```

Same pattern as MCTB `loadMctbOverview` (+~1 GB in Pass 2): **metadata loaders living beside full product/runtime registries.**

### Client — AppShell (Probe B floor ~3.4 GB)

```
MEMORY_PROBE_CLIENT_ONLY layout branch
  → dynamic import @/components/layout/app-shell
      → Sidebar, Header, MobileNav, ProductActivityTracker, product switcher, …
```

Pass 1 already trimmed **nav resolution** imports; Probe B shows **~3 GB remains** in the shell component tree and its transitive client (and possibly shared) modules.

---

## Import vs execution

Not fully isolated in Pass 3 (would require import-without-`await` probes per loader). **Circumstantial evidence favors compile/import cost:**

1. Pass 1 reduced client nav work; T3 moved ~147 MB only.
2. Probe A matches Real+Real without rendering AppShell.
3. MCTB server-only loader added ~1 GB without the overview UI (Pass 2).
4. Half A/B RSS stays ~3.5–4 GB even when only half the loaders run.

---

## Cache correlation

| Probe | `.next` total after P3 | `dev/cache` after P3 |
|--------|------------------------|----------------------|
| Probe A | ~1.18 GB | ~748 MB |
| Probe B | ~454 MB | ~19 MB |
| Real+Real | ~1.76 GB | ~1.32 GB |
| Half A | ~652 MB | ~215 MB |
| Half B | ~1.15 GB | ~716 MB |

Full server + full client (Real+Real, Probe A) correlates with **large Turbopack cache growth**. Client-only Probe B keeps cache ~19 MB — server graph + first auth route drives most on-disk dev cache in this experiment.

---

## Proposed first correction (document only — not implemented)

**One boundary:** Extract **thin shell sidebar data loaders** out of `src/lib/workspace-data.ts` so `(app)/layout` does not statically import the workspace-data **kitchen-sink** module (campaigns, contacts, conversations, mappers) merely to populate header metrics and phone lists.

Secondary (after review): thin **`loadOutcomeInstancesForNav`** that does not import `outcomes/registry` solution trees.

Do **not** optimize `loadMctbOverview` in the same pass as layout — Pass 2 already isolated ~+1 GB for that route.

---

## Artifacts

- Logs: `/opt/cursor/artifacts/pass3-probe-a.log`, `pass3-probe-b.log`, `pass3-real-real.log`, `pass3-half-a.log`, `pass3-half-b.log`
- Retained: `scripts/next-dev-memory-pass3-probe.sh`, `src/lib/shell/app-layout-server-pipeline.ts` (layout refactor only — same runtime as inline master layout)
- Removed: probe env branches in `layout.tsx`, `/dev/memory-probe-shell`, `memory-probe-half-*.ts`

---

## Stop condition

Pass 3 answered the split question: **server layout graph is the primary reason Real+Real ≈ empty shell at ~4 GB; AppShell alone is still ~3.4 GB.** Halving server loaders did not isolate a single sub-100 MB culprit — next step is **deeper halving on `workspace-data` / `loadShellData`** and/or **AppShell child binary split (Section 8 of brief)** in Pass 4, with review before code changes.
