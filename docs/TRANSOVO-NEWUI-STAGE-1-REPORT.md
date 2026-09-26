# New UI → Production — Stage 0/1 completion report

**Branch:** `cursor/newui-shell-stage1-2304`  
**Scope:** Shell transplant only (Category **C** page bodies untouched).  
**Governing rule:** **Change the boundary, not the component.**

Stage **2** not started (per authorization).

---

## Stage 0

| Item | Status |
|------|--------|
| Baseline from `origin/master` with `newui/` sandbox on disk | Done |
| No deletion of legacy AppShell, Kimi sidebar, or page implementations | Done |
| Implementation strategy + audit docs | `docs/TRANSOVO-NEWUI-IMPLEMENTATION-STRATEGY.md`, `docs/TRANSOVO-NEWUI-PRODUCTION-INTEGRATION-AUDIT.md` |

---

## Files copied from `newui/` → `src/newui-transplant/`

| `newui/` source | Production copy |
|-----------------|-----------------|
| `components/app/app-sidebar.tsx` | `src/newui-transplant/components/app/app-sidebar.tsx` |
| `components/app/topbar.tsx` | `src/newui-transplant/components/app/topbar.tsx` |
| `components/app/kit.tsx` | `src/newui-transplant/components/app/kit.tsx` |
| `lib/nav.ts` | `src/newui-transplant/lib/nav.ts` |
| `hooks/use-mobile.ts` | `src/newui-transplant/hooks/use-mobile.ts` |
| `components/ui/sidebar.tsx` | `src/newui-transplant/components/ui/sidebar.tsx` |
| `components/ui/button.tsx` | `src/newui-transplant/components/ui/button.tsx` |
| `components/ui/separator.tsx` | `src/newui-transplant/components/ui/separator.tsx` |
| `components/ui/skeleton.tsx` | `src/newui-transplant/components/ui/skeleton.tsx` |
| `components/ui/avatar.tsx` | `src/newui-transplant/components/ui/avatar.tsx` |
| `components/ui/sheet.tsx` | `src/newui-transplant/components/ui/sheet.tsx` |
| `components/ui/tooltip.tsx` | `src/newui-transplant/components/ui/tooltip.tsx` |
| `components/ui/input.tsx` | `src/newui-transplant/components/ui/input.tsx` |

`newui/` was **not** modified.

---

## Source-diff summary (`newui/` vs `src/newui-transplant/`)

| File | Identical? | Why differences exist |
|------|------------|------------------------|
| `kit.tsx` | Yes | — |
| `lib/nav.ts` | Yes | — |
| `hooks/use-mobile.ts` | Yes | — |
| `button`, `separator`, `skeleton`, `avatar`, `tooltip`, `input` | Yes | — |
| `ui/sheet.tsx` | Import path only | `@/components/ui/button` → `@/newui-transplant/components/ui/button` |
| `ui/sidebar.tsx` | Import paths only | Internal imports → `@/newui-transplant/...` |
| `app/topbar.tsx` | Boundary refactor | Removed mock `NAV` / `sectionFor` / hardcoded `JR` / always-on notification dot; accepts `section`, `page`, `userInitials`, `unreadNotifications`, `searchDisabled` from production shell |
| `app/app-sidebar.tsx` | Boundary refactor | Removed `NAV`, `BUSINESS` mock; accepts `sections`, `homeHref`, `workspaceControl`, `footer` from production |

**Presentation DOM** for sidebar nav items, topbar chrome, and UI primitives is unchanged aside from the boundary slots above.

---

## Production files added or modified (integration only)

