# Voice V3 — End-to-end product completion pass (report)

**Branch:** `cursor/voice-v3-e2e-product-completion-2304`  
**Pass:** 1 — Product completeness (no nav reorg)  
**Brief:** `docs/VOICE-V3-E2E-PRODUCT-COMPLETION-PASS-BRIEF.md`  
**Prior audit:** `docs/VOICE-V3-AFTER-HOURS-FEATURE-AUDIT-2026-09-25.md`

---

## Executive summary

Voice V3 after-hours receptionist **runtime and wizard** remain the protected architecture. This pass **closed three owner-facing gaps** found in source audit:

1. **Knowledge gaps** — API + Knowledge page workflow (review, dismiss, resolve with approved FAQ text).  
2. **Voice analytics** — `/voice/analytics` is a real dashboard (no MCTB redirect); `/voice/analytics/after-hours` redirects to it (stub removed).  
3. **Needs attention** — failed voice transfers (14d) surface with link to call detail.

**No** dedicated Transfers page. **No** nav reorganization. **No** Microsoft FIND/BOOK changes.

Remaining work is predominantly **CERTIFICATION ONLY** (PSTN transfer/warm/waterfall, Google book, carrier SCREEN, recording ingest/playback E2E) plus **Pass 2** surface architecture.

---

## Work performed (this branch)

| Area | Change |
|------|--------|
| Knowledge gaps | `GET/PATCH /api/voice/knowledge-gaps`, `KnowledgeGapsPanel` on `/voice/knowledge#knowledge-gaps`, call detail API includes gaps for call |
| Analytics | `VoiceAnalyticsDashboard`, `loadVoiceAnalytics().voiceProduct` metrics, removed MCTB redirect |
| After-hours analytics stub | Redirect to `/voice/analytics` |
| Needs attention | `failed_transfer` items from `VoiceTransfer` failed/exhausted |
| Docs | This report + operator brief |

---

## §14 — Feature completion matrix

Status values: **COMPLETE** | **CERTIFICATION ONLY** | **PARTIAL-BACKEND** | **PARTIAL-UI** | **PARTIAL-BOTH** | **OUT OF SCOPE**

