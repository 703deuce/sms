# New UI Phase 1 — Exact frontend transplant (completion report)

**Status:** Phase 1 pass complete (static validation). Phase 2 not started.

**Rule restored:** Production Stage 2 (`NEXT_PUBLIC_NEWUI_SHELL` + Stage 2 gate) renders the approved `newui/` presentation — not legacy editors inside the Opus shell.

## Tooling

| Script | Purpose |
|--------|---------|
| `node scripts/newui-exact-sync-from-sandbox.mjs` | Copy `newui/components`, `newui/lib/data.ts` → sandbox-data, mirror all `newui/app/**/page.tsx` → `src/newui-transplant/mirror/routes/**` |
| `node scripts/newui-phase1-wire-routes.mjs` | Point `src/app/(app)/voice/**` and `mctb/**` Stage 2 branches at mirror exports |
| `node scripts/newui-phase1-validate.mjs` | Static check: component parity, no `connected/` in app routes, Opus shell (no production nav merge) |

## Page inventory (Opus → production)

Gate: `isNewUiStage2Enabled()` → `Transplant*Page` from `src/newui-transplant/mirror/routes/...`.

| # | `newui/app` route | Production route | Mirror export | Opus page used | Presentation vs `newui/` | Boundary connected | Fake / deferred |
|---|-------------------|------------------|---------------|----------------|---------------------------|--------------------|-----------------|
| 1 | `(app)/voice/overview` | `/voice/overview` | `TransplantVoiceOverviewPage` | Yes | Import paths only | Auth redirect only | Sandbox KPIs/calls (Opus data.ts) |
| 2 | `(app)/voice/calls` | `/voice/calls` | `TransplantVoiceCallsPage` | Yes | Import paths only | — | Sandbox call list |
| 3 | `(app)/voice/calls/[id]` | `/voice/calls/[id]` | `TransplantVoiceCallsIdPage` | Yes | Import paths only | `params` pass-through | Sandbox call detail |
| 4 | `(app)/voice/analytics` | `/voice/analytics` | `TransplantVoiceAnalyticsPage` | Yes | Import paths only | — | Sandbox metrics |
| 5 | `(app)/voice/receptionist` | `/voice/receptionist` | `TransplantVoiceReceptionistPage` | Yes | Import paths only | — | Was `VoiceReceptionistEditor` (Phase 2) |
| 6 | `(app)/voice/knowledge` | `/voice/knowledge` | `TransplantVoiceKnowledgePage` | Yes | Import paths only | — | Was `BusinessKnowledgeEditor` (Phase 2) |
| 7 | `(app)/voice/call-handling` | `/voice/call-handling` | `TransplantVoiceCallHandlingPage` | Yes | Import paths only | — | Was operational call-handling UI (Phase 2) |
| 8 | `(app)/voice/numbers` | `/voice/numbers` | `TransplantVoiceNumbersPage` | Yes | Import paths only | — | Sandbox numbers |
| 9 | `(app)/mctb` | `/mctb` | `TransplantMctbPage` | Yes | Import paths only | Workspace context on legacy branch only | Sandbox overview |
| 10 | `(app)/mctb/missed-calls` | `/mctb/missed-calls` | `TransplantMctbMissedCallsPage` | Yes | Import paths only | — | Sandbox list |
| 11 | `(app)/mctb/missed-calls/[id]` | `/mctb/missed-calls/[id]` | `TransplantMctbMissedCallsIdPage` | Yes | Import paths only | `params` | Sandbox detail |
| 12 | `(app)/mctb/conversations` | `/mctb/conversations` | `TransplantMctbConversationsPage` | Yes | Import paths only | `searchParams` | Opus `Inbox` + sandbox threads |
| 13 | `(app)/mctb/ai-recovery` | `/mctb/ai-recovery` | `TransplantMctbAiRecoveryPage` | Yes | Import paths only | — | Was `AiRecoverySettingsPage` (Phase 2) |
| 14 | `(app)/mctb/voicemail` | `/mctb/voicemail` | `TransplantMctbVoicemailPage` | Yes | Import paths only | — | Sandbox voicemail |
| 15 | `(app)/mctb/analytics` | `/mctb/analytics` | `TransplantMctbAnalyticsPage` | Yes | Import paths only | — | Sandbox analytics |
| 16 | `(app)/mctb/setup` | `/mctb/setup` | `TransplantMctbSetupPage` | Yes | Import paths only | — | Was setup overview editor (Phase 2) |
| 17 | `(app)/mctb/setup/phone` | `/mctb/setup/phone` | `TransplantMctbSetupPhonePage` | Yes | Import paths only | — | Was phone/forwarding editor (Phase 2) |
| 18 | `(app)/mctb/setup/consent` | `/mctb/setup/consent` | `TransplantMctbSetupConsentPage` | Yes | Import paths only | — | Opus consent UI (local save mock) |
| 19 | `(app)/mctb/setup/text-back` | `/mctb/setup/text-back` | `TransplantMctbSetupTextBackPage` | Yes | Import paths only | — | Opus text-back editor mock |
| 20 | `(app)/mctb/setup/exclusions` | `/mctb/setup/exclusions` | `TransplantMctbSetupExclusionsPage` | Yes | Import paths only | — | Sandbox exclusions |
| 21 | `(app)/mctb/setup/recovery` | `/mctb/setup/recovery` | `TransplantMctbSetupRecoveryPage` | Yes | Import paths only | — | Was recovery controls editor (Phase 2) |
| 22 | `(app)/mctb/setup/voicemail` | `/mctb/setup/voicemail` | `TransplantMctbSetupVoicemailPage` | Yes | Import paths only | — | Was voicemail setup editor (Phase 2) |
| 23 | `(app)/mctb/setup/notifications` | `/mctb/setup/notifications` | `TransplantMctbSetupNotificationsPage` | Yes | Import paths only | — | Opus notifications UI |
| 24 | `(app)/mctb/setup/links` | `/mctb/setup/links` | `TransplantMctbSetupLinksPage` | Yes | Import paths only | — | Opus links UI |
| 25 | `(app)/mctb/setup/test` | `/mctb/setup/test` | `TransplantMctbSetupTestPage` | Yes | Import paths only | — | Opus test UI |
| 26 | `app/page.tsx` | *(sandbox redirect only)* | `TransplantNewUiHomeRedirectPage` | N/A | — | — | Not wired to production root |

