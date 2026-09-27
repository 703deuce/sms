# MCTB Opus component audit (legacy vs Opus UI)

**Date:** 2026-09-27  
**Question:** For every MCTB customer page, are inputs, controls, and layout built from **Opus / newui-transplant** primitives — or legacy `src/components/mctb/*` / root `src/components/ui/*`?

**Default production path:** `isNewUiStage2Enabled()` → true when `NEXT_PUBLIC_NEWUI_SHELL` is not `0` and `NEXT_PUBLIC_NEWUI_STAGE2` is not `0` (`src/lib/newui-transplant/stage2-enabled.ts`).

**Opus component homes (canonical):**

- Layout/kit: `src/newui-transplant/components/app/kit`, `button-link`, `save-bar`, `link-tabs`, `status`
- Controls: `src/newui-transplant/components/ui/*` (Button, Input, Select, Table, …)
- MCTB bodies: `src/newui-transplant/components/mctb/*`, `mirror/routes/mctb/*`, `connected/mctb/*`

**Legacy homes (should not render when Stage 2 is on):**

- `src/components/mctb/**` (~88 files)
- Root `src/components/ui/*` (pre-transplant shadcn)
- `src/components/inbox/kimi-conversations-connected.tsx` (legacy inbox shell)

---

## Executive summary

| Verdict | Detail |
|--------|--------|
| **Stage 2 ON** | All primary `/mctb/*` routes **branch** to `NewUi*` connected pages. Page bodies overwhelmingly use Opus kit + `newui-transplant/components/ui`. |
| **Not “100% Opus”** | (1) **Dual-path** — every route still ships legacy views in the bundle (`NEXT_PUBLIC_NEWUI_STAGE2=0` rollback). (2) **Global legacy CSS** on `src/app/(app)/mctb/layout.tsx`. (3) **Explicit legacy embeds** in Opus paths (onboarding number drawer, voicemail add-on gate, public form). (4) **Demo/static mirror copy** on several setup surfaces can *look* wired but is not Opus-vs-legacy — it is **placeholder data** in Opus components. |
| **Manifest** | 18 MCTB routes in `src/newui-transplant/mirror/MANIFEST.json`; plus **compliance consent** and **onboarding** Opus pages outside the manifest. |

**Bottom line:** With Stage 2 enabled, customers should see **Opus chrome + Opus MCTB components**, not the old `Mctb*View` screens — but the codebase is **not** legacy-free, and several Opus pages still mix **static demo rows** with partial API wiring (see `docs/TRANSOVO-NEWUI-OPUS-BACKEND-WIRING-GAP-INVENTORY.md`).

---

## Route-by-route component stack

Legend: **Opus UI** = newui-transplant only | **Mixed** = Opus + legacy embed | **Legacy only** = `components/mctb` when Stage 2 off

| Route | Stage 2 component entry | Opus UI? | Legacy in Opus path | Notes |
|-------|-------------------------|----------|---------------------|-------|
| `/mctb` | `NewUiMctbOverviewPage` | **Opus** | None | `Page`, `Stat`, `Panel`, `RecoveryPill` |
| `/mctb/missed-calls` | `NewUiMctbMissedCallsPage` → `MissedCallsBrowser` | **Opus** | None | Filters/pagination partly cosmetic |
| `/mctb/missed-calls/[id]` | `NewUiMctbMissedCallDetailPage` → `detail-view` | **Mixed** | `BUSINESS.sender` sandbox in detail-view | Should use API sender label |
| `/mctb/conversations` | `NewUiMctbConversationsPage` → `Inbox` | **Opus** | None (adapter is glue only) | Not `KimiConversationsConnected` when Stage 2 on |
| `/mctb/voicemail` | `NewUiMctbVoicemailPage` → `VoicemailBrowser` | **Opus** | **`AddOnUpgradeCard`** if not entitled | Entitlement gate uses legacy card before Opus page |
| `/mctb/analytics` | `NewUiMctbAnalyticsPage` | **Opus** | None | |
| `/mctb/ai-recovery` | `NewUiMctbAiRecoveryPage` | **Opus** | None | Mirror controls partially unwired to API |
| `/mctb/setup` | `TransplantMctbSetupPage` + wiring | **Opus** | Static `CALL_FLOW` / `ACTIVITY` defaults in mirror | Demo rows until wiring fills `wired` props |
| `/mctb/setup/phone` | `TransplantMctbSetupPhonePage` | **Opus** | Demo verification/instructions blocks | See wiring gap doc |
| `/mctb/setup/consent` | `ConsentEditor` | **Opus** | None | |
| `/mctb/setup/text-back` | `TextBackEditor` | **Opus** | None | |
| `/mctb/setup/recovery` | `TransplantMctbSetupRecoveryPage` | **Opus** | Partial wiring | |
| `/mctb/setup/voicemail` | `TransplantMctbSetupVoicemailPage` | **Opus** | Partial wiring | |
| `/mctb/setup/notifications` | `TransplantMctbSetupNotificationsPage` | **Opus** | Partial wiring | |
| `/mctb/setup/exclusions` | `ExclusionsTable` | **Opus** | None | |
| `/mctb/setup/links` | `TransplantMctbSetupLinksPage` | **Opus** | Partial wiring | |
| `/mctb/setup/test` | `TransplantMctbSetupTestPage` | **Opus** | Mostly wired | |
| `/mctb/setup/layout` | `MctbSetupWorkspaceLayout` | **Opus** | None | `LinkTabs` + setup section nav |
| `/mctb/compliance/consent` | `NewUiMctbConsentHistoryPage` | **Opus** | None | Not in MANIFEST.json |
| `/onboarding/mctb` | `MctbOnboardingRuntime` shell=`opus` → `MctbOnboardingOpusView` | **Mixed** | **`MctbNumberDrawerHost`** (`components/mctb/numbers`) | All steps use Opus inputs; drawer is legacy |
| `/f/mctb/[token]` | Inline page | **Legacy** | **`@/components/ui/card`**, **`button`** | No Opus transplant; public form not rebuilt |
| Redirects only | `voice-agent`, `numbers`, `missed-call-rules`, scheduling, etc. | N/A | N/A | No UI |

