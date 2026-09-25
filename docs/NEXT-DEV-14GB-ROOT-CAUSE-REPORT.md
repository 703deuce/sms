# Next.js dev ~14 GB RSS — root-cause investigation report

**Date:** 2026-09-25  
**Mode:** Measurement and import tracing only — **no product refactors, no repo split, no lazy-import fixes applied.**  
**Environment:** Cursor Cloud Agent VM, 15 GiB RAM, 0 swap, Node v22.14.0, Next 16.2.12 (`next dev --port 3000`, `DEV_AUTH_BYPASS=1`).

---

## Executive answer

**Why does `next dev` reach ~14.4 GB RSS?**

It is **not** explained by “489 routes at idle” or “Next is memory-hungry” alone.

On a **clean** `.next` (deleted once before this run):

| Phase | `next-server` RSS | What happened |
|--------|-------------------|---------------|
| After startup, no HTTP | **~367 MB** | Normal dev baseline |
| Idle 60s, no routes | **~329 MB** | No runaway global init |
| After `GET /api/health` | **~394 MB** | Health is cheap |
| After **first** `GET /mctb` (authenticated app shell + page) | **~5.6 GB** | **Primary step change** |
| After 5 more launch routes (MCTB + Voice) | **~7.0 GB** | Incremental compile + cache |
| After 3 **dormant** routes (appointments, campaigns, drip) | **~8.4 GB** | Each cold compile adds RSS + disk cache |

The historical **~14.4 GB** observation fits **the same mechanism extended**: more compiled routes over a long session, **Turbopack dev cache growth on disk** (prior VM state: **~44 GB under `.next/dev/cache/turbopack`** out of **~48 GB `.next`**), retained **anonymous memory** in the `next-server` process (~**99% of RSS is anonymous / V8+compiler**, not file-backed mappings), plus optional **extra child compile workers** — not a single mystery leak at idle.

**First boundary to fix (evidence-backed, Tier 1):** the **authenticated app graph** loaded on the first MCTB hit — especially **`(app)/layout.tsx` + `AppShell` + `Sidebar` client bundle** (nav for MCTB, Voice, SMS, Appointments, Smart Routing, Kimi sidebar, global CSS for mass-SMS/Kimi surfaces) — compiles a **very large shared client/server module graph** before MCTB-specific page code dominates.

**Not primary cause (this run):** instrumentation (`src/instrumentation.ts` is empty), global middleware alone (light TS imports), Prisma install size on disk (~74 MB package, not 7 GB RSS), CSS source size (~16 KB tracked globals + ~192 KB Kimi CSS tree — not GB-scale).

---

## Clean baseline procedure

- Stopped competing Next/Playwright/capture processes (none active at start).
- **`rm -rf .next`** once before measurement.
- **One** dev server: `DEV_AUTH_BYPASS=1 npm run dev --port 3000` (tmux `next-dev-memory-audit`).
- No Playwright, no `next build`, no parallel agents during checkpoints (except a separate **control** app on port 3001 for comparison only).

**Pre-clean `.next` attribution (same VM, earlier state):**

| Path | Size |
|------|------|
| `.next` total | ~48 GB |
| `.next/dev/cache` | ~44 GB |
| `.next/dev/cache/turbopack` | ~44 GB |
| `.next/dev/server` | ~4.4 GB |

After this audit’s **six launch routes + three probes**, cache regrew to **~3.9 GB turbopack** + **~497 MB server** artifacts in **~4 minutes** — confirming **cache explosion is compile-driven**, not “idle time.”

---

## Memory growth curve (T0–T8 + probes)

**Metric:** RSS of PID matching `next-server (v16.2.12)` for port **3000** (parent `npm`/`node` wrappers are negligible).  
**Auth:** `GET /api/auth/dev-bypass?next=/mctb` then cookie jar for app routes.