| File | Role |
|------|------|
| `src/components/newui-shell/newui-transplant-shell-layout.tsx` | Wires transplanted sidebar/topbar; production nav, home href, workspace/credits footer |
| `src/lib/newui-transplant/production-nav-sections.ts` | Thin adapter: `NavItem[]` → `NavSection[]`; breadcrumb helper |
| `src/lib/products/newui-shell.ts` | `shouldUseNewUiShell()` + `NEXT_PUBLIC_NEWUI_SHELL=0` |
| `src/styles/newui-shell-tokens.css` | Shell token scope under `[data-newui-shell]` |
| `src/components/layout/app-shell.tsx` | Early return: transplanted shell vs legacy Kimi/Header path |
| `src/components/layout/sidebar.tsx` | Removed dead `shellVariant === "newui"` branch (shell no longer embedded in legacy Sidebar) |
| `src/app/(app)/layout.tsx` | Imports `newui-shell-tokens.css` (already present) |
| `package.json` | `@base-ui/react` (required by transplanted sidebar/sheet) |
| `tsconfig.json` | Exclude sandbox `newui/` from app compile |

**Removed (reinterpreted shell — not Opus code):**  
`newui-app-sidebar.tsx`, `newui-topbar.tsx`, `page-kit.tsx`, `group-nav-items.ts`, `newui-shell-breadcrumb.ts`

---

## Adapters introduced

| Adapter | Responsibility |
|---------|----------------|
| `productionNavToNewUiSections()` | Map production sidebar `NavItem[]` to newui `NavSection[]` (labels, hrefs, badges) |
| `newUiBreadcrumbFromSections()` | Derive breadcrumb section/page from production nav + `pageTitle` |
| `NewUiTransplantShellLayout` props | Pass real `userName`, notifications, credits, workspace controls — **not** a second frontend |

No telephony, compliance, entitlements, or provider logic in adapters.

---

## Real shell data connected

| UI slot | Production source |
|---------|-------------------|
| Nav sections | `resolveProductSidebarNav()` → adapter → `AppSidebar` |
| Logo home link | Existing product shell home helpers (`mctbShellHome`, etc.) |
| Workspace control | `CallHandlingSwitcher` (with provider), `ProductShellSwitcher`, or `WorkspaceSwitcher` |
| Footer | Message credits from `shell.metrics.creditsRemaining` when numeric |
| Topbar user | `initialsForName(userName)` |
| Notifications | `unreadNotifications` from shell data |
| Breadcrumb | Production nav + page title |

Mock `BUSINESS`, `NAV` from `newui/lib/data`, and fake AI minutes footer removed from **runtime shell path**.

---

## Old shell path retained

When `shouldUseNewUiShell()` is false (realtor, launcher, automations full-bleed, `/app/*`, or kill switch), `app-shell.tsx` uses the **existing** `Sidebar` + `Header` + Kimi path unchanged.

---

## Rollback flag

`NEXT_PUBLIC_NEWUI_SHELL=0` → `isNewUiShellEnabled()` returns false → `shouldUseNewUiShell()` always false → legacy shell.

Verified in report run via Node (see validation log below).

---

## Call-handling read architecture

| Concern | Implementation |
|---------|----------------|
| Single read | `loadCallHandlingOwnershipState()` once in `src/app/(app)/layout.tsx` when switcher eligible |
| Context | `CallHandlingProvider` wraps new shell (and legacy path when switcher shown) with `callHandlingInitial` |
| No duplicate GET on nav | `CallHandlingSwitcher` in transplant shell uses `requireProvider` — skips client `GET /api/call-handling` on mount |
| Category C pages | Unchanged; no opportunistic restyle |

Provider reconciliation / Telnyx writes: **not** added to ordinary navigation (unchanged from production rules).

---

## Static validation (low-RAM)

| Check | Result |
|-------|--------|
| Grep mock `@/lib/data` in `src/newui-transplant/` | None in code (README mentions only) |
| Grep reinterpreted shell components | None remaining |
| ESLint `newui-transplant-shell-layout`, `production-nav-sections` | Pass |
| ESLint `app-shell.tsx` | Pre-existing `set-state-in-effect` on sidebar collapse (not introduced by transplant) |

---

## Runtime validation (one controlled session)

See **Validation run** section appended at commit time in git or CI notes — single `next dev`, memory sampled before/after, sequential `curl` to representative routes only.

---

## Blockers

None for Stage 1 shell. Stage 2 blocked until this report is accepted.

---

## Next: Stage 2

Follow audit route matrix only; per route transplant **page + New UI dependency graph**; one batched runtime session per organizational batch.
