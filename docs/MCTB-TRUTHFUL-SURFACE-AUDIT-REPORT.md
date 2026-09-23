# MCTB truthful surface — pre-merge verification report

**Branch:** `cursor/mctb-truthful-surface-audit-2304`  
**Status:** Verification complete — see merge recommendation below.

---

## A. Ownership

### Canonical customer switcher (source of truth)

| Item | Location |
|------|----------|
| Component | `CallHandlingSwitcher` in `src/components/call-handling/call-handling-switcher.tsx` |
| Shell placement | `src/components/layout/sidebar.tsx` and `src/components/layout/header.tsx` via `shouldShowCallHandlingSwitcher` |
| Read API | `GET /api/call-handling` → `loadCallHandlingOwnershipState` |
| Mutation API | `PATCH /api/call-handling` → `setActiveCallHandler` |
| Telnyx mutation | `routePhoneToMctbCallHandlingIngress` (MCTB) or `routePhoneToVoiceV3BasicCallControl` (AI) — patches `connection_id` on canonical voice ingress DID |
| Tests | `npx tsx scripts/test-call-handling-ownership.ts` |

`CallHandlingDashboardCard` is a layout wrapper that embeds the same `CallHandlingSwitcher` for MCTB Overview only — not a second mutation path.

### Voice Agent page

- **Before:** duplicate `CallHandlingDashboardCard` on Voice Agent page.
- **After:** no Call Handling control on Voice Agent page — customers use the global left-nav / header switcher only (`mctb-voice-agent-page.tsx`).

### Remaining `/api/mctb/inbound-handling` and library callers

| # | File | Function / action | Mutates `connection_id`? | Telnyx function (if any) | Config vs ownership | Canonical ingress? | Customer UI? |
|---|------|-------------------|---------------------------|--------------------------|---------------------|--------------------|--------------|
| 1 | `src/app/api/mctb/inbound-handling/route.ts` | `PATCH` | **Yes, via delegate** | `setActiveCallHandler` → MCTB or V3 routes | Ownership (legacy API shape) | Yes — resolves line → ingress phone | Only if something still PATCHes (no product UI after Voice Agent fix) |
| 2 | `src/app/api/mctb/inbound-handling/route.ts` | `GET` | No | — | Read-only status | Yes | Wizard phone step (`phone-step.tsx`) |
| 3 | `src/lib/mctb/inbound-handling/switch-mode.ts` | `setInboundHandlingMode` | **Yes, via delegate** | `setActiveCallHandler` only (no `routePhoneToTexml*`) | Metadata + canonical switch | Yes | Internal / legacy callers |
| 4 | `src/app/api/solutions/appointment-receptionist/route.ts` | publish / live sync | **When `!explicitCallHandling`** | Same delegate through `setInboundHandlingMode` | First-time wizard default | Yes, when publish targets ingress | Wizard Activate (not Call Handling UI) |
| 5 | `src/components/solutions/appointment-receptionist/steps/phone-step.tsx` | load status | No | — | Read | — | Wizard |
| 6 | `src/lib/mctb/overview.ts`, `line-config`, voice tools, `ensure-call-from-event` | load / parse | No | — | Config / routing hints | — | No |
| 7 | `scripts/mctb-voice-agent-call-ready.ts`, cert scripts | ops | Same as #3 | Delegate | Ops | Yes | No |

**Conclusion:** No remaining path uses `routePhoneToTexmlAssistant` / `routePhoneToTexmlApp` for ownership. All Telnyx `connection_id` mutations for ingress go through `setActiveCallHandler`. Customer-facing ownership control plane: **Call Handling switcher → `/api/call-handling`**.

**Regression (ownership):**

- `npx tsx scripts/test-call-handling-ownership.ts` — **PASS**
- `npx tsx scripts/test-cross-surface-ownership-audit.ts` — **PASS**
- `npx tsx scripts/test-mctb-simplified-launch.ts` (includes static inbound-handling guard) — **PASS**

---

## B. Existing Customer

### Launch vs full AI Lead Recovery UI

| Surface | `existing_customer` scenario | Behavior |
|---------|-------------------------------|----------|
| Simplified launch (`defaultLaunchEnabledScenarios`) | **Off** | Intents `EXISTING_CUSTOMER_ISSUE` / `CANCEL_REQUEST` not in `enabledIntents` → classified intents clamped to `UNKNOWN` / fallback |
| Full AI Lead Recovery page | Opt-in toggle | When on, seeds `EXISTING_CUSTOMER_ISSUE` + `CANCEL_REQUEST` policies from `policy-defaults.ts` |

### Supported (scenario on + `treatDifferently` on)

- **Intents:** `EXISTING_CUSTOMER_ISSUE`, `CANCEL_REQUEST` (when scenario enabled).
- **Actions:** `CREATE_CALLBACK_REQUEST`, `SEND_EMAIL_SUMMARY`, `ESCALATE_HUMAN`, `ROUTE_TO_TEAM` (notify handoff), `CUSTOMER_MESSAGE`.
- **Collection:** `ISSUE_DESCRIPTION` for existing-customer issue path.
- **Cancel:** Does **not** auto-cancel appointments — message + callback / human handoff only (UI copy added).

### Unsupported / bounded

- **Scenario off:** Policy engine uses `fallback:scenario_off`; runtime clamps disallowed intents.
- **`treatDifferently` off:** Uses `fallback:existing_customer_generic` (same as general take-message fallback).
- **No CRM/job lookup:** No automatic identification of “existing” beyond LLM intent classification.
- **Launch profile:** Scenario hidden/disabled by default — no implied existing-customer automation at launch.

### Tests

- `npx tsx scripts/test-mctb-existing-customer-policy.ts` — **PASS** (supported case, scenario off, treatDifferently off, cancel handoff)

---

## C. Calls detail (cherry-pick isolation)

**Files in scope (only these changed for activity feed on this branch):**

- `src/lib/voice/calls/customer-activity-feed.ts`
- `src/lib/voice/calls/customer-activity-feed.test.ts`
- `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/api/voice/calls/[id]/route.ts`

**Isolation checks:**

1. Voice V3 runtime / booking tools — **not modified** by these files (read-only API aggregation + presentation).
2. Call persistence — **unchanged** (GET/PATCH feedback only on `voiceCall` metadata).
3. Telnyx provider behavior — **unchanged**.
4. Real call path — cost/provider from `formatCallCostCents` / `formatTelephonyProviderLabel`; **no** fake $0.15 or hardcoded Twilio on non-demo IDs.
5. Activity feed — built from `voiceCallEvent`, tool executions, transfers, recordings; **empty → explicit pipeline states**, not invented events.
6. `MOCK_ACTIVITY_EVENTS` / demo IDs — **demo-only** (`isDemoCallId`); not used for production call IDs.

**Test:** `customer-activity-feed.test.ts` — **PASS**

---

## D. Regression (full set run this verification)

| Script | Result |
|--------|--------|
| `test-call-handling-ownership.ts` | PASS |
| `test-cross-surface-ownership-audit.ts` | PASS |
| `test-mctb-simplified-launch.ts` | PASS |
| `test-mctb-existing-customer-policy.ts` | PASS |
| `customer-activity-feed.test.ts` | PASS |

---

## E. Merge recommendation

**READY FOR MERGE** (pending human review of this report — do not auto-merge).

---

## Prior audit items (unchanged intent)

- Text-to-Pay hidden from MCTB LR UI; shared `/payments` untouched.
- AI_BOOK hidden in UI; backend preserved.
- Missed Calls consent filter removed (no `consentMode` on rows).
- PaymentsEditor dead code — intentionally left in place.