| Checkpoint | Route(s) touched | `next-server` RSS (MB) | Δ vs prior | `.next` total (GB) | `.next/dev/cache` (GB) | Notes |
|------------|------------------|------------------------|------------|--------------------|-------------------------|--------|
| **T0** | none (≤8s after Ready) | **366.7** | — | 0.02 | 0.01 | No intentional HTTP |
| **T1** | idle 60s | **329.4** | −37 | 0.02 | 0.01 | No global 8–10 GB idle |
| **T2** | `/api/health` | **393.7** | +64 | 0.02 | 0.01 | |
| **T3** | `/mctb` | **5637.9** | **+5244** | **1.10** | **0.71** | **Largest single jump** |
| **T4** | `/mctb/missed-calls` | **6365.7** | +728 | 1.40 | 1.03 | |
| **T5** | `/mctb/ai-recovery` | **6614.8** | +249 | 1.83 | 1.49 | |
| **T6** | `/voice/overview` | **6958.1** | +343 | 2.29 | 1.98 | |
| **T7** | `/voice/calls` | **6741.2** | −217 | 2.67 | 2.40 | RSS dip (GC / cache pressure) |
| **T8** | `/voice/receptionist` | **6959.7** | +219 | 3.18 | 2.93 | |
| Probe A | `/appointments/calendar` | **7363.7** | +404 | — | 3.47 | Dormant product |
| Probe B | `/campaigns` | **7668.4** | +305 | — | 3.58 | Mass SMS |
| Probe C | `/automations/drip-campaigns` | **8416.8** | +748 | — | 4.06 | |

**Compile times (order of magnitude):** first `/mctb` ~10s wall; subsequent routes ~3–10s each (curl + server compile).

**Extrapolation to ~14.4 GB:** continuing to cold-hit heavy routes (setup wizards, inbox, analytics, admin, Kimi-connected pages) in one session, **without** `rm -rf .next`, aligns with **10–15 GB RSS** observed in prior agent runs. Route **count at rest** does not; **cumulative compilation + retention** does.

Helper script used: `scripts/next-dev-memory-audit.sh` (checkpoint labels logged above).

---

## Memory composition (not “all V8 heap”)

For `next-server` at **~7.1 GB RSS** (`/proc/.../smaps_rollup`):

| Category | Evidence |
|----------|----------|
| **Anonymous (heap + native compiler)** | **~6.98 GB Pss_Anon** (~98% of RSS) |
| **File-backed** | **~90 MB Pss_File** |
| **Swap** | 0 (no swap on VM — OOM kill risk) |

Child processes under `next-server` (compile workers, e.g. `.next/dev/build/*.js`) added **~200–300 MB RSS** combined — **not** where the multi-GB lives.

**Implication:** `--max-old-space-size=4096` only caps **V8 heap**; it does **not** cap Turbopack/SWC/native anonymous allocations that dominate RSS. Treat `NODE_OPTIONS` as **diagnostic**, not a fix (not fully re-run here to avoid destabilizing the audit mid-report).

---

## HMR retention test

After T8, three harmless edits to `src/components/mctb/shell/mctb-design-tokens.css` (restored via `git checkout`):

| Step | `next-server` RSS (MB) | `.next` cache (GB) |
|------|------------------------|---------------------|
| Before HMR | 6668.7 | 2.93 |
| After edit 1–3 | 6654.8–6664.2 | 2.94–2.96 (+~30 MB) |

**Conclusion:** **No meaningful RSS leak from three HMR cycles** in this test. **Disk cache** still grows slightly per edit. The **14 GB** problem is **not primarily HMR**; it is **large initial compiles + retained compiler/module memory + turbopack cache accumulation**.

---

## Root import graph (what global paths load)

### Truly global (every HTML route)

- `src/app/layout.tsx` — fonts, `globals.css` only (light).
- **`src/app/globals.css`** — `@import "tailwindcss"` plus **many Kimi stylesheets** for **mass SMS / campaigns / contacts / automations / grow** (dormant products at launch), ~192 KB source tree under `src/styles/kimi` (small on disk; still part of global CSS graph).
- `src/instrumentation.ts` — **empty** `register()` (no backend boot).

### Authenticated app shell (every `(app)/*` page including `/mctb` and `/voice/*`)

**`src/app/(app)/layout.tsx` (server)** loads:

- Auth, workspace, entitlements, outcomes, voice agent id, MCTB try-it flags, maintenance.
- Renders **`AppShell`** with full product feature snapshot.

**`src/components/layout/app-shell.tsx` (client)** imports:

- Header, sidebar, mobile nav, product activity tracker.
- **Nav title resolvers for Voice, MCTB, SMS platform, Appointments, AI after-hours, Numbers.**
- MCTB shell CSS + **`transovo-visual-foundation.css`**.
- Kimi route detection (`isKimiIntegratedRoute`).

