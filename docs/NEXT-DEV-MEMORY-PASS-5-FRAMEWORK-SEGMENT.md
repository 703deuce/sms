# Next dev memory — Pass 5: framework / segment attribution

**Date:** 2026-09-25  
**Prerequisites:** `docs/NEXT-DEV-MEMORY-PASS-4-RESULTS.md`  
**Mode:** **Measure only.** No Transovo product-module refactors.

---

## Renamed problem

We are **not** asking: “Which Transovo module makes `(app)` huge?”

We **are** asking:

1. **Cliff 1:** Why does a trivial App Router HTML/RSC page cost **~+1.8 GB** above `/api/health` (~0.41 GB → ~2.21 GB on Pass 4 public Base)?
2. **Cliff 2:** Why does placing the same trivial page under **`(app)`** cost **~+1.26 GB** more (~2.21 GB → ~3.47 GB) when `(app)/layout` is trivial markup?

Pass 4 **falsified** blaming `workspace-data`, outcomes registry, AppShell, or `getSession` for the original ~3–4 GB floor.

---

## Three-stage model (Pass 4 evidence)

```
next dev + /api/health     ~0.41 GB
        │ first trivial HTML/RSC (dev-bypass + page)
        ▼
                         ~2.21 GB   ← Cliff 1 (not “authenticated app” only)
        │ enter trivial `(app)` segment
        ▼
                         ~3.47 GB   ← Cliff 2
        │ getSession
        ▼
                         ~3.66 GB
        │ request AppShell module (void mod)
        ▼
                         ~3.76 GB
```

Product architecture is **unlikely** to be the primary lever for the top two cliffs.

---

## Objectives (Pass 5 only)

### 1. Bare-root A/B (Cliff 1)

Temporary root layouts (no static production imports in `app/layout.tsx` wrapper):

| `MEMORY_PASS5_ROOT` | Adds |
|---------------------|------|
| `bare` | `<html><body>` only |
| `globals` | + `globals.css` |
| `jakarta` | + Plus Jakarta font |
| `geist` | + Geist Mono (production-like body classes) |
| `brand` | + `BRAND_NAME` metadata/viewport |
| `full` | `layout.production.tsx` (current production root) |

One clean `.next` per probe. Public page: `/dev/memory-pass5-public`.

**Fork:** If `bare` still ~2.2 GB → blame is largely **Next/Turbopack first-document compile**, not Transovo root deps. If `bare` ≪ 2 GB → restore pieces one at a time to find the step.

### 2. `(app)` filesystem boundary (Cliff 2)

**Inventory** (read-only before blaming layout implementation):

| Item | Under `src/app/(app)` |
|------|------------------------|
| `layout.tsx` | 1 segment layout (+ 14 nested product `layout.tsx` — **not** on `/dev/memory-pass5-app` unless matched) |
| `loading.tsx` / `error.tsx` / `not-found.tsx` / `template.tsx` | **None** in repo |
| Parallel routes `@*` | **None** |
| Route CSS | `product-theme.css` only on **production** `(app)/layout` (excluded when `MEMORY_PASS5_SEGMENT=1`) |
| Root | `app/layout.tsx`, `globals.css`, fonts, `middleware.ts`, empty `instrumentation.ts` |

Segment probe: `MEMORY_PASS5_SEGMENT=1` → `<main>{children}</main>` only; path `/dev/memory-pass5-app`.

If Cliff 2 persists, investigate **segment compiler boundary** and middleware/dev-bypass path — not old production layout source.

### 3. Turbopack vs webpack (one comparison each)

Next 16 supports `next dev --webpack` (see `next dev --help`).

Same probes from clean `.next`:

- **Public:** `full` root + `/dev/memory-pass5-public`
- **Segment:** `full` root + `MEMORY_PASS5_SEGMENT=1` + `/dev/memory-pass5-app`

Compare to default Turbopack (Pass 5 script `bundler` arg).

### 4. Process-tree RSS (verification)

Pass 1–4 used **first `next-server` PID** only. Pass 5 also records:

- `next-server` RSS
- **Sum RSS** of `next dev`, `next-server`, `turbopack`/`node` workers tied to `.next`

Relative cliffs should hold if both metrics move together; document if they diverge.

---

## Script

`scripts/next-dev-memory-pass5-probe.sh <label> <root-mode> <public|segment> [turbo|webpack]`

---

## Not authorized

- `loadShellData` / outcomes / AppShell extraction
- Production optimization
- Broad repo “memory fixes”

---

## Revert after measurement

Restore `app/layout.tsx` and `(app)/layout.tsx` to production; remove `pass5-probes/`, probe pages, `layout.production` split (or merge back). Retain spec + `docs/NEXT-DEV-MEMORY-PASS-5-RESULTS.md` + script.

---

## STOP

Stop after bare-root ladder + segment + webpack pair + process-tree note. Propose **one** next boundary with causality — no auto-implementation.
