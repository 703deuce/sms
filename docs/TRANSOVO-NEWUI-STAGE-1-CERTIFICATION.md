# New UI Stage 1 — runtime & call-handling certification

**Branch:** `cursor/newui-shell-stage1-2304`  
**Date:** 2026-09-26  
**Stage 2:** not started

---

## 1. Runtime smoke

### Existing Next processes (before cert)

| PID | CWD | Port | Branch (cwd) | Action |
|-----|-----|------|--------------|--------|
| 4016574–4016586 | `/workspace` | 3000 | `cursor/menu-page-ui-inventory-2304` | **Stopped** (stale vs Stage 1 worktree; ~5.5 GB `next-server`) |

No other `next dev` processes were killed.

### Server used for cert

```bash
cd /workspace/.worktrees/newui-integration-audit
export DEV_AUTH_BYPASS=1 NEXT_PUBLIC_NEWUI_SHELL=1
npm run dev -- --webpack --port 3000
```

- **Port:** 3000  
- **Session:** tmux `newui-stage1-cert` (terminated after tests)

### Memory (approx.)

| Phase | Used (MB) | Available (MB) |
|-------|-----------|----------------|
| Before stopping old dev | ~9380 | ~6633 |
| After stopping old dev | ~4632 | ~11381 |
| After route curls + compile | ~7896 | ~7804 |
| After stopping cert server | (see end of run) | — |

### Auth

- `GET /api/auth/dev-bypass` → **302** (session established)
- `DEV_AUTH_BYPASS=1` on server process

### Routes (sequential)

| Route | HTTP | `data-newui-shell="true"` | Notes |
|-------|------|---------------------------|--------|
| `/voice/overview` | 200 | 1 | New UI shell + legacy voice overview body |
| `/mctb` | 200 | 1 | New UI shell + legacy MCTB body |
| `/integrations` | 200 | 1 | **Category C** — integrations page bundle unchanged; shell only |

**Playwright (one tab, headless):** same three routes; `shellCount: 1` each; **no hydration/runtime error strings** in automated checks.

**Initial failure (fixed):** missing `class-variance-authority` (required by transplanted `button.tsx` / `sidebar.tsx` from `newui/package.json`). Added explicit dependency; no component redesign.

### Shell mount checklist

| Check | Result |
|-------|--------|
| App boots | Yes |
| Auth works (dev bypass) | Yes |
| Transplanted shell mounts | Yes (`data-newui-shell`) |
| Sidebar/topbar present | Yes (RSC + client chunks load) |
| Production nav wired | Yes (via `productionNavToNewUiSections`) |
| Category C body survives | Yes (`/integrations` still loads `integrations/page.js`) |
| Fatal SSR module errors | None after cva fix |
| Navigation between routes | Yes (curl + Playwright sequential) |

Screenshots: not taken (not required).

---

## 2. Browser `GET /api/call-handling`

**Playwright network listener** during `/voice/overview` → `/mctb` → `/integrations`:

- **Count: 0**
- Transplant shell uses `CallHandlingSwitcher` with `requireProvider`; provider supplies layout SSR state — no client GET on mount.

---

## 3. `loadCallHandlingOwnershipState()` trace

### Entry

`src/app/(app)/layout.tsx` (when `shouldShowCallHandlingSwitcher`) → `loadCallHandlingOwnershipState({ workspaceId })`

### Call chain (actual code)

1. **`loadCallHandlingOwnershipState`** — `ownership-state.ts`  
   - Does **not** import `resolveEffectiveCallHandler`, `telnyxRequest`, `verifyMctbTexmlIngressRoute`, or `ensureMctbTexmlApplication`.

2. **`resolveCanonicalVoiceIngressPhoneNumberId`** — `resolve-canonical-voice-ingress.ts`  
   - `prisma.phoneNumber.findFirst` (workspace-scoped)  
   - `loadMissedCallTextConfig(workspaceId)` — DB/config (no Telnyx in `config.ts`)  
   - `getProductionMctbForwardTargetE164` — Prisma reads + `isPhoneMctbSipIngress(settingsJson)` (no HTTP)

3. **`loadCanonicalVoiceIngressPhone`** — Prisma `phoneNumber.findFirst` (`settingsJson`, `e164`, …)

4. **`readCallHandlingBlock`** / **`resolvePersistedEffectiveCallHandler`** — `phone-settings.ts` — JSON parse only

5. **`assessMctbCallHandlingReadiness`** — `readiness.ts` — Prisma + `loadMissedCallTextConfig`

6. **`assessAiReceptionistCallHandlingReadiness`** — Prisma + **`resolveAiReceptionistForCallHandling`** → **`resolveCanonicalVoiceV3WorkspaceAgent`** — DB only (no `telnyxRequest` in that module)

### Provider functions **not** on this path

| Function | On layout read path? |
|----------|----------------------|
| `resolveEffectiveCallHandler` | **No** (used in `set-active-call-handler.ts` on explicit switch) |
| `verifyMctbTexmlIngressRoute` | **No** (only via `effective-handler.ts`) |
| `ensureMctbTexmlApplication` | **No** |
| `telnyxRequest` | **No** on `loadCallHandlingOwnershipState` chain |
| Twilio SDK/API | **No** |
| Provider PATCH / reconciliation | **No** on read |

### Empirical check

`scripts/newui-stage1-cert-provider-trace.ts` monkey-patches `telnyxRequest` and calls `loadCallHandlingOwnershipState` for dev workspace:

```json
{ "telnyxCallsDuringLoad": 0, "hasState": true }
```

**No correction required** to call-handling read path for Stage 1.

Explicit **PATCH** `/api/call-handling` (handler switch) may still invoke Telnyx via `setActiveCallHandler` — unchanged and not exercised in this cert.

---

## 4. Dependencies

| Package | Status |
|---------|--------|
| `@base-ui/react` | In `package.json` + lockfile; resolves in worktree |
| `class-variance-authority@^0.7.1` | **Added** (matches `newui/package.json`; required for exact transplant imports) |
| Lockfile | Updated via `npm install` |

---

## 5. Tokens

**Source:** `newui/app/globals.css` `:root` (lines 52–87), shell-related variables.

**File:** `src/styles/newui-shell-tokens.css` scoped under `[data-newui-shell]`.

**Cert fix:** realigned values to match `newui` exactly (previous copy had minor oklch drift on sidebar tokens). Added `--sidebar-ring` from newui. Removed non-newui `--sidebar-muted`.

**`newui/`:** untouched.

---

## 6. Exact-code integrity (shell)

Unchanged from `docs/TRANSOVO-NEWUI-STAGE-1-REPORT.md` source-diff table; no shell component redesign during certification.

---

## 7. Blockers

None for Stage 1 gate after `class-variance-authority` dependency fix.

---

## Cert scripts (optional reuse)

- `scripts/newui-stage1-cert-provider-trace.ts`
- `scripts/newui-stage1-cert-browser-network.mjs`
