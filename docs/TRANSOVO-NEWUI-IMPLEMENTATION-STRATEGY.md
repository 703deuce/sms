# TRANSOVO — New UI → Production Implementation Strategy

**Authority:** Product directive — **exact-code transplant**, not visual recreation.  
**Inventory:** `docs/TRANSOVO-NEWUI-PRODUCTION-INTEGRATION-AUDIT.md` (route map only; execution follows this doc).

---

## Governing sentence

**Change the boundary, not the component.**

`newui/` is the **implementation source** for every page/component Opus built. Production `src/` is the **functionality source**. Cursor connects them; it does not redesign.

---

## Exact-code transplant model

| Before (newui) | After (production) |
|----------------|-------------------|
| NewUI component → mock / local state / fake save | **Same** NewUI component → adapter → real loader/API/mutation |

**Forbidden:**

- Redesign, reinterpret, approximate, or “recreate from screenshots”
- Second implementation of the same component
- “Use newui as reference” with production/Kimi components
- Replacing `calls-browser.tsx` with the old production calls page

**Allowed integration edits only:**

- Import paths (`@/newui-transplant/...`)
- Props / adapters (`productionDto → toNewUiShape()`)
- Replace mock data imports with real data passed in
- Wire mutations to existing APIs (no fake `setTimeout` saves)
- Session, workspace, entitlements from production shell

**Preserve without technical reason:** DOM structure, layout, spacing, typography, composition, tokens, interaction presentation.

**Production home for transplanted files:** `src/newui-transplant/` (copied from `newui/`; `newui/` kept as reference until certification).

---

## Route categories (unchanged)

| Cat | Rule |
|-----|------|
| **A** | newui code exists → transplant + wire real data/writes |
| **B** | newui incomplete → transplant + add missing production behavior in **same** newui visual language; old UI reachable until certified |
| **C** | no newui page → **keep** production page; render inside new shell only |

Do not delete old production UI until replacement is certified.

---

## Stages

| Stage | Scope |
|-------|--------|
| **0** | Baseline branch, `newui/` on disk, no deletion of legacy UI |
| **1** | Transplant shell: tokens + `newui-transplant` sidebar/topbar/layout + real session/workspace/nav/credits; `NEXT_PUBLIC_NEWUI_SHELL=0` rollback |
| **2** | 25 routes — transplant each **page file** from `newui/app`, wire loaders/APIs per matrix |
| **3** | Category B gap completion |
| **4** | Batched browser certification (functionality-first) |
| **5** | Deploy via Coolify after certification |

---

## Low-RAM validation (mandatory)

**Do not:** repeated `pnpm dev`, full builds per change, parallel Next servers, continuous screenshots, or restart memory investigations.

**Do during implementation:**

1. Source inspection and git diff  
2. Targeted ESLint on touched files  
3. `tsc` where cheap (exclude sandbox `newui/` from app compile)  
4. Grep: `@/lib/data`, `setTimeout` fake saves, duplicate components, provider calls on GET paths  
5. Contract/adapters review  

**Runtime:** one batched session per major batch (shell, voice reads, MCTB ops). Representative routes only — not all 25 during dev.

**Screenshots:** optional, single session, stop if memory pressure — not a per-commit deliverable.

**Full `next build`:** checkpoint + Coolify deploy path only.

---

## Shell (Stage 1)

- `shouldUseNewUiShell()` + `NEXT_PUBLIC_NEWUI_SHELL=0`
- `src/newui-transplant/components/app/app-sidebar.tsx` — from `newui` (boundary: `sections`, `workspaceControl`, `footer` props)
- `src/newui-transplant/components/app/topbar.tsx` — from `newui` (boundary: real initials, notifications, breadcrumb)
- `NewUiTransplantShellLayout` — production nav → `productionNavToNewUiSections()` only
- Category **C** bodies unchanged inside shell

## Call handling

- Single `CallHandlingProvider` from layout read state  
- Switcher `requireProvider` — no shell GET `/api/call-handling`  
- No Telnyx reconciliation on ordinary navigation  

---

## Success criteria

**Where newui exists:** the **actual transplanted newui code** runs with real production behavior behind it — not “looks similar.”

**Where newui does not exist:** legacy production page works inside the new shell.

---

## Stage 2 batches (exact page transplant)

Port **page files** from `newui/app/**` into production routes; wire only data/mutation boundaries.

| Batch | Routes (examples) | Runtime validation |
|-------|-------------------|--------------------|
| Voice read surfaces | overview, calls, call detail, analytics | One session after batch |
| MCTB operational | overview, missed calls, detail, voicemail, analytics | One session after batch |
| Voice setup / config | setup sections, receptionist, knowledge, call handling | One session after batch |
| MCTB setup | setup sections per audit matrix | One session after batch |

**Representative visual smoke (Stage 4, not per-commit):** one Voice list, one Voice config page, one MCTB operational, one MCTB setup, one Category C page in shell.

---

## Rollback

`NEXT_PUBLIC_NEWUI_SHELL=0` disables the transplanted shell immediately; legacy sidebar/header path in `app-shell.tsx` remains until certification and removal.
