# MCTB + Call Answering + AI Receptionist — Code gaps (master audit)

**Baseline:** `master` @ `76751c4d` (2026-09-23)  
**Method:** Routes, components, APIs, mocks, and launch flags in the repo — **not** older gap markdown.  
**Out of scope:** Cert, PSTN smoke, browser QA, `npm run test:*`.

---

## Already complete on master (do not rebuild)

### MCTB shell

Every primary nav destination has a real page:

- Overview, Missed Calls (+ detail), Conversations (shared inbox), Voicemail, Analytics
- Setup: phone, recovery, consent, text-back, links, notifications, voicemail setup, exclusions, test
- AI Lead Recovery, Voice Agent wizard, compliance consent, public request form (`/f/mctb/:token`)

Legacy paths redirect as intended:

- `/mctb/numbers` → phone drawer
- `/mctb/setup/missed-call-rules`, `follow-up`, `business-hours` → recovery
- Scheduling routes (`calendar`, `appointments`, `booking`, `reminders`) → conversations or recovery

### Call answering / routing

Implemented on `master`:

| Piece | Location |
|-------|----------|
| Canonical switch API | `/api/call-handling` → `setActiveCallHandler` |
| MCTB ingress | `routePhoneToMctbCallHandlingIngress` |
| AI receptionist ingress | `routePhoneToVoiceV3BasicCallControl` |
| Live Telnyx check | `resolveEffectiveCallHandler` |
| Customer UI | `CallHandlingSwitcher` — header, sidebar, MCTB Overview |
| Wizard / publish | `publish-gate`, `pstn-wizard-agent-selection`, appointment-receptionist route |

PR #483 call-handling work is **merged** on `master`. Routing is **not** an open build item.

### SMS / recovery runtime

