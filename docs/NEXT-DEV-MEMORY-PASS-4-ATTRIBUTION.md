# Next dev memory — Pass 4: attribution-only (shared ~3 GB floor)

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-MEMORY-PASS-3-SERVER-VS-CLIENT.md`  
**Mode:** **Measure only.** No `loadShellData` extraction, no outcomes restructuring, no AppShell cleanup. Revert temporary probe routes/layout wiring before merge.

---

## Governing question

**What is the first boundary that, when added from a clean `.next`, moves RSS from ~400–600 MB into ~3 GB — and when removed, moves it back?**

Correlation (“first probe that shows ~3 GB”) is **not** enough. Pass 4 requires **A/B causality** from clean `.next` each time.

---

## Context from Pass 3

| Observation | Implication |
|-------------|-------------|
| Probe B ~3.4 GB with only `getSession` + AppShell | ~3 GB floor without layout server loaders |
| Real+Real ≈ Probe A | Server and client paths **overlap** heavily in Turbopack |
| Half A vs Probe B ~540 MB | **Weak** evidence to blame `loadShellData` alone |
| Probe B ~3.4 GB RSS, ~19 MB cache | **RSS ≠ disk cache** |

---

## Measurement discipline

- `rm -rf .next` **per probe** (mandatory for causality runs)
- One `DEV_AUTH_BYPASS=1 next dev --port 3000`
- P2: `GET /api/health` RSS
- P3: dev-bypass + probe URL RSS
- Script: `scripts/next-dev-memory-pass4-probe.sh <label> <probe-id> <path>`
- Record: P2, P3, Δ, compile ms; cache optional (secondary)

---

## “Module requested” vs “import-only” (do not tree-shake)

A **static import** that never uses the symbol may be dropped or handled differently in Turbopack.

**Required pattern for module-requested (not executed) probes:**

```ts
const mod = await import("@/lib/workspace-data");
void mod;
```

**Execution probe (same route, otherwise identical):**

```ts
const mod = await import("@/lib/workspace-data");
await mod.loadShellData(userId, workspaceId);
```

Apply the same rule to `@/components/layout/app-shell`, `@/lib/outcomes/registry`, etc.

---

## Route / layout hierarchy

```
ROOT (app/layout.tsx — fonts, globals.css, html/body)
│
├── Base: /dev/memory-pass4-base  (outside `(app)`)
│
└── (app)
    │
    ├── MEMORY_PASS4_PROBE set → memory-pass4-layout.tsx ONLY
    │   (zero imports from app-layout-production / pipeline / AppShell / product-theme)
    │
    └── MEMORY_PASS4_PROBE unset → dynamic import app-layout-production.tsx
        │
        └── /dev/memory-pass4-probe  (trivial <p>)
```

### Segment probe (highest priority)

`(app)/layout.tsx` is a **thin wrapper** with **no** static imports of:

- `app-layout-production`, pipeline, AppShell, `product-theme.css`, ServiceWorkerRegister, or auth helpers.

When `MEMORY_PASS4_PROBE=segment`, only:

```tsx
<main data-pass4="segment">{children}</main>
```

**Fork:**

| Segment P3 RSS | Next step |
|----------------|-----------|
| **~400–800 MB** | `(app)` segment is **not** the cliff. Run ladder: auth → appshell-module → … |
| **~3 GB+** | **Stop loader ladder.** Floor exists **before** workspace-data/outcomes. Run **root-layout control** (below). |

---

## Root-layout control (if Segment ≈ 3 GB+)

Compare:

| Control | Path | Parent chain |
|---------|------|----------------|
| **Public trivial** | `/dev/memory-pass4-base` | `app/layout.tsx` only |
| **(app) trivial** | `/dev/memory-pass4-probe` + `MEMORY_PASS4_PROBE=segment` | `app/layout.tsx` → trivial `(app)/layout` |

**Document explicitly:** both inherit the same root (`Geist`, `globals.css`, `BRAND_NAME` metadata). Only the second enters the `(app)` route group.

If public stays ~400 MB and `(app)+trivial` ≈ 3 GB → isolate **segment / compiler boundary**, not individual loaders.

If public **also** ≈ 3 GB → fix the control (middleware, accidental `(app)` wrap, wrong URL) before concluding.

---

## Probe ladder

| ID | `MEMORY_PASS4_PROBE` | Path | Action on P3 |
|----|----------------------|------|----------------|
| **base** | *(unset)* | `/dev/memory-pass4-base` | Trivial `<p>`, no `(app)` layout |
| **segment** | `segment` | `/dev/memory-pass4-probe` | Trivial layout only |
| **auth** | `auth` | same | `getSession()` only |
| **appshell-module** | `appshell-module` | same | `import()` app-shell, `void mod`, no render |
| **appshell-render** | `appshell-render` | same | Render AppShell + fixtures |
| **workspace-data-module** | `workspace-data-module` | same | `import()` workspace-data, `void mod` |
| **workspace-data-execute** | `workspace-data-execute` | same | `import()` + `loadShellData()` |
| **outcomes-registry-module** | `outcomes-registry-module` | same | `import()` registry, `void mod` |
| **outcomes-execute** | `outcomes-execute` | same | `import()` + `loadOutcomeInstances()` |

**Do not run workspace-data / outcomes ladder if Segment ≈ 3 GB+** (cannot explain the original cliff).

---

## Causality standard (after a cliff candidate)

Example ladder observation:

| Probe | P3 RSS |
|-------|--------|
| segment | 510 MB |
| auth | 620 MB |
| appshell-module | **3180 MB** ← apparent cliff |
| appshell-render | 3400 MB |

**Do not optimize AppShell yet.** Re-run from clean `.next`:

1. `segment` (no AppShell module) → expect ~500 MB
2. `appshell-module` (module requested) → expect ~3.2 GB

Same for `workspace-data-module` vs `auth`/`segment`, or `outcomes-registry-module`.

**Culprit** = smallest boundary whose **removal** drops the cliff and whose **addition** restores it.

---

## Import vs execution interpretation

| module requested | execute | Conclusion |
|------------------|---------|------------|
| ~3.7 GB | ~3.9 GB | Module graph dominates |
| ~0.8 GB | ~3.9 GB | Investigate runtime / dynamic imports inside loader |

---

## Authorized work

- Temporary probe pages, `memory-pass4-layout.tsx`, thin `(app)/layout.tsx` wrapper
- `app-layout-production.tsx` (production graph isolated for uncontaminated segment probes)
- Measurement script + `docs/NEXT-DEV-MEMORY-PASS-4-RESULTS.md`

**Not authorized:** extracting `loadShellData`, outcomes splits, AppShell child optimization, `loadMctbOverview` work.

---

## STOP condition

Stop when one boundary passes **causality A/B** (on/off from clean `.next`), with **module-requested** probes where applicable.

Document **one** proposed correction boundary only. No Pass 5 implementation without review.

---

## Revert before merge

Remove: probe pages, `memory-pass4-layout.tsx`, Pass 4 env wiring; restore `(app)/layout.tsx` to direct production imports (or keep production module + static layout if zero behavioral change and team agrees).

Retain: scripts, Pass 4 spec, results doc.
