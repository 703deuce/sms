# Next dev memory — Pass 3: server layout vs client AppShell

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-MEMORY-PASS-2-BOUNDARY-ISOLATION.md`  
**Objective:** Split the ~3.6 GB authenticated-shell delta into **(app)/layout server graph** vs **AppShell client graph**. Diagnostic only — no optimizations shipped in this pass.  
**Next:** `docs/NEXT-DEV-MEMORY-PASS-4-ATTRIBUTION.md` (attribution-only; no authorized refactors yet).

---

## Executive conclusion (revised after review)

Pass 3’s main result is **not** “server wins, refactor `loadShellData`.” It is:

**Multiple different paths converge on a shared ~3 GB compile/memory floor, and server-only vs client-only costs overlap massively.**

### Anchor numbers (P3 RSS)

| Path | P3 RSS | Δ vs health (~0.41 GB) |
|------|--------|-------------------------|
| Health | — | baseline |
| **Client-only AppShell** (`getSession` + real AppShell) | **3.40 GB** | ~+3.0 GB |
| Server Half B + minimal client | **3.61 GB** | ~+3.2 GB |
| Server Half A + minimal client | **3.94 GB** | ~+3.5 GB |
| Full server + minimal client (Probe A) | **4.19 GB** | ~+3.8 GB |
| Full server + full client (Real+Real) | **4.15 GB** | ~+3.75 GB |

Half A (3.94 GB) is only **~540 MB** above Probe B (3.40 GB) despite running workspace/shell loaders that Probe B skips. Half B (3.61 GB) is only **~210 MB** above Probe B. **That is weak evidence that any single named loader (e.g. `loadShellData`) is “suspect #1.”**

### Non-additive overlap (most important)

If server and client graphs were mostly independent multi-GB compile trees, **Real+Real should be much larger than max(Probe A, Probe B).** It is not:

| Probe | P3 RSS |
|--------|--------|
| Server only (Probe A) | **4.185 GB** |
| Client only (Probe B) | **3.398 GB** |
| Both (Real+Real) | **4.152 GB** |

**Real+Real ≈ Probe A**, not Probe A + Probe B. Turbopack is compiling a **large shared subgraph** reachable from both the full server layout path and the AppShell path (and likely from the `(app)` segment boundary itself — **not yet proven**).

### What Pass 3 did **not** prove

- That **Sidebar/Header** uniquely own ~3 GB of client dependencies (Probe B could be pulling shared modules also reached from server probes).
- That **`loadShellData` / `workspace-data.ts`** is the dominant boundary (Half A vs Probe B gap is modest).
- That the **~3 GB floor** comes from the **`(app)` route segment** vs **root layouts/providers** vs **explicit probe imports** — needs Pass 4 **segment-only** and **import-only** probes.

### Pass 3 decision framing (updated)

| Original Pass 3 framing | Revised |
|-------------------------|---------|
| “Server layout dominates; target `loadShellData`” | **Shared ~3 GB floor + overlap**; do **not** authorize `loadShellData` extraction yet |
| “Server wins” | **Overlap phenomenon** — full server adds ~0.8 GB on top of the shared floor vs client-only, but both paths sit on ~3 GB |
| Cache growth implies server explains Probe B | **Rejected** — Probe B ~3.4 GB RSS with ~19 MB Turbopack cache; RSS and disk cache are not the same phenomenon |

---

## Core table (measurements unchanged)

Probe path: `/dev/memory-probe-shell` (empty `<p>`, removed after run).  
Script: `scripts/next-dev-memory-pass3-probe.sh` (layout probe env **reverted** after run).  
Per probe: clean `.next`, `DEV_AUTH_BYPASS=1 next dev --port 3000`, P2 = `/api/health`, P3 = dev-bypass + probe path.  
Metric: RSS (MB) of first `next-server` PID.

| Probe | Server graph | Client shell | P2 health RSS | P3 RSS | Δ vs P2 |
|--------|----------------|--------------|---------------|--------|---------|
| Health | minimal | none | ~402–411 MB | — | — |
| Pass 2 empty shell | REAL | REAL | ~415 MB | **4036 MB** | ~+3620 MB |
| **Probe A** — real server / minimal client | REAL | `<main>` only | 405.4 MB | **4185.2 MB** | ~+3780 MB |
| **Probe B** — minimal server / real AppShell | `getSession` only | REAL | 411.0 MB | **3397.9 MB** | ~+2987 MB |
| **Real+Real** (Pass 3 rerun) | REAL | REAL | 402.3 MB | **4151.8 MB** | ~+3750 MB |
| Server half A† | auth + maintenance + `loadShellData` + `loadWorkspace` | minimal | 418.0 MB | **3943.6 MB** | ~+3526 MB |
| Server half B† | outcomes + voice + entitlements + try-it | minimal | 420.3 MB | **3607.8 MB** | ~+3188 MB |

†Temporary half modules removed after measurement.

**Compile time (P3 curl, ms):** Probe A ~23928 · Probe B ~12654 · Real+Real ~22631 · Half A ~16196 · Half B ~20389.

---

## Binary halves (record only — not used for “suspect #1”)

Half A vs Half B did **not** isolate a single cheap loader group; both sit on the shared floor. **Further 50/50 splits are deprioritized** in favor of Pass 4’s import-vs-execution matrix (see Pass 4 doc).

---

## Reference import chains (hypotheses for Pass 4 — not proven)

These are **candidate boundaries** to test with **import-only** vs **execute** probes, not approved refactor targets:

- `(app)/layout` → `runAppLayoutServerPipeline()` → `@/lib/workspace-data` (`loadShellData`)
- Same pipeline → `loadOutcomeInstances` → `@/lib/outcomes/registry`
- Probe B path → `@/components/layout/app-shell` → Sidebar / Header / …

---

## Cache note (do not over-interpret)

| Probe | `.next` after P3 | `dev/cache` after P3 |
|--------|------------------|----------------------|
| Probe A | ~1.18 GB | ~748 MB |
| Probe B | ~454 MB | **~19 MB** |
| Real+Real | ~1.76 GB | ~1.32 GB |

Probe B reaches **~3.4 GB RSS** with **minimal** Turbopack cache growth. **Do not use cache size alone to argue that the server graph explains client-only RSS.**

---

## Proposed correction

**No correction authorized yet.**

First isolate the common **~3 GB authenticated compile floor** using **segment-only** and **import-vs-execution** probes (`docs/NEXT-DEV-MEMORY-PASS-4-ATTRIBUTION.md`).

Rationale: another “reasonable” refactor (e.g. thin `loadShellData`) could save **100–200 MB** while the **~3 GB shared bomb** stays hidden — same lesson as Pass 1.

Do **not** optimize AppShell children or `loadMctbOverview` in the same pass as floor attribution.

---

## Artifacts

- Logs: `/opt/cursor/artifacts/pass3-probe-a.log`, `pass3-probe-b.log`, `pass3-real-real.log`, `pass3-half-a.log`, `pass3-half-b.log`
- Retained: `scripts/next-dev-memory-pass3-probe.sh`, `src/lib/shell/app-layout-server-pipeline.ts` (layout refactor; same runtime as inline master layout)
- Removed: probe env branches in `layout.tsx`, `/dev/memory-probe-shell`, `memory-probe-half-*.ts`

---

## Stop condition (Pass 3)

Pass 3 answered the **server vs AppShell split** with overlap, not independence. **Pass 4** must answer: **what is the first import/boundary that moves RSS from ~400 MB into the ~3 GB range?**
