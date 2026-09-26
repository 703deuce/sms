# Next dev memory — Pass 5 results (framework / segment)

**Date:** 2026-09-25  
**Spec:** `docs/NEXT-DEV-MEMORY-PASS-5-FRAMEWORK-SEGMENT.md`  
**Probe code reverted** after run; script retained.

---

## Executive conclusion

1. **Cliff 1 is not Transovo root chrome.** With **bare** root (`<html><body>` only — no fonts, `globals.css`, or `BRAND_NAME`), first public HTML page still hits **~2.22 GB** `next-server` RSS (Turbopack). Adding `globals.css` alone: **~2.17 GB** (within variance). **~+1.8 GB above health is largely “first App Router document” compile in this repo under Turbopack**, not dismissible as authenticated-app product code.

2. **Cliff 2 remains real.** Trivial `(app)` layout (`<main>` only) adds **~+1.0–1.2 GB** over public on comparable bare-root runs (e.g. bare public **2217** → bare segment **3373** MB). Nested product `layout.tsx` files are **not** on the probe path; production `(app)` imports were **not** used in segment mode.

3. **Turbopack vs webpack (one pair each):** Both bundlers show **multi-GB** first-hit cost. Webpack bare public **~2683 MB** vs Turbopack **~2217 MB**; webpack full segment **~2732 MB** vs Turbopack full segment **~3014 MB**. **Not** the “2.2 GB → 0.8 GB” pattern — application/route graph cost is **large under both**, with **no clear webpack win** on these probes.

4. **Process tree:** `next-server` holds most RSS; one **~240–250 MB** `node` child often appears on Turbopack segment probes. **Tree sum ≈ next-server + ~250–400 MB** — relative cliffs track `next-server`; do not equate tree sum with “total machine memory” without listing all children.

5. **No product refactor authorized.** Strong evidence **against** ripping Voice/MCTB/layout loaders to fix dev RSS cliffs 1–2.

---

## Cliff ladder (Turbopack, P3 `next-server` RSS MB)

| Stage | Probe | P2 health | P3 next-server | Δ P3−P2 |
|--------|--------|-----------|----------------|---------|
| Health | — | ~400 | — | — |
| Cliff 1 | bare + **public** | 400.1 | **2216.6** | **+1816** |
| Cliff 1 | globals + public | 415.5 | **2171.4** | **+1756** |
| Cliff 2 | bare + **segment** | 417.3 | **3373.4** | **+2956** |
| Cliff 2 | full + segment | 400.3 | **3014.3** | **+2614** |
| (Pass 4 ref) | full + segment | ~418 | ~3475 | ~+3057 |

Run-to-run variance **±300–500 MB** is expected.

---

## Turbopack vs webpack (P3 next-server MB)

| Probe | Turbopack | webpack |
|--------|-----------|---------|
| bare + public | **2216.6** | **2682.7** |
| full + segment | **3014.3** | **2732.0** |

Health P2 webpack idle **~542 MB** vs turbo **~400 MB** (higher webpack baseline after idle).

**Interpretation:** Cannot attribute cliffs primarily to “Turbopack amplification” alone — webpack still **~2.7 GB** on trivial pages. Turbo vs webpack **differs by probe** (public slightly lower on turbo; segment similar).

---

## Process tree (example: bare public P3)

| PID role | RSS MB |
|----------|--------|
| `next-server` | **2217** |
| `node` (child) | **241** |
| **Tree sum (script)** | **2530** |

Segment P3 (bare): next-server **3377**, extra node workers **~252 + ~81**, tree **~3779**.

---

## `(app)` filesystem inventory (Cliff 2)

| Artifact | Present on probe path? |
|----------|-------------------------|
| `(app)/layout.tsx` trivial segment only | Yes (probe) |
| `product-theme.css` / AppShell / pipeline | **No** (segment mode) |
| `loading/error/not-found/template` under `(app)` | **No** repo-wide |
| Parallel `@` routes | **No** |
| Nested `voice/mctb/.../layout.tsx` | **No** (not matched by `/dev/memory-pass5-app`) |
| `middleware.ts` + dev-bypass | Yes (same for public/segment) |
| `instrumentation.ts` | Empty register only |

Cliff 2 points to **`(app)` route-tree / compiler boundary** or shared first-hit graph, not production layout source.

---

## Proposed next step (documentation only)

- **Do not** extract `loadShellData` or optimize AppShell for these cliffs.
- Optional Pass 6: minimal repro outside Transovo (empty Next 16 app) vs this repo on **same** bare-public / bare-segment probes; or Next/Turbopack issue with route groups.
- Operational mitigations (unchanged): `rm -rf .next`, avoid long turbopack cache sessions, `dev:clean`.

---

## STOP

Pass 5 objectives met: bare-root A/B, segment inventory, webpack comparison, process-tree sample. **No Pass 6 implementation in this commit.**
