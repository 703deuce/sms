# Next dev memory — Pass 4 results (attribution)

**Date:** 2026-09-25  
**Spec:** `docs/NEXT-DEV-MEMORY-PASS-4-ATTRIBUTION.md`  
**Mode:** Measurement only. Temporary probe code **reverted** after this run (see git).

---

## Executive conclusion

1. **Trivial `(app)` layout (Segment) already reaches ~3.47 GB RSS** — with **zero** production layout imports (no pipeline, AppShell, `product-theme.css`, or auth helpers in the layout file). **Do not** attribute the ~3 GB floor to `loadShellData` or `outcomes/registry` without a new experiment — those probes were **skipped** per Pass 4 fork rules.

2. **Requesting the AppShell module (`void mod`) is not the primary cliff** in this pass: Segment ~3474 MB → appshell-module ~3759 MB (**~+285 MB** only). Causality A/B between `segment` and `appshell-module` does **not** show a ~400 MB → ~3 GB step; the large step is **earlier**.

3. **Base (outside `(app)`) is not ~400 MB on first P3 hit** — it reached **~2.21 GB**. Root-layout control shows both public Base and `(app)` Segment inherit `app/layout.tsx` (fonts + `globals.css`). **Entering `(app)` with trivial layout adds ~+1.26 GB** over Base on comparable runs, but **first authenticated HTML navigation after health adds ~+1.8 GB** even without `(app)`.

4. **Dominant phenomenon for Pass 4:** **`(app)` route-segment / first authenticated page compile boundary** (plus shared root-level first-hit cost), **not** a single named loader or AppShell module request.

**No correction authorized.** Next review should decide whether to investigate Next/Turbopack `(app)` segment compilation, parent RSC boundaries, and “first document request after dev-bypass” before any `loadShellData` or AppShell extraction.

---

## Ladder table

| Probe | Path | P2 health (MB) | P3 RSS (MB) | Δ P3−P2 | P3 compile (ms) | Cache after P3 |
|--------|------|----------------|-------------|---------|-----------------|----------------|
| **base** | `/dev/memory-pass4-base` | 411.2 | **2209.4** | **+1798** | 3982 | ~285 MB |
| **segment** | `/dev/memory-pass4-probe` | 418.0 | **3474.5** | **+3057** | 13645 | ~19 MB |
| **auth** | same | 415.6 | **3656.7** | **+3241** | 17632 | ~285 MB |
| **appshell-module** | same (`void mod`) | 402.9 | **3759.3** | **+3356** | 17641 | ~285 MB |

**Skipped (Segment ≥ 3 GB):** `workspace-data-module`, `workspace-data-execute`, `outcomes-registry-module`, `outcomes-execute`, `appshell-render`.

---

## Root-layout control

| Route | Layout chain | P3 RSS |
|--------|----------------|--------|
| `/dev/memory-pass4-base` | `app/layout.tsx` only | **2209 MB** |
| `/dev/memory-pass4-probe` + `MEMORY_PASS4_PROBE=segment` | `app/layout.tsx` → trivial `(app)/layout` (`<main>{children}</main>`) | **3475 MB** |

**Shared root:** `app/layout.tsx` — `Plus_Jakarta_Sans`, `Geist_Mono`, `globals.css`, `BRAND_NAME` metadata. No `(app)` layout on Base.

**Interpretation:** The **~3 GB** phenomenon appears on the **Segment** path without production `(app)` imports. Base is **not** a clean ~400 MB control for “first page” — document as **first HTML hit after dev-bypass** compiles a large shared graph (~2.2 GB) before `(app)`-specific cost (~+1.3 GB vs Base).

---

## Causality checks (clean `.next` each)

| Without boundary | With boundary | Δ P3 |
|------------------|---------------|------|
| `segment` (no AppShell module) | `appshell-module` | **+285 MB** |
| `segment` | `auth` (`getSession` only) | **+182 MB** |

**Does not meet** the strict “~400 MB ↔ ~3 GB toggle” for AppShell module request. **Segment alone** already sits at ~3.47 GB.

---

## Module-requested probe method

Used `const mod = await import("…"); void mod;` in `memory-pass4-layout.tsx` (reverted). No static unused imports.

---

## Implementation (reverted after run)

- Thin `(app)/layout.tsx` → `memory-pass4-layout.tsx` or `app-layout-production.tsx`
- Probes: `scripts/next-dev-memory-pass4-probe.sh`
- Logs: `/opt/cursor/artifacts/pass4-*.log`

---

## Proposed first correction (documentation only)

**Not authorized:** `loadShellData` extract, outcomes split, AppShell child cleanup.

**For review:** Instrument or escalate **Next 16 / Turbopack `(app)` segment first-compile** and **first authenticated document request** (dev-bypass + RSC) before product-module surgery. Optional: one webpack dev comparison on **segment** probe only (Pass 4 optional section).

---

## STOP

Pass 4 attribution complete. Smallest boundary that **clearly** toggles ~400 MB ↔ ~3 GB with A/B was **not** found among AppShell module / auth / workspace loaders — **trivial `(app)` entry already at ~3.5 GB**. Do not auto-start Pass 5 refactors.