**`src/components/layout/sidebar.tsx` (client)** imports:

- `buildMctbShellNav`, `buildVoiceMobileNav`, `buildMassSmsMobileNav`, `buildSmsPlatformNav`, `buildRealtorNav`, `buildNumbersNav`, `buildAiAfterHoursNav`.
- **`buildSmartRoutingNavChildren`** (via `voice-nav.ts`).
- **`TransovoSidebar`** + **`map-nav`** from `@/components/kimi/sidebar/*`.
- Call-handling switcher, product shell switcher, appointments/MCTB route helpers.

**`src/lib/products/voice-nav.ts`** pulls Smart Routing nav children and SMS platform titles even when building MCTB nav.

**`src/middleware.ts`** — many **path guard** imports (voice routes, appointments redirect, platform launch flags, verify). Runs on edge of requests; not 7 GB alone, but part of server graph.

### MCTB page itself (after shell)

- `src/app/(app)/mctb/page.tsx` → `loadMctbOverview` + **`MctbOverviewView`** (client) → home sections, call-handling card, etc. — **incremental** vs shell cliff.

### Dormant product leakage (confirmed by probes, not theory)

Opening **`/appointments/calendar`**, **`/campaigns`**, **`/automations/drip-campaigns`** after launch routes **added ~1.5 GB RSS** and **~1 GB turbopack cache** without deleting any code — proof that **dev compiles dormant surfaces on demand** and **retains** memory.

**Nav registry (`v1-launch-nav.ts`):** metadata only; **does not** import page implementations. **Leakage is through shell/nav/CSS and per-route compilation**, not through nav flags alone.

---

## Barrel exports

No `export * from` barrels under `src/lib/products/**/index.ts` found in quick scan. **Barrel-style damage here is mostly “fat client nav + Kimi sidebar + global CSS imports,”** not a single `features/index.ts`.

---

## Server packages (`serverExternalPackages`)

`next.config.ts` externalizes bullmq, LiveKit, openai, ws, etc. for **webpack production bundling**.

- **`bullmq`:** direct imports in `src/lib/jobs/bullmq.ts`; **no** `from '@/lib/jobs/bullmq'` under `src/app` in ripgrep — workers not globally imported by Next app routes in this audit.
- **`@livekit/*`:** concentrated in `src/lib/telephony/provisioning/livekit/*` and some voice receptionist helpers — **not** imported from `src/app` directly; risk is **transitive import from API routes** when those routes are compiled, not idle startup.

**Voice worker boundary:** LiveKit runtime is **intended** as separate `voice-runtime/` process; **Next still compiles voice UI + telephony lib branches** when Voice/MCTB routes and shared shell pull them into the graph. **No rearchitecture performed.**

---

## BullMQ / jobs

No evidence that **starting** `next dev` imports BullMQ globally. Job code is **on-demand** when API routes that enqueue are compiled.

---

## Database / generated clients

- `@prisma/client` + `.prisma` **~74 MB on disk** — normal; not the RSS driver.
- No giant JSON manifests found at root import path in this pass.

---

## Global CSS (ruled out as 14 GB cause)

- `globals.css` + `product-theme.css` + `transovo-visual-foundation.css` ≈ **16 KB** source (+ Kimi imports listed above).
- **Does not explain GB RSS**; does mean **dormant product styling participates in global Tailwind/CSS pipeline** for every page.

---

## Route count experiment

**Skipped** invasive “hide 489 routes” experiment. **Reason:** would require temporary route relocation or build-time exclusion — risk of accidental commit and not needed given **T0≈330 MB** vs **T3≈5.6 GB** delta.

---

## Webpack / Next graph diagnostics

- Dev uses **Turbopack** cache under `.next/dev/cache/turbopack/v16.2.12` (`.sst` / `.meta` files; **100+ files** after short session).
- `next.config.ts` sets `experimental.webpackMemoryOptimizations: true` and `cpus: 1` — does **not** prevent multi-GB **per-route** dev compiles.
- Full **bundle analyzer** requires production build — **explicitly out of scope** for this pass.

---

## Dependency duplication

`npm ls next react --depth=0` at repo root: **single** `next` and `react` (no duplicate top-level versions flagged). Not treated as root cause.