| Capability | UI | Persistence | Backend/API | Runtime | Result UI | Tenant scoped | Status before | Work performed | Status after | Certification needed |
|------------|----|-------------|-------------|---------|-----------|---------------|---------------|----------------|--------------|----------------------|
| CFNA / keep number | Wizard + inbound routing | Yes | Yes | Yes | Partial | Yes | PARTIAL-UI (ingress risk doc) | None | PARTIAL-UI | PSTN: business line → Voice V3 ingress |
| GPT-Live Amy | Wizard | Yes | Yes | Yes | Calls UI | Yes | COMPLETE | — | COMPLETE | Smoke PSTN |
| Greeting / hours / context | Wizard | Yes | Compile | Yes | Calls | Yes | COMPLETE | — | COMPLETE | — |
| Website crawl setup | Wizard + KB API | Yes | Job + API | RAG/FileSearch | Knowledge page | Yes | COMPLETE | — | COMPLETE | External: index/vector |
| FAQ / custom knowledge | Knowledge page | Yes | Yes | Yes | Search UI | Yes | COMPLETE | — | COMPLETE | — |
| Knowledge gaps | Knowledge panel | `voice_knowledge_gaps` | **New** API | Post-call persist | **New** panel + call detail | Yes | PARTIAL-UI | **Pass 1** | COMPLETE | Post-call must run on real calls |
| Custom intake | Wizard | Yes | Tools | Yes | Call detail | Yes | COMPLETE | — | COMPLETE | — |
| Take message | Wizard caps | Yes | `take_message` | Yes | Outcomes | Yes | COMPLETE | — | COMPLETE | PSTN |
| Request callback | Wizard | `callbackRequest` | Yes | Yes | Callback list + NA | Yes | COMPLETE | — | COMPLETE | PSTN |
| MS book/find/reschedule/cancel | Wizard | Yes | FIND/BOOK | Yes | Call detail | Yes | COMPLETE | — | COMPLETE | **Regression PSTN** (frozen baseline) |
| Google calendar book | Wizard | Yes | Provider | Yes | Call detail | Yes | PARTIAL-BOTH | None | CERTIFICATION ONLY | Live PSTN book |
| Calendly V3 | Blocked in wizard | — | — | — | — | — | OUT OF SCOPE | — | OUT OF SCOPE | — |
| Send / SMS booking link | Wizard | Yes | Yes | Yes | SMS + call | Yes | COMPLETE | — | COMPLETE | Sender setup |
| Emergency + on-call | Wizard editors | Yes | `authorize-transfer` | Python xfer | Notifications | Yes | COMPLETE | — | CERTIFICATION ONLY | PSTN emergency waterfall |
| Direct / warm / waterfall | Wizard | Yes | Auth + Python | Yes | Transfers on call | Yes | COMPLETE | — | CERTIFICATION ONLY | PSTN matrix |
| Transfer fallback | Wizard | Yes | Yes | Yes | Outcomes | Yes | COMPLETE | — | CERTIFICATION ONLY | PSTN |
| Staff notifications | Wizard notifications | Prefs on agent | Brevo/SMS | Events | Email/SMS | Yes | COMPLETE | — | COMPLETE | Deliverability |
| Spam solicitor | Wizard + blocklist | Yes | Tool + API | Yes | Outcomes | Yes | COMPLETE | — | CERTIFICATION ONLY | PSTN DECLINE |
| Carrier Spam Likely SCREEN | Wizard policy | Call metadata | LiveKit bootstrap | Hint in prompt | Metadata | Yes | COMPLETE | — | CERTIFICATION ONLY | Telnyx header + trunk |
| `end_call` | — | — | Catalog | Yes | — | Yes | COMPLETE | — | COMPLETE | — |
| Recording | Wizard `callRecording` | `VoiceRecording` | start-telnyx | Provider | Player on detail | Yes | PARTIAL-BOTH | None | CERTIFICATION ONLY | E2E ingest + playback |
| Transcript | — | `VoiceTranscript` | Post-call pipeline | LiveKit/Deepgram | Call detail | Yes | COMPLETE | — | COMPLETE | — |
| Summary | — | Insights | LLM summary | — | Call detail + email | Yes | COMPLETE | — | COMPLETE | — |
| Post-call webhooks | Workspace webhooks config | Queue rows | emit on complete | — | Delivery logs | Yes | COMPLETE | — | COMPLETE | Configure + test URL |
| Completed-call email | Notifications editor | Idempotency meta | `notify-call-completed` | post-call.ts | Inbox/email | Yes | COMPLETE | — | COMPLETE | Brevo |
| AI recovery SMS | Wizard flags | — | post-call hook | SMS | — | Yes | COMPLETE | — | CERTIFICATION ONLY | PSTN + sender |
| Calls inbox / detail | `/voice/calls` | `VoiceCall` | APIs | — | UI | Yes | COMPLETE | Gaps on detail | COMPLETE | — |
| Voice analytics | **Was redirect** | Aggregates | `loadVoiceAnalytics` | — | **New dashboard** | Yes | PARTIAL-UI | **Pass 1** | COMPLETE | — |
| After-hours analytics route | Stub | — | Same API | — | Redirect | Yes | PARTIAL-UI | Redirect fix | COMPLETE | — |
| Call reasons chart | Outcomes table | `outcome` field | Analytics API | Derived | Dashboard table | Yes | PARTIAL-UI | Outcome breakdown | COMPLETE | Taxonomy = raw outcomes |
| Needs attention | `/voice/needs-attention` | Mixed | Platform loader | — | UI | Yes | PARTIAL-UI | + failed transfer | COMPLETE | — |
| Morning digest | Settings prefs? | `workspaceNotificationPrefs` | `notification_digest` job | In-app only | Email digest | Yes | PARTIAL-UI | **Audited** | **GENERIC INFRA** | Not Voice-specific product |
| Callback SLA overdue | Wizard SLA | metadata | Job scan | Notify | In-app | Yes | COMPLETE | — | COMPLETE | — |