**Stage 2 OFF:** Every row above falls back to the matching `src/components/mctb/*View` or `MctbVoicemailWorkspace` / `KimiConversationsConnected` / `MctbOnboardingWizard` — full legacy UI.

---

## Global chrome (all MCTB pages)

| Layer | Source | Opus? |
|-------|--------|-------|
| Sidebar + topbar (when `shouldUseNewUiShell`) | `newui-transplant/components/app/app-sidebar.tsx`, `topbar.tsx` | **Opus** |
| MCTB product layout CSS | `components/mctb/shell/*.css` imported in `mctb/layout.tsx` | **Legacy tokens/overrides** — can affect Opus pages |
| Product local nav (MCTB V1) | `buildMctbV1Nav` + Kimi sidebar mapping in `app-shell` | Opus shell + nav config |

---

## `newui-transplant/components/mctb/*` import scan

All seven MCTB-specific Opus modules import only from `newui-transplant` + `@/lib` — **no** imports from `src/components/mctb`:

- `consent-editor.tsx`, `text-back-editor.tsx`, `exclusions-table.tsx`
- `inbox.tsx`, `missed-calls-browser.tsx`, `voicemail-browser.tsx`
- `setup-workspace-layout.tsx`

Mirror routes under `mirror/routes/mctb/**` likewise use only newui-transplant paths.

---

## Legacy still in repository (not customer-visible when Stage 2 ON)

| Area | Path | Count / note |
|------|------|----------------|
| Legacy page views | `src/components/mctb/**/*.tsx` | ~88 files; dual-imported from `app/(app)/mctb/**/page.tsx` |
| Onboarding wizard (rollback) | `components/mctb/onboarding-wizard.tsx` | CSS classes `mctb-onb-*` |
| Runtime wizard panels | `components/mctb/wizard/*`, `mctb-phone-forwarding-panel` | Used only when `shell !== "opus"` |
| Kimi-era patterns inside legacy | `components/mctb/kimi-ui/*` | Legacy path only |

---

## “Looks Opus but isn’t fully real” (facade / demo — not legacy components)

These are **Opus components** with static or sandbox data (user may perceive as “merged” UI):

- Setup overview: `CALL_FLOW`, `OPERATIONS`, `ACTIVITY` in `mirror/routes/mctb/setup/page.tsx`
- Setup phone: demo verification panel, carrier codes (see wiring gap doc)
- Missed calls list: hardcoded stat deltas, fake pagination
- Conversations: hardcoded consent/assignee in context panel
- AI Recovery: uncontrolled switches in mirror until wiring completed
- Detail: `BUSINESS` from `sandbox-data` for sender row

**Reference:** `docs/TRANSOVO-NEWUI-OPUS-BACKEND-WIRING-GAP-INVENTORY.md` (MCTB section).

---

## P0 gaps for “pure Opus, no legacy” (product / eng)

1. **`/f/mctb/[token]`** — rebuild with `newui-transplant` kit + ui (public, no app shell).
2. **`MctbNumberDrawerHost`** — reimplement in `newui-transplant` (onboarding + any setup number flows).
3. **`AddOnUpgradeCard`** — Opus-styled entitlement gate for voicemail (or shared products Opus pattern).
4. **Remove or gate `mctb/layout.tsx` legacy CSS** when Stage 2 is on (avoid token collision).
5. **Delete dual-path** after launch: drop `isNewUiStage2Enabled()` branches and legacy `components/mctb` views (separate cleanup project).
6. **Finish wiring** on setup overview, phone, conversations, ai-recovery so Opus pages are not half-demo.

---

## How to verify locally

```bash
# Ensure Opus path (default)
unset NEXT_PUBLIC_NEWUI_STAGE2
unset NEXT_PUBLIC_NEWUI_SHELL

# Force legacy (compare)
NEXT_PUBLIC_NEWUI_STAGE2=0 npm run dev
```

Manual pass: walk manifest routes + `/mctb/compliance/consent` + `/onboarding/mctb` + `/f/mctb/<token>`.

Automated guard (suggested, not yet in repo):

```bash
# Opus MCTB modules must not import legacy mctb views
rg "from ['\"]@/components/mctb" src/newui-transplant/connected/mctb src/newui-transplant/components/mctb src/newui-transplant/mirror/routes/mctb
# Expect: only mctb-onboarding-opus-view.tsx (number drawer) until P0 #2 fixed
```

---

## Audit conclusion

**With Stage 2 enabled (production default):** MCTB operational and setup pages render **Opus transplant components**, not the old `Mctb*View` React trees. **Exceptions:** onboarding number drawer, voicemail upgrade card, public request form, and global legacy MCTB CSS. **Separate issue:** several Opus pages still show **static/demo fields** that mimic a finished product without full backend wiring — that is not legacy CSS, but it violates “everything is real” expectations.

**MCTB_OPUS_COMPONENT_STATE: MOSTLY_OPUS_WITH_GAPS** (not legacy-dominant when Stage 2 is on).
