# Next dev memory — Pass 4: attribution-only (shared ~3 GB floor)

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-MEMORY-PASS-3-SERVER-VS-CLIENT.md`  
**Mode:** **Measure only.** No production refactors. Revert all temporary probe routes/layouts before merge.

---

## Governing question

**What is the first individual import or boundary that takes RSS from ~400 MB (health) into the ~3 GB range?**

Not: “which big group (server vs client) is more expensive?” — Pass 3 showed those groups **overlap**.

---

## Context from Pass 3

| Observation | Implication |
|-------------|-------------|
| Probe B ~3.4 GB with only `getSession` + AppShell | ~3 GB floor exists **without** layout server loaders |
| Half A ~3.94 GB, Half B ~3.61 GB | Broad halves stay on the same floor; weak single-loader attribution |
| Real+Real ~4.15 GB ≈ Probe A ~4.19 GB | **Massive shared compile graph** between server and client paths |
| Probe B ~3.4 GB RSS, ~19 MB Turbopack cache | **RSS ≠ disk cache**; do not infer server graph from cache alone |

---

## Baseline discipline

- Clean `rm -rf .next` **per probe**
- One `DEV_AUTH_BYPASS=1 next dev --port 3000`
- P2: `GET /api/health` RSS
- P3: dev-bypass cookie + probe URL RSS
- Same VM, same Node, same Next — no `npm run build`, no Playwright marathons
- Record: P2 RSS, P3 RSS, Δ, P3 compile ms, `.next` total (optional), cache bytes (optional — **secondary**)

---

## Probe matrix (single-boundary ladder)

Build from **smallest authenticated surface** upward. Each row is **one** controlled increment.

| ID | Probe | What must happen on first P3 hit |
|----|--------|----------------------------------|
| **Base** | Page **outside** `(app)` | Trivial `<p>` only — control that health + public route stay ~400 MB |
| **Segment** | Empty page **inside** `(app)` with **trivial layout** | No real `(app)/layout.tsx` server pipeline, no AppShell — proves whether **route group / segment** alone creates multi-GB floor |
| **Auth** | `getSession` only inside `(app)` | Session boundary only |
| **AppShell import-only** | `import` AppShell module (or dynamic import) **without rendering** | Compile graph for shell **module** only |
| **AppShell render** | Render real AppShell with fixture props (Pass 3 Probe B pattern) | ~3.4 GB reference |
| **workspace-data import-only** | `import "@/lib/workspace-data"` (or side-effect import) **no** `loadShellData()` | Import vs execution |
| **loadShellData execute** | Import + `await loadShellData(...)` | If import-only ≈ execute → graph is module boundary; if execute ≫ import → trace dynamic/runtime loads |
| **outcomes registry import-only** | `import "@/lib/outcomes/registry"` **no** loader call | Same pattern |
| **outcomes execute** | `import` + `loadOutcomeInstances(workspaceId)` | Same pattern |

### Critical: import-only probes

Use a dedicated server file per probe so the layout/route **only** pulls that one boundary (no static import of full pipeline).

Example interpretation:

| import-only | execute | Conclusion |
|-------------|---------|------------|
| ~3.7 GB | ~3.9 GB | **Module graph** dominates; SQL/runtime execution is not the story |
| ~0.8 GB | ~3.9 GB | Theory wrong for import — investigate **execution** and dynamic `import()` inside loader |

### Segment probe (highest priority if unproven)

Pass 3 claimed a “wide `(app)` boundary” but did **not** isolate:

- `(app)` **route segment** compile scope
- **Root** `layout.tsx` / providers above `(app)`
- **Explicit** imports in real `(app)/layout.tsx`

**Segment** probe: temporary `(app)/layout.tsx` that is literally `{children}` (or `<main>{children}</main>`), no `product-theme.css`, no pipeline, no AppShell — page is empty `<p>`.

If Segment alone → ~3+ GB: **stop halving individual loaders**; investigate Next/Turbopack segment + parent layouts/providers.

If Segment → ~400–800 MB: floor comes from **real layout imports**; run import-only matrix on those imports.

---

## Implementation notes (temporary only)

1. Prefer **dedicated routes** under `/dev/memory-pass4-*` (removed after run).
2. Use **dynamic `import()`** in layout branches keyed by `MEMORY_PASS4_PROBE=<id>` so unrelated modules are not statically linked in that probe’s layout variant.
3. **Do not** commit probe branches as permanent env flags in production layout.
4. Optional script: `scripts/next-dev-memory-pass4-probe.sh` mirroring Pass 2/3 harness.
5. After all probes: **revert** layout/route changes; keep script + this doc + results doc.

---

## Decision after Pass 4

| First boundary that jumps to ~3 GB | Next action (still measure-first until one chain proven) |
|-----------------------------------|----------------------------------------------------------|
| `(app)` segment trivial layout | Parent layouts, providers, Next config — not `loadShellData` |
| `workspace-data` import-only | Extract **leaf** read module; prove with re-probe |
| `outcomes/registry` import-only | Split nav metadata from runtime registrations |
| AppShell import-only | Descend AppShell import tree with same import-only ladder |
| None of the above; only full Real+Real | Interaction / shared modules / Turbopack duplication (Result D) |

**Do not** authorize AppShell child optimization until AppShell **import-only** vs **render** separates compile from tree cost.

**Do not** optimize `loadMctbOverview` until `(app)` floor is attributed (~+1 GB is a **separate** second cliff after shell floor).

---

## Required report (after Pass 4 runs)

Create or update: `docs/NEXT-DEV-MEMORY-PASS-4-RESULTS.md`

Include:

- Ladder table: Base → … → each probe RSS and Δ vs P2
- **First step into ~3 GB range** (single boundary name)
- Import vs execution table for workspace-data and outcomes
- Segment vs real layout comparison
- Dominant phenomenon: segment / shared module / specific import / interaction
- **One** proposed correction boundary (documentation only unless explicitly approved)
- STOP — no Pass 5 auto-implementation

---

## Optional (after one expensive graph is named)

One clean `next dev --help` check for an official alternate dev bundler; **one** diagnostic comparison on the **proven** probe only. Do not switch production bundlers.

---

## STOP condition

Stop when the **smallest practical import or segment boundary** that explains the jump into the ~3 GB floor is identified with import-only evidence.

Do not implement broad optimizations in Pass 4.