**Static component parity:** `newui/components/**` vs `src/newui-transplant/components/**` — **0 presentation diffs** after normalizing import paths (`newui-phase1-validate.mjs`).

## Legacy substitutions removed from Stage 2 path

The following **no longer** render on Stage 2 routes (legacy remains when `NEXT_PUBLIC_NEWUI_STAGE2=0` or shell off):

- `NewUiLegacyEditorPage` → `VoiceReceptionistEditor`, `BusinessKnowledgeEditor`, `CallHandlingOperationalPage`, `AiRecoverySettingsPage`, MCTB setup legacy views
- `src/newui-transplant/connected/**` reimplemented / adapted page bodies

`src/newui-transplant/connected/**` and production components are **retained in the repo** for Phase 2 and rollback.

## Shell / menu

- **Opus menu:** `AppSidebar` + `Topbar` from `src/newui-transplant/components/app/*` using `NAV` from `src/newui-transplant/lib/nav.ts` (synced from `newui/lib/nav.ts`).
- **No production nav merge** in `newui-transplant-shell-layout.tsx` (removed `productionNavToNewUiSections`).
- Production-only destinations not in Opus `NAV` are **not** added to the sidebar in Phase 1.

## `newui/` source

**Untouched.** All copies live under `src/newui-transplant/`.

## Production routes not in Opus menu / sandbox (intentional Phase 1)

Examples (still legacy chrome/body at their URLs): `/appointments/**`, `/conversations` (global inbox), `/contacts/**`, `/campaigns/**`, `/dashboard`, `/smart-routing/**`, `/compliance/**`, full `/settings/**` beyond links in Opus Shared section, `/voice/setup`, `/voice/agents/**`, etc.

## Phase 2 (not authorized)

Wire real APIs only where Opus already has controls; design missing production features into New UI intentionally; decide menu placement for production-only routes.