- Setup APIs, TeXML pipeline, Lead Recovery on inbound SMS (including #484 FAQ on Company Brain)
- Simplified launch uses `src/lib/mctb/launch-flags.ts` to **hide** extra UI — backends exist; flags are product choice

### Conversations / payments / integrations

`npx tsx scripts/test-cross-surface-ownership-audit.ts` passes on `master`:

- Booking link + payment requests from inbox
- Single `PaymentRequest` service (no parallel MCTB payment engine)
- Shared `/payments` and `/integrations`

### Voice calls list

`/voice/calls` loads `/api/voice/calls` with `useDemo = false` — **not** a mock-driven list.

### Not used on `/mctb` home

`MctbDashboardView` and `DashboardNeedsAttentionPanel` (links to `/voice/needs-attention`) are **not** the live Overview; home is `MctbOverviewView` + `MctbHomeNeedsAttention`.

---

## Real code gaps (unfinished if the feature is customer-facing)

### 1. Missed Calls — consent filter

**Symptom:** Filter in UI does not work correctly.

| What | Where |
|------|--------|
| Filter UI + URL `consentMode` | `src/components/mctb/missed-calls-view.tsx` |
| Filter function | `src/lib/mctb/missed-calls-list-filters.ts` (`filterEventsByConsentMode`) |
| List loader | `src/lib/mctb/missed-calls-list-data.ts` — **never sets `consentMode` on rows** |
| Model | `MissedCallEvent` — **no `consentMode` column** |

Comment in filters says *“API enriches rows”* — enrichment is **not implemented**.

**Finish:** Enrich list rows (metadata, consent log, or mode at event time) **or** remove the filter from UI.

---

### 2. Voice call detail — fake chrome on real calls

For real call IDs, transcript/recording can load from API, but `src/app/(app)/voice/calls/[id]/page.tsx` still has:

- **Activity feed:** always `MOCK_ACTIVITY_EVENTS` (both branches of the ternary)
- **Sidebar:** hardcoded `$0.15 (est.)`, provider `Twilio`, static tags (e.g. Sales / Inbound Call)

**Finish:** Wire activity from API `events` / `toolExecutions` / transfers; real cost and provider from call/recordings.

**Note:** Similar fix exists on unmerged branch `cursor/voice-ui-closure-2304` (`customer-activity-feed.ts` is **not** on `master`).

---

### 3. PLATFORM vs CUSTOMER SMS sender (only if this release includes it)

| What | Status |
|------|--------|
| Product doc | `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md` |
| UI comment | `mctb-recovery-goal-setup-section.tsx` — *“Future PLATFORM/CUSTOMER sender mode”* |
| Runtime | `resolveMctbSmsSender` — authorization order, no explicit mode enum in setup API |

**Finish:** Config + UI + send semantics — **only if** you intend to ship explicit sender mode now. Otherwise labeled **future**, not an accidental omission.

---

### 4. Request form — custom field editor (only if V1 scope includes it)

`setup-links-view.tsx`: presets + read-only field list; copy says *“Custom field editing will expand in a later release.”* Save path works for presets.

**Finish:** Field builder **or** accept V1 as presets-only.

---

### 5. Text-to-Pay — refund in payment-request drawer

| What | Status |
|------|--------|
| API | `POST /api/payment-requests/[id]/refund` |
| UI | `payment-request-detail-drawer.tsx` — **no refund action** |

(Merchant-payments has separate refund UI.)

**Finish:** Hook drawer to refund API if in-product refund is required for MCTB Payments.

---

## Launch / product choices (code exists; flags hide UI)

File: `src/lib/mctb/launch-flags.ts`

| Flag | Effect |
|------|--------|
| `MCTB_LAUNCH_TRY_IT_ENABLED = false` | No Try It in nav / onboarding demo |
| `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY` | Hides SMS/in-app notification matrix in setup; limits delivery paths |
| `MCTB_LAUNCH_HIDE_AI_BOOK_UI` | Hides Recovery AI booking block |
| `MCTB_LAUNCH_SIMPLIFY_RECOVERY_UI` | Hides full AI LR link + follow-up / max-attempt rows on Recovery |
| `MCTB_LAUNCH_GOAL_DRIVEN_RECOVERY_UI` | Goal-first Text Back; copy ties full custom copy to future sender mode |

**Advanced opener** on Text Back exists behind *“Advanced: customize opener”* — not missing; launch messaging is conservative.

**To expose more product:** flip flags and verify UI — not new architecture.

---

## Optional cleanup (polish, not “routing incomplete”)

| Item | Notes |
|------|--------|
| **Two call-handling UIs** | Header/Overview → `/api/call-handling` (V3). Voice Agent page → `/api/mctb/inbound-handling` (TeXML assistant). Both mutate Telnyx. **Consolidate UX** if you want one switch. |
| **`/voice/receptionist` redirect** | Goes to `/voice/setup` → `/mctb/setup`, not `/mctb/voice-agent` |
| **Analytics per business line** | No filter in `mctb-analytics-view.tsx` or `/api/mctb/analytics` — **not exposed**; build only if multi-line analytics is in scope |

---

## Not started (new product — not “forgot to finish MCTB”)

- Unified voice + SMS inbox
- Rosie-style single “Agent Settings + Publish” hub
- Smith-style Call Decisions timeline in customer UI
- MCTB-native appointments shell (routes intentionally redirect to conversations / main appointments)

---

## Priority summary — what to code next

If the bar is **honest, wired customer surfaces** on `master`:

| Priority | Item |
|----------|------|
| **P1** | Missed calls consent filter — enrich data or remove filter |
| **P1** | Voice call detail — real activity feed + cost/provider/tags |
| **P2** | PLATFORM/CUSTOMER sender — only if in this release |
| **P2** | Payment-request refund in drawer |
| **P3** | Request form field builder — only if out of “presets only” |
| **P3** | Unify call-handling UI (voice-agent vs header) |
| **When ready** | Flip launch flags (Try It, full LR, SMS notifications, AI book UI) |

---

## Unmerged branches (check before duplicating work)

| Branch | Relevance |
|--------|-----------|
| `cursor/voice-ui-closure-2304` | Call detail activity feed / truthful metadata — **not on `master`** |
| `cursor/call-handling-ownership-switch-2304` | **Merged** (#483) |
| `cursor/mctb-simplified-launch-2304` | **Merged** (#484); branch may have extra doc commits only |

```bash
git log master..origin/<branch> --oneline -- src/path/you/care/about
```

---

*Re-audit when `master` moves significantly; re-read launch flags and `voice/calls/[id]/page.tsx` first.*
