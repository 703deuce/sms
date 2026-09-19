# Voice V3 Wizard Compiler — PR #433 Verification Gate (Full Report)

**Repository:** `703deuce/sms`  
**Branch:** `cursor/voice-v3-wizard-compiler-2304`  
**Pull request:** [#433](https://github.com/703deuce/sms/pull/433)  
**Report date:** 2026-09-19 (UTC)  
**Status:** Leaf manifest + Step 7 V3 browser path implemented — **awaiting interactive Live audio certification**  
**Deploy:** Not performed  

---

## Executive summary

Wizard controls now map **1:1 at leaf granularity** (204 customer-editable paths, **UNMAPPED = 0**). Step 6 exposes all **22** GPT-Live built-in voices. Step 7 browser test uses **`client.live.create` (WebRTC)** with **`compileVoiceV3AgentConfig({ source: wizard_draft_test })`**, **`buildBasicLiveMediaSession`**, **`createVoiceV3CallRuntime`**, and **`attachVoiceV3LiveSideband`** — not Telnyx `build_for_test` / `AgentBrowserCall`.

| Gate check | Result | One-line reason |
|------------|--------|-----------------|
| **1 — Leaf manifest** | **PASS** | 204 editable leaf paths; exact manifest rows; `scripts/test-voice-v3-wizard-manifest-coverage.ts` |
| **2 — V3 draft test execution** | **PASS (wiring)** | `VoiceV3BrowserCall` + `/api/voice/agents/:id/v3-wizard-live-test`; static cert `test-voice-v3-wizard-step7-v3-path.ts` |
| **3 — Microsoft connection continuity** | **PASS** | FIND/BOOK use `runtime.config.calendar.connectionId` only |
| **Voice catalog** | **PASS** | 22 GPT-Live voices; `test-voice-v3-live-voice-catalog.ts` |

**PR #433 final merge gate: CONDITIONAL** — merge only after operator completes **PART Q** interactive browser Live audio session (mic) on staging/dev; do not deploy until then.

---

## Locked architecture (unchanged)

```
Appointment Receptionist Wizard snapshot (advanced.appointmentReceptionistWizard)
  → compileVoiceV3AgentConfig(wizard, providerConnections?, { source })
  → VoiceV3AgentConfig (canonical)
  → Amy: buildVoiceV3Prompts / live-frontend-instructions
  → Astra: delegation Responses + voice-tool-catalog
  → Runtime: VoiceV3CallRuntime.config (immutable per call at create)
  → PSTN: buildBasicLiveSessionAcceptParams → OpenAI sessions.accept
```

**Production V3 must not** call `compileVoiceV2IntakeSchema` or infer wizard meaning from V2.  
**V2** `buildWizardAgentConfig` / Telnyx sync may remain for legacy surfaces.

### Intake one-source-of-truth (confirmed)

```
wizard.collectFields[]
  → compileWizardCollectFieldsToV3Intake()
  → VoiceV3AgentConfig.intakeFields[]
  → Astra intake catalog + buildUpdateIntakeZodSchema()
  → per-call intake state + operationRequirements.book_appointment
  → BOOK precondition (getMissingFieldsForOperation)
```

Republish changes `intakeFields` without code deploy (certified in `scripts/test-voice-v3-wizard-republish-intake.ts`).

### Business hours (confirmed)

| Source | Amy (`business.hoursDisplay`) | FIND/BOOK (`businessHours`) |
|--------|------------------------------|-----------------------------|
| `operatingMaturity.businessSchedule.weekly` | Formatted via structured schedule (authoritative when present) | `businessHoursWindowFromWeeklySchedule` |
| `knowledgeItems[hours].summary` (prose) | Conversational fallback only if no structured schedule | **Never** |

Conflict: `business.hoursStructuredMeta.hoursProseConflictsWithStructured` (`business-hours-display.ts`).

### Services (confirmed)

- Canonical: `VoiceV3AgentConfig.services[]` from all **enabled** `appointmentTypes[]`.
- Compatibility: top-level `service` + `scheduling.primaryServiceId`.
- Runtime selection: `resolveBookingServiceForRuntime(config, ctx)` (intake `booking_service_id` / name match, else primary).

### OpenAI Live audio (no further work requested)

Evidence: `docs/VOICE-V3-OPENAI-LIVE-AUDIO-CONTROLS-EVIDENCE.md`  
API reference: [OpenAI Live TypeScript API](https://platform.openai.com/docs/api-reference/live)  
Package types: `node_modules/openai/resources/live/sessions.d.ts` (`SessionAcceptParams.Session.audio.output.voice` at startup only).

| Wizard | V3 | Live accept |
|--------|-----|-------------|
| `voiceId` | `telephony.liveVoiceId` | `session.audio.output.voice` |
| `speakingSpeed`, `responsiveness`, `interruptionSensitivity` | `telephony.liveAudioControls.*` | Stored; `executionSupport: UNSUPPORTED_BY_CURRENT_LIVE_API` |

GPT-Live is full-duplex with native interruption handling per OpenAI docs; wizard sliders are retained in config for future API fields, not invented on the wire.

---

## Manifest totals (current branch)

| Metric | Count |
|--------|------:|
| Manifest rows (`buildWizardV3FieldManifest`) | **183** |
| WIRED V3 config (all rows) | **183** |
| ACTIVE_EXECUTION | **86** |
| CONFIGURED_NOT_IMPLEMENTED | **77** |
| CONTROL_PLANE_ONLY | **17** |
| UNSUPPORTED_BY_CURRENT_LIVE_API | **3** |
| UNMAPPED (invariant) | **0** |

### Rows by wizard step

| Step | Label (wizard) | Row count |
|------|------------------|----------:|
| 0 | Meta (agentId, setupId, …) | 5 |
| 1 | Goals | 10 |
| 2 | Phone | 12 |
| 3 | Information (+ operating maturity detail) | 53 |
| 4 | Appointments | 36 |
| 5 | Call handling | 41 |
| 6 | Voice / persona | 19 |
| 7 | Test | 2 |
| 8 | Activate | 5 |

### Key source files

| File | Role |
|------|------|
| `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` | Generates all 183 manifest rows |
| `src/lib/voice-v3/config/wizard-v3-field-manifest.ts` | Exports `WIZARD_V3_FIELD_MANIFEST`, `WIZARD_V3_MANIFEST_SUMMARY` |
| `src/lib/voice-v3/config/wizard-required-control-paths.ts` | 37 nested paths requiring **exact** manifest `statePath` |
| `src/lib/voice-v3/config/wizard-manifest-invariant.ts` | `assertWizardManifestComplete()` |
| `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` | Canonical compiler |
| `src/lib/voice-v3/config/from-published-agent.ts` | Production resolver |
| `src/lib/voice-v3/config/resolve-wizard-snapshot-for-v3.ts` | TESTING → draftConfig wizard; ACTIVE → published |
| `docs/VOICE-V3-WIZARD-MIGRATION-REPORT.md` | Completion pass summary |
| `docs/VOICE-V3-WIZARD-FIELD-BY-FIELD-MIGRATION-PLAN.md` | Plan + totals |

---

# CHECK 1 — Manifest depth

## Verdict: **PASS**

## How the 146 → 183 count is produced

The count is **not** “one row per top-level state key.” It is produced by `buildWizardV3FieldManifest()` using explicit enumerations:

- **8** capability membership rows: `capabilities.{answer_questions|book_appointments|…}`
- **6** `bookingBehavior.*` keys
- **5** `collectFields[].{id|label|required|enabled|useForQualification}`
- **14** `appointmentTypes[].*` fields per type schema
- **8** transfer destination item fields + call-handling scalars + recovery + qualification field names
- **19** voice/persona/conversation behavior rows
- **37** additional operating-maturity nested paths (weekly per-day, after-hours, holidays, on-call entries) added during verification gate

Run locally:

```bash
npx tsx -e "
import { buildWizardV3FieldManifest, summarizeWizardV3Manifest } from './src/lib/voice-v3/config/wizard-v3-manifest-builder.ts';
const m = buildWizardV3FieldManifest();
console.log(summarizeWizardV3Manifest(m));
"
```

## What the invariant actually enforces

### Layer A — Top-level keys (weaker; original report wording)

`findUnmappedWizardStateKeys()`:

- Takes `Object.keys(createDefaultWizardState())`
- For each key `K`, passes if **any** manifest row satisfies `manifestCoversStatePath(K, row.statePath)` (prefix / `[]` rules)

This prevents a **new top-level** wizard field with no manifest mention.

### Layer B — Nested required controls (stronger; added in verification gate)

`findUnmappedRequiredControlPaths()`:

- For each path in `WIZARD_REQUIRED_CONTROL_PATHS` (37 paths), requires **exact** `statePath` equality in `WIZARD_V3_FIELD_MANIFEST`

Examples from `wizard-required-control-paths.ts`:

```
operatingMaturity.businessSchedule.weekly.monday.closed
operatingMaturity.businessSchedule.weekly.monday.ranges[].start
operatingMaturity.businessSchedule.weekly.monday.ranges[].end
… (×7 weekdays)
operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls
operatingMaturity.afterHoursBehavior.whenClosed.allowLiveBooking
… (×6 whenClosed keys)
operatingMaturity.businessSchedule.holidays[].id
… 
operatingMaturity.onCallSchedule.entries[].phoneE164
```

`assertWizardManifestComplete()` runs **both** layers.  
Certification: `scripts/test-voice-v3-wizard-manifest-coverage.ts`

## Five nested structures — sample manifest rows

### 1. `bookingBehavior.*`

```
bookingBehavior.askPreferredDayFirst
bookingBehavior.offerEarliestThree
bookingBehavior.confirmBeforeBooking
bookingBehavior.sendSmsAfterBooking
bookingBehavior.askServiceFirst
bookingBehavior.distinguishNewExisting
```

→ `scheduling.bookingBehavior.*` | execution: ACTIVE_EXECUTION

### 2. `collectFields[]`

```
collectFields[].id
collectFields[].label
collectFields[].required
collectFields[].enabled
collectFields[].useForQualification
```

→ `intakeFields[]` + `update_intake` schema | ACTIVE_EXECUTION

### 3. `appointmentTypes[]`

```
appointmentTypes[].durationMin
appointmentTypes[].enabled
appointmentTypes[].name
… (14 properties total)
```

→ `services[]` | duration/enabled ACTIVE; other fields CONFIGURED_NOT_IMPLEMENTED where not yet in FIND/BOOK

### 4. `transferDestinations[]`

```
transferDestinations[].id
transferDestinations[].label
transferDestinations[].phoneE164
transferDestinations[].enabled
```

→ `transferDestinations[]` + `transfer_call` enum | ACTIVE_EXECUTION

### 5. `operatingMaturity.businessSchedule.weekly.*`

Per day (monday–sunday):

```
operatingMaturity.businessSchedule.weekly.{day}.closed
operatingMaturity.businessSchedule.weekly.{day}.ranges[].start
operatingMaturity.businessSchedule.weekly.{day}.ranges[].end
```

Plus aggregate rows:

```
operatingMaturity.businessSchedule.weekly
operatingMaturity.businessSchedule.timezone
```

→ `businessHours` + Amy `hoursDisplay` | ACTIVE_EXECUTION for scheduling authority

## Repeatable collections rule

**Acceptable:** `collectFields[].required` (schema property), not a single `collectFields[]` row hiding children.  
The builder emits **property-level** rows for collect fields, appointment types, transfer destinations, knowledge item fields.

## Disclosed residual gap

The nested gate is only as complete as `WIZARD_REQUIRED_CONTROL_PATHS` + top-level coverage. Examples **not** in the 37-path required set (parent/scalar coverage only today):

- `qualificationRules[]` per-rule properties
- `urgencyRules[]` item fields
- `transferTriggers[]` (string checklist items)
- `guardrails[]` (free-text lines)

Adding a new nested UI control should: (1) add manifest row in `wizard-v3-manifest-builder.ts`, (2) add exact path to `wizard-required-control-paths.ts` if it must be gate-enforced.

## If a developer adds a wizard field without mapping

1. **Top-level key** → `assertWizardManifestComplete()` throws:  
   `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped top-level keys: …`
2. **Required nested path** → throws:  
   `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped nested controls: …`

---

# CHECK 2 — Actual V3 draft test execution

## Verdict: **FAIL** (browser); **PARTIAL PASS** (PSTN V3 + resolver/compiler)

## Requirement (restated)

Wizard Step 7 **test call** must exercise:

```
draft wizard
  → compileVoiceV3AgentConfig({ source: wizard_draft_test })
  → VoiceV3AgentConfig
  → same V3 prompt builders, tool catalog, runtime
  → Live session accept
```

Not merely attach metadata on a version while another stack drives audio.

## Path A — Browser WebRTC (Step 7 default UI)

| Step | File / symbol | What happens |
|------|----------------|--------------|
| 1 | `src/components/solutions/appointment-receptionist/steps/test-step.tsx` | `prepareLiveTest()` → `PATCH /api/voice/agents/:id` `build_for_test` |
| 2 | `src/lib/voice/agent-service.ts` | `buildVoiceAgentForTest` → `recompileReceptionistFromDraft` → `attachVoiceV3WizardTestCompilation` → **`syncAssistantToTelnyx`** |
| 3 | `src/lib/voice-v3/config/wizard-test-compilation.ts` | Runs `compileVoiceV3AgentConfig` but stores only **`voiceV3WizardTestCompilation` probe** (configVersion, agentName, intakeFieldKeys) on `advanced` — **not** consumed by WebRTC |
| 4 | `test-step.tsx` | Renders `AgentBrowserCall` with `telnyxAssistantId` |
| 5 | `src/components/voice/agent-browser-call.tsx` | Comment: *"Real browser ↔ Telnyx AI assistant … @telnyx/webrtc anonymous_login"* |

**Conclusion:** Category **B** for browser — probe/metadata + **Telnyx/V2 assistant** drives the conversation.

## Path B — PSTN OpenAI Live V3 (appointment receptionist)

| Step | File / symbol | What happens |
|------|----------------|--------------|
| 1 | `src/lib/voice/inbound.ts` | Routes to `startAppointmentReceptionistVoiceV3OnCall` |
| 2 | `src/lib/voice-v3/start-appointment-receptionist-pstn.ts` | SIP forward to OpenAI Live |
| 3 | `src/lib/voice-v3-basic/openai-live-webhook.ts` | `resolveVoiceV3AgentConfigForAgent` → `createVoiceV3CallRuntime({ config })` → `buildBasicLiveSessionAcceptParams` → `client.live.sessions.accept` |
| 4 | `src/lib/voice-v3/config/from-published-agent.ts` | Loads wizard via `resolveWizardSnapshotForVoiceV3` → `compileVoiceV3AgentConfig` |

**Conclusion:** Category **A** for **PSTN** test/production accept on appointment-receptionist agents.

## Fix applied during verification gate (PSTN draft only)

**File:** `src/lib/voice-v3/config/resolve-wizard-snapshot-for-v3.ts`

| Agent status | Wizard source | `compileVoiceV3AgentConfig` `source` |
|--------------|---------------|--------------------------------------|
| `TESTING` | `draftConfig.advanced.appointmentReceptionistWizard` (live draft) | `wizard_draft_test` |
| `ACTIVE` (etc.) | Published runtime config wizard snapshot | `wizard_published` |

This prevents TESTING PSTN from sticking to an old test **version** snapshot when the user edits the wizard in `draftConfig` without rebuilding.

**Does not** change browser Telnyx path.

## Draft vs published fixture (certified in script, not browser)

**Script:** `scripts/test-voice-v3-wizard-draft-vs-published-resolution.ts` — **PASS**

| Fixture | agentName | Required intake | Primary service duration |
|---------|-----------|-----------------|-------------------------|
| Published (ACTIVE resolver) | Amy | name only | 60 min |
| Draft test (TESTING resolver) | Jessica | name + project_type | 30 min |

Uses `resolveWizardSnapshotForVoiceV3` + `compileVoiceV3AgentConfig` — proves **compiler/resolver separation**, not Step 7 browser UI.

## What would clear Check 2

- Implement **OpenAI Live browser/WebRTC** test client (or fork session) that calls the same accept path as PSTN, **or**
- Document Step 7 browser as legacy Telnyx and require **“Call my phone”** PSTN for V3 draft validation until Live WebRTC exists.

No OpenAI Live WebRTC test component exists under `src/components` today (grep: no `live.sessions` in components).

---

# CHECK 3 — Microsoft connection continuity

## Verdict: **PASS**

## Wizard → compiler

1. User selects calendar in wizard: `calendarEmail` (and `calendarProvider` / `calendarConnected`).
2. `resolveVoiceV3AgentConfigForAgent` → `resolveMicrosoftProviderConnections(workspaceId, wizard)` in `from-published-agent.ts`.
3. `resolveMicrosoftConnectionForWizard(connections, wizard.calendarEmail)` in `resolve-microsoft-connection.ts`:
   - Exact match on `connection.name === calendarEmail` → pick **B**
   - Else first row in query order (documented fallback when no explicit email)
4. `compileVoiceV3AgentConfig` sets `calendar.connectionId` from `providerConnections.microsoftConnectionId`.

**Unit test:** `scripts/test-voice-v3-microsoft-connection-resolve.ts` — workspace A + B, wizard selects B → `conn_b`.

## Config → runtime snapshot

- `createVoiceV3CallRuntime({ config })` stores `runtime.config` including `calendar.connectionId` at creation (`call-runtime.ts`).
- Active call does not re-resolve wizard on republish (runtime holds startup config).

## FIND

**File:** `src/lib/voice-v3/calendar/find-dispatch.ts`

- Guard: `runtime.config.calendar?.connectionId`
- Load: `prisma.voiceCalendarConnection.findFirst({ where: { id: runtime.config.calendar!.connectionId, provider: "microsoft" } })`
- Graph: `fetchMicrosoftBusyIntervals({ connectionId: connection.id, … })`

No `findMany` + “first connection” for availability.

## BOOK (revalidation + create)

**File:** `src/lib/voice-v3/calendar/book-dispatch.ts`

- Revalidation busy fetch: `connectionId: runtime.config.calendar!.connectionId` (and hooks path uses `config.calendar!.connectionId`)
- Create: `findFirst` by same id → `executeMicrosoftCreateBooking({ connectionId: connection.id, … })`

FIND and BOOK for one call use the **same** `runtime.config.calendar.connectionId` set at accept.

**Static trace test:** `scripts/test-voice-v3-microsoft-connection-continuity.ts` — **PASS**

---

## Certification scripts (run all)

```bash
npx tsx scripts/test-voice-v3-wizard-manifest-coverage.ts
npx tsx scripts/test-voice-v3-business-hours-invariant.ts
npx tsx scripts/test-voice-v3-microsoft-connection-resolve.ts
npx tsx scripts/test-voice-v3-microsoft-connection-continuity.ts
npx tsx scripts/test-voice-v3-wizard-republish-intake.ts
npx tsx scripts/test-voice-v3-wizard-draft-vs-published-resolution.ts
npx tsx scripts/test-voice-v3-wizard-compiler.ts
npx tsx scripts/test-voice-v3-wizard-architecture-invariants.ts
npx tsx scripts/test-voice-v3-wizard-cert-matrix.ts
```

Expected: all print `PASS` (or exit 0).

---

## Production PSTN path (proof chain)

```
POST /api/openai/live/incoming (webhook)
  → openai-live-webhook.ts
  → resolveVoiceV3AgentConfigForAgent({ workspaceId, agentId })
  → compileVoiceV3AgentConfig
  → createVoiceV3CallRuntime({ config: acceptAgentConfig })
  → buildBasicLiveSessionAcceptParams(at, config)
  → client.live.sessions.accept(sessionId, acceptParams)
```

Env fallback when wizard missing: `VOICE_V3_BOOKING_AGENT_CONFIG` + telemetry `VOICE_V3_CONFIG_FALLBACK_USED`.

---

## Capability OFF (runtime, not just UI)

- Tool surface: `voice-tool-catalog.ts` → `isToolEnabledForConfig`
- Executor reject: `authorize-tool-for-config.ts` used in `book_appointment`, `find_availability`, `cancel_appointment`, `reschedule_appointment`, `transfer_call`

---

## Future execution (configured, not unmapped)

| Area | V3 section | executionStatus |
|------|------------|-----------------|
| Calendly / SEND_LINK / REQUEST_ONLY | `bookingStrategyDetail` | CONFIGURED_NOT_IMPLEMENTED (except MICROSOFT_365) |
| RAG | `knowledge.retrieval` | CONFIGURED_NOT_IMPLEMENTED |
| Qualification rules | `qualification` | CONFIGURED_NOT_IMPLEMENTED |
| CRM / memory | `integrations` | CONFIGURED_NOT_IMPLEMENTED |
| AI call recovery | `recovery` | CONFIGURED_NOT_IMPLEMENTED |
| Live sliders | `telephony.liveAudioControls` | UNSUPPORTED_BY_CURRENT_LIVE_API |

---

## Commits on branch (reference)

- `feat(voice-v3): wizard-to-V3 config compiler and consumers`
- `docs(voice-v3): add wizard field-by-field migration plan`
- `feat(voice-v3): complete wizard compiler manifest and certification`
- `fix(voice-v3): verification gate — nested manifest invariant and TESTING draft resolution` (`28c6035a`)

---

## PR #433 final merge gate (2026-09-19 pass)

| Metric | Value |
|--------|------:|
| `TOTAL_EDITABLE_LEAF_CONTROLS` | **204** |
| `TOTAL_V3_MAPPED_LEAF_CONTROLS` | **204** |
| `UNMAPPED` | **0** |
| Manifest rows (`WIZARD_V3_FIELD_MANIFEST`) | **209** |

### Destination totals (rows may list multiple destinations)

| Destination | Row references |
|-------------|---------------:|
| `DETERMINISTIC_CONFIG` | 155 |
| `ASTRA_BACKEND_CONTEXT` | 81 |
| `LIVE_FRONTEND_CONTEXT` | 70 |
| `PROVIDER_CONFIG` | 54 |
| `CONTROL_PLANE_ONLY` | 15 |
| `RAG_CONFIG` | 10 |
| `TOOL_API_DATA` | 5 |

Execution status (manifest rows): ACTIVE 86 · CONFIGURED_NOT_IMPLEMENTED 103 · CONTROL_PLANE 17 · UNSUPPORTED_BY_CURRENT_LIVE_API 3.

| Gate | Result |
|------|--------|
| `STEP_7_V3_LIVE_BROWSER_TEST` | **PASS (static wiring)** — interactive mic/audio not recorded in this run |
| `DRAFT_PUBLISHED_ISOLATION` | **PASS** (`test-voice-v3-wizard-draft-vs-published-resolution.ts`) |
| `MICROSOFT_CONNECTION_CONTINUITY` | **PASS** |
| `PRODUCTION_V3_WIZARD_DEPENDS_ON_V2_COMPILER` | **FALSE** |
| `STEP_7_V3_TEST_DEPENDS_ON_TELNYX_V2_ASSISTANT` | **FALSE** |
| `GPT_LIVE_BUILT_IN_VOICE_COUNT` | **22** |
| `WIZARD_V3_VOICE_PICKER_COUNT` | **22** |
| `ALL_GPT_LIVE_VOICES_SELECTABLE` | **PASS** |
| `VOICE_SELECTION_COMPILER_ROUNDTRIP` | **PASS** |
| `LEGACY_V2_VOICE_MAPPING_IN_V3_PATH` | **FALSE** (legacy `el:` ids normalize explicitly; no Telnyx voice mapping) |
| V3 booking regression suite | **PASS** (`test-voice-v3-wizard-cert-matrix.ts`) |

### **FINAL MERGE GATE: CONDITIONAL PASS**

Implementation complete. **Do not merge** until a human completes **PART Q** (browser Step 7 with draft Jessica/custom fields + Live audio + telemetry screenshot). **Do not deploy.**

---

## Download copy

This file is the canonical long-form report:

- **In repo:** `docs/VOICE-V3-PR433-VERIFICATION-GATE-FULL-REPORT.md`
- **Artifact copy:** `/opt/cursor/artifacts/VOICE-V3-PR433-VERIFICATION-GATE-FULL-REPORT.md`

Clone or download from GitHub at the path above on branch `cursor/voice-v3-wizard-compiler-2304`.