---

## Control app comparison

**`/tmp/minimal-next-control`** — `create-next-app@16.2.12`, port **3001**, same Node.

| Condition | `next-server` RSS |
|-----------|-------------------|
| Transovo **T0** (no routes) | **~367 MB** |
| Transovo **T3** (`/mctb`) | **~5.6 GB** |
| Control after `GET /` | **~645 MB** |
| Transovo after **9** compiled app routes + probes | **~8.4 GB** |

**Interpretation:** Same Next/Node dev baseline is **hundreds of MB**, not 14 GB. **Transovo’s shared authenticated shell + first MCTB compile** moves the process into **multi-GB** territory; **more routes → 8–14 GB**.

Control app removed from product tree (`/tmp` only).

---

## Memory attribution model

| Contributor | Evidence | Approx. contribution | Confidence |
|-------------|----------|----------------------|------------|
| Base Next dev (Transovo, no HTTP) | T0–T1 | **~330–370 MB** | High |
| `/api/health` | T2 | **+~60 MB** | High |
| **Authenticated shell + first `/mctb` compile** | T2→T3 | **+~5.2 GB RSS**, **+~0.7 GB cache** | **High** |
| Additional launch routes (MCTB + Voice) | T3→T8 | **+~1.3 GB RSS**, **+~2.2 GB cache** | High |
| Dormant route probes | 3 URLs | **+~1.5 GB RSS**, **+~1.1 GB cache** | High |
| HMR (3 CSS edits) | T8 HMR | **~0 MB RSS**, **+~30 MB cache** | Medium |
| Turbopack disk cache (long session / no clean) | pre-audit 48 GB `.next` | **Up to ~44 GB disk**; correlates with compile volume | High |
| Native/compiler anonymous memory | smaps_rollup | **~98% of RSS** | High |
| Idle route discovery alone | T0–T1 flat | **Not significant** | High |
| Orphan Playwright / second `next dev` | prior VM forensics | Can add **GB + connection failures** (ops, not app code) | High |

---

## Ranked fixes (do not implement in this pass)

### Tier 1 — low risk, high return (fix boundaries first)

1. **Split shell nav from implementations** — sidebar/app-shell should import **lightweight nav config** only; defer `TransovoSidebar`, Smart Routing builders, SMS platform nav, appointments nav modules behind **dynamic import** or route-segment-specific layouts for MCTB-only dev (metadata-only registries).
2. **Stop global Kimi/mass-SMS CSS in `globals.css`** — move campaign/inbox/grow imports to **route-level CSS** for those products (keep files, change import sites).
3. **Dev hygiene** — one `next dev`, `rm -rf .next` when cache > N GB; **never** parallel `next build` on same workspace.
4. **Document “launch dev profile”** — env flag that uses a **minimal layout** for local work (diagnostic/layout fork, not delete products).

### Tier 2 — moderate structural

1. **Lazy `dynamic()`** for heavy client sections (Kimi-connected pages, campaign builder shells, appointment calendar).
2. **Segment layouts** — `/mctb/*` layout that does not import Voice/SMS nav builders (and vice versa).
3. **Periodic turbopack cache prune** script in `dev:clean` (already removes all `.next`).

### Tier 3 — architectural (only if Tier 1–2 insufficient)

1. Separate Next apps or packages for Mass SMS / Appointments admin.
2. Dedicated voice-runtime-only repo boundary (already partial).

**Conservative expectation:** Fixing **shell + global CSS boundaries** should move **first meaningful page load** from **~5.6 GB toward ~1–2 GB** (control app is ~645 MB with trivial page; Transovo will remain heavier due to Prisma/auth/shell data). **14 GB** should drop materially if developers **do not cold-compile dozens of dormant routes** and **cache is pruned** — exact ceiling needs re-measure after Tier 1.

---

## Investigation constraints honored

- No MCTB/Voice/IA/runtime/product behavior changes.
- No lazy-import refactors, no repo split, no `next build`, no full Playwright capture.
- HMR test changes **reverted**.
- Persistent artifacts: this report + `scripts/next-dev-memory-audit.sh`.

---

## STOP

**Do not implement optimizations until this evidence is reviewed.**  
Next pass: implement **first proven boundary** (likely **app shell / sidebar / global CSS**), re-run **T0–T3** table, compare RSS.