---

## §15 — UI surface inventory (current)

| Route | What it actually does |
|-------|------------------------|
| `/voice/receptionist` + wizard | Primary **onboarding** for Appointment Receptionist / after-hours agent |
| `/voice/calls`, `/voice/calls/[id]` | Call list + detail (transcript, summary, recording, transfers, tools, gaps) |
| `/voice/knowledge` | KB CRUD, sources, upload, website scan, **knowledge gaps** |
| `/voice/analytics` | **Voice** metrics dashboard (not MCTB) |
| `/voice/needs-attention` | Callbacks, voicemail, MCTB replies, forms, **failed transfers** |
| `/voice/callback-requests` | Callback queue |
| `/voice/inbound-routing` | Number → handling mode |
| `/voice/agents/*` | Legacy/generic agent admin |
| `/voice/reports` | Cross-product (MCTB + SR + optional voice AI) |
| `/voice/billing` | Usage/billing |

### Capabilities too buried for final product (Pass 2 candidates — **do not move in Pass 1**)

| Capability | Why buried | Future home (proposed) |
|------------|------------|-------------------------|
| **Transfers / on-call / waterfall** | `EmergencyTransferEditor` inside wizard Call Handling | **Call Handling / Transfers** operational page |
| **After-hours notifications** | Wizard `AfterHoursNotificationsEditor` | Settings or Call Handling notifications |
| **On-call schedule** | Wizard `OnCallScheduleEditor` | With transfers page |
| **Spam / blocklist** | Wizard + APIs | Call Handling or Compliance |
| **Business hours / holidays** | Wizard operating maturity | Hours & coverage (operational) |
| **Recording / telephony** | Wizard telephony flags | Call Handling or agent settings |
| **Webhook endpoints** | Workspace/integration settings | Integrations (if not already) |

### Transfer page control inventory (for Pass 2 — verified in code)

- `voiceV2HumanTransferEnabled`, `transferRouting` (single vs waterfall)  
- `transferDestinations[]` (phone, label, enabled)  
- `transferPlanSteps[]` (order, mode warm/direct, ring seconds)  
- `transferRingSeconds`, per-step overrides  
- `transferFallback` (message / callback / voicemail behavior)  
- On-call schedule entries → `resolveActiveOnCallTarget`  
- After-hours `whenClosed` gating → `authorize-transfer.ts`  
- Urgency rules → transfer authorization  
- Emergency notification recipients → `afterHoursNotifications` events  
- Publish validation → `validateVoiceV3TransferPolicyForPublish`  
- Runtime: Python `transfer_executor.py` waterfall + warm consult  
- Outcomes: `VoiceTransfer` rows + `notifyVoiceV3TransferOutcome`

---

## §16 — Remaining certification matrix

| Test | Expected result | Evidence | PASS/FAIL |
|------|-----------------|----------|-----------|
| Normal after-hours PSTN call | Amy answers, intake/FAQ works | Call row + transcript | PENDING |
| Callback / message | `callbackRequest` or message outcome | DB + NA inbox | PENDING |
| Microsoft scheduling regression | FIND/BOOK unchanged | Script + one PSTN book | PENDING |
| Google scheduling | Book on connected calendar | Appointment + tool trace | PENDING |
| Direct transfer | Connected or explicit failure | `VoiceTransfer` + notification | PENDING |
| Warm transfer | Consult + bridge or fallback | Transfer logs + PSTN | PENDING |
| Waterfall | Sequential attempts | metadata `waterfall_attempt_count` | PENDING |
| No-answer / decline / exhausted | Fallback behavior | Outcome + caller experience | PENDING |
| Emergency / on-call | On-call dest used | Transfer + emergency email/SMS | PENDING |
| Carrier SCREEN / DECLINE | Policy honored | Screening metadata on call | PENDING |
| Solicitor | `report_unwanted_solicitor` outcome | Tool + block if configured | PENDING |
| Recording ingest | `VoiceRecording` READY | DB + storage URL | PENDING |
| Recording playback | Signed URL plays in UI | Browser + API | PENDING |
| Transcript | Native or Deepgram completed | `VoiceTranscript` | PENDING |
| Summary | Insight summary present | Call detail | PENDING |
| Completed-call email | Brevo delivery | Email + idempotency key | PENDING |
| Webhook | 2xx + queue row | Webhook delivery log | PENDING |
| Knowledge gaps UI | Open gap → resolve → KB source | UI + `voice_knowledge_sources` | PENDING |
| Voice analytics dashboard | Metrics load | `/voice/analytics` | PENDING |

---

## §17 — Final verdict

```
VOICE V3 CORE ARCHITECTURE CHANGED: NO

PARTIAL FEATURES REMAINING: 4
  - Voice ingress routing clarity (MCTB toggle → Voice V3 PSTN) — product/ops not code-only
  - Recording E2E — CERTIFICATION ONLY unless staging finds break
  - Google live book — CERTIFICATION ONLY
  - Morning digest as Voice product — classified GENERIC INFRA ONLY (not built as Voice-specific)

BACKEND-ONLY CUSTOMER FEATURES REMAINING: 0 (after knowledge-gap UI)

UI-ONLY UNWIRED FEATURES REMAINING: 0 for items in Pass 1 scope

CERTIFICATION-ONLY FEATURES:
  - Warm / direct / waterfall transfer
  - Emergency on-call PSTN
  - Google calendar PSTN book
  - Carrier Spam Likely SCREEN
  - Solicitor DECLINE on PSTN
  - Recording ingest + playback E2E
  - AI call recovery SMS E2E

CUSTOMER-SPECIFIC MANUAL SETUP REMAINING:
  - Outbound SMS number for booking link / recovery (wizard-gated)
  - Calendar OAuth (Google/Microsoft)
  - Telnyx screening / trunk for Spam Likely (platform)
  - LiveKit SIP outbound trunk for warm transfer (wizard warning)
  - Knowledge indexing / FileSearch vector stores

READY FOR UI INFORMATION-ARCHITECTURE PASS: YES
  (Transfer/on-call inventory documented; functional chain complete pending cert)

READY FOR PSTN CERTIFICATION: YES
  (After merging Pass 1; cert does not require nav reorg)

READY FOR SELF-SERVE PAID ACQUISITION: NO
  - PSTN certification matrix not executed
  - Ingress routing for Voice V3 on customer numbers must be verified per tenant
  - Recording playback E2E not proven
```

---

## §G — Digest audit

| Question | Answer |
|----------|--------|
| What produces it? | `processNotificationDigests()` in `src/lib/notifications/digest.ts` |
| Data | Unread **in-app** notifications per user/workspace |
| Voice V3 specific? | **No** — any `inAppNotification` rows |
| Scheduler | `notification_digest` job in `job-handlers.ts` (daily idempotency key) |
| Config | `workspaceNotificationPrefs.digestFrequency` + email |
| Classification | **3 — GENERIC INFRA ONLY** — not currently a Voice after-hours morning digest product |

Do **not** build competitor-style “morning digest” in Pass 1 without explicit product decision.

---

## §E — Recording path audit (unchanged architecture)

Chain: wizard `callRecording` → `startTelnyxRecordingForVoiceV3Call` → provider → `VoiceRecording` → call detail API → `WaveformRecordingPlayer`.

**Gap:** Formal cert shows no proven PSTN row with recording on LiveKit ingress path (`VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`).

**Classification:** **CERTIFICATION ONLY** unless staging finds a broken link before provider boundary.

---

## Change discipline confirmation

- Microsoft FIND/BOOK: **not modified**  
- MCTB platform sender: **not modified**  
- Transfer Python executor: **not modified**  
- Navigation / dedicated Transfers page: **not created**  
- Production deploy: **not performed** by this pass  

---

## Next steps (operator)

1. Merge Pass 1 branch.  
2. Run PSTN certification matrix (§16).  
3. **Pass 2:** Dedicated **Call Handling / Transfers** (and related operational pages) using control inventory above.  
4. Fix ingress documentation + UI for Voice V3 number connection if audit finds customer-facing gap.
