# Voice V3 — Final Production Launch Certification Report

**Branch:** `cursor/voice-v3-runtime-gap-close-2304`  
**Generated:** 2026-09-27 (Cloud Agent)  
**Scope:** Implementation frozen — certification only (no merge/deploy authorized).

**Architecture acceptance (user):** CFNA after-hours ingress, hidden non-CFNA controls (`answerWhen`, `ringBehavior`, `ringTeamSeconds`, transfer AMD), cold/warm/waterfall transfer model, per-service BOOK required-fields gate.

---

## Executive result

| Overall | |
|--------|---|
| **VOICE_V3_LAUNCH_CERTIFICATION** | **NOT READY** |

**Why:** Static/contract gate has **6 failing suites** (see below). All **real PSTN / production-boundary** rows are **NOT RUN** in this environment (requires manual phone + tenant). Contract-level publish resolution passes; **PUBLISHED_CONFIG_FRESHNESS** on a live call is **NOT RUN**.

**Warm transfer infrastructure (production):** **Provisioned** — not `WARM_TRANSFER_PRODUCTION_BLOCKED`. Outbound LiveKit SIP trunk env + Telnyx outbound creds present on production web container; `audit-outbound-telephony` reports `outbound_trunk.ok: true` and Telnyx outbound voice profile `ready: true`. **Warm PSTN still requires a manual call** (NOT RUN).

---

## 1. Static / contract gate

**Runner:** `scripts/run-voice-v3-launch-static-gate.sh`  
**Log:** `/opt/cursor/artifacts/voice-v3-launch-cert/static-gate.log`

### Launch visibility (required)

| Check | Result | Evidence |
|-------|--------|----------|
| **VISIBLE_UNIMPLEMENTED** (`after_hours` launch preset) | **PASS (0)** | `VISIBLE_UNIMPLEMENTED_CONTROLS=0` in gap report; `CURRENT_VISIBLE_STILL_BROKEN: 0` |
| Runtime launch classification | PASS | `VOICE_V3_RUNTIME_LAUNCH_CLASSIFICATION=PASS` |
| Runtime launch gap report | PASS | `report-voice-v3-runtime-launch-gaps.ts` |

### Suite results (exact)

| Suite | Result | Notes |
|-------|--------|-------|
| `test-voice-v3-configuration-certification-contract` | PASS | Tool authorization / cross-step merge contracts |
| `test-voice-v3-wizard-backend-propagation` | **FAIL** | 2 scalar mismatches: `knowledgeSource`, `knowledgeBaseEnabled` |
| `test-voice-v3-send-booking-link-matrix` | PASS | |
| `test-voice-v3-transfer-cold-warm-cert` | PASS | Contract: COLD REFER vs WARM `WarmTransferTask` |
| `test-voice-v3-transfer-system` | PASS | Includes warm publish block without trunk |
| `test-voice-v3-transfer-wizard-state` | PASS | |
| `test-voice-v3-required-fields-book-gate` | PASS | Per-service BOOK gate |
| `test-voice-v3-livekit-bridge` | PASS | Session resolution bridge |
| `test-voice-v3-livekit-concurrency-cert` | PASS | |
| `test-voice-v3-microsoft-appointment-management` | **FAIL** | `MICROSOFT_AUTH_FAILED` / `FIND_FAILED` — no live Microsoft tenant in CI VM |
| `test-voice-v3-booking` (+ scene invariant) | PASS | |
| `test-voice-v3-knowledge-retrieval` | PASS | |
| `test-voice-v3-filesearch-session-cert` | PASS | RAG/session path |
| `test-voice-v3-business-hours-invariant` | PASS | Schedules / hours |
| `test-voice-v3-after-hours-notifications` | PASS | After-hours + notifications contract |
| `test-voice-v3-qualification-urgency` | PASS | |
| `test-voice-v3-callback-matrix` | PASS | |
| `test-voice-v3-callback-wizard-roundtrip` | PASS | |
| `test-voice-v3-post-call-closure` | PASS | Post-call artifact contracts |
| `test-voice-v3-wizard-draft-vs-published-resolution` | PASS | Publish resolution (contract) |
| `test-voice-v3-wizard-republish-intake` | PASS | |
| `test-wizard-pages-backend` | **FAIL** | `Invalid voice selection` — test fixture voice id not in curated list |
| `test-wizard-merge-on-save` | PASS | Cross-step preservation (merge-on-save) |
| `test-voice-v3-wizard-cert-matrix` | **FAIL** | `WIZARD_V3_MANIFEST_SUMMARY.unmapped === 4` (execution status `DEFERRED_NOT_EXPOSED` not counted in summary buckets — 4 hidden CFNA controls) |
| `test-voice-v3-wizard-compiler` | PASS* | *Fails if run **without** `preload-server-only`; gate script omitted preload on this row |
| `test-voice-v3-conversation-freshness` | PASS | |
| `test-voice-v3-booking-link-sms-isolation` | PASS | |
| `test-voice-v3-microsoft-connection-resolve` | PASS | |
| `test-voice-v3-architecture-invariants` | **FAIL** | Stale expectation: registry **11** tools vs **15** actual |
| `test-voice-v3-pipeline-boundary` | **FAIL** | `cancel-appointment-tool.ts` imports legacy `apply-caller-meaning` |

**Google integration:** No dedicated Voice V3 launch contract script in repo; **NOT RUN** (treat as out of launch-supported cert set unless product adds a script).

**Aggregate static/contract gate:** **FAIL** (6 suites above; 2 runner hygiene issues: compiler preload, booking line nesting).

---

## 2. Warm transfer production prerequisite

| Check | Production (Coolify web container) | Evidence |
|-------|-----------------------------------|----------|
| LiveKit env | OK | `livekit_env.ok: true` |
| Outbound SIP trunk resolvable | OK | `outbound_trunk.ok: true`, trunk id present (redacted) |
| Telnyx SIP outbound credentials | OK | `hasTelnyxCreds: true` |
| Telnyx outbound voice profile | OK | `ready: true`, US/CA destinations |
| **WARM_TRANSFER_PRODUCTION_BLOCKED** | **No** | Infrastructure prerequisite met; **PSTN warm path not exercised** |

Inbound trunk name lookup returned `ok: false` in production audit (listing by name); outbound trunk used env-stored id and succeeded. Does not block warm transfer if outbound id remains valid.

---

## 3. Save / reload & cross-step preservation

| Test | Result | Evidence |
|------|--------|----------|
| Editor merge-on-save (cross-step) | PASS | `test-wizard-merge-on-save.ts` |
| Eight-step page → backend mapping | **FAIL** | `test-wizard-pages-backend.ts` (voice fixture) |
| Configuration certification (save/reload contracts) | PASS | `test-voice-v3-configuration-certification-contract.ts` |
| Wizard backend propagation (compiler ↔ DB scalars) | **FAIL** | KB fields above |
| Full UI browser save/reload all 8 steps | **NOT RUN** | No local Next/browser per instructions |

---

## 4. Activate / publish freshness

| Layer | Result | Evidence |
|-------|--------|----------|
| Draft vs published resolution (contract) | PASS | `test-voice-v3-wizard-draft-vs-published-resolution.ts` |
| Republish intake | PASS | `test-voice-v3-wizard-republish-intake.ts` |
| **PUBLISHED_CONFIG_FRESHNESS** (live session after Activate) | **NOT RUN** | Requires PSTN + session version capture |

---

## 5–13. Real PSTN boundary tests

Cloud Agent **cannot** place CFNA calls or receive SMS. All rows **NOT RUN** unless noted.

| Boundary | Result | Blocker |
|----------|--------|---------|
| CFNA_PSTN | NOT RUN | Manual: business line → CFNA → Transovo DID → LiveKit → greeting |
| Greeting hot change (UI → Activate → call) | NOT RUN | Same |
| VOICE_KNOWLEDGE_RUNTIME | NOT RUN | Requires call + tool/log proof |
| MICROSOFT_BOOKING_E2E | NOT RUN | Requires Microsoft-connected workspace + PSTN |
| BOOKING_STRATEGY_HOT_SWITCH | NOT RUN | Requires PSTN + SMS receipt |
| CALLBACK_E2E | NOT RUN | Requires PSTN |
| COLD_TRANSFER_PSTN | NOT RUN | Requires PSTN + authorized DIRECT destination |
| WARM_TRANSFER_PSTN | NOT RUN | Infra OK; needs live warm lifecycle proof |
| WATERFALL_TRANSFER_PSTN | NOT RUN | After basic transfers; optional if waterfall hidden at launch |

---

## 14. Post-call (product surface)

| Area | Contract tests | PSTN / UI |
|------|----------------|-----------|
| Post-call closure | PASS (`test-voice-v3-post-call-closure.ts`) | NOT RUN |
| Recording | — | NOT RUN |
| Transcript | — | NOT RUN |
| Summary | — | NOT RUN |
| Calls list / intake / transfer history | — | NOT RUN |

---

## Final matrix

| System | Test | Result | Evidence | Blocker |
|--------|------|--------|----------|---------|
| Static/contract suite (aggregate) | Full gate | **FAIL** | `static-gate.log` | 6 failing scripts + 2 runner issues |
| Visible launch gaps | VISIBLE_UNIMPLEMENTED | **PASS** | 0 for `after_hours` | — |
| Warm trunk provisioning | Production prerequisite | **PASS** | `audit-outbound-telephony` on prod container | PSTN warm still NOT RUN |
| Save/reload | Wizard pages backend | **FAIL** | Invalid voice in test harness | Fix fixture or voice list alignment |
| Save/reload | KB propagation scalars | **FAIL** | `wizard_backend_propagation` | `knowledgeSource`, `knowledgeBaseEnabled` |
| Cross-step preservation | Merge on save | **PASS** | `test-wizard-merge-on-save.ts` | — |
| Publish freshness | Contract resolution | **PASS** | draft vs published scripts | — |
| Publish freshness | Live session | **NOT RUN** | — | PSTN after Activate |
| CFNA | PSTN | **NOT RUN** | — | Manual certification |
| Greeting hot change | PSTN | **NOT RUN** | — | Manual |
| Knowledge | PSTN + logs | **NOT RUN** | Contract: retrieval PASS | Manual |
| Microsoft booking | PSTN + Graph | **NOT RUN** | CI script FAIL (no auth) | Live tenant |
| Booking-link hot switch | PSTN + SMS | **NOT RUN** | Matrix PASS | Manual |
| Callback | PSTN | **NOT RUN** | Matrix PASS | Manual |
| Cold transfer | PSTN | **NOT RUN** | Cold/warm cert PASS | Manual |
| Warm transfer | PSTN | **NOT RUN** | Prod trunk OK | Manual lifecycle |
| Waterfall | PSTN | **NOT RUN** | Transfer certs PASS | Manual (if exposed) |
| Recording | Post-call | **NOT RUN** | — | Manual |
| Transcript | Post-call | **NOT RUN** | — | Manual |
| Summary | Post-call | **NOT RUN** | — | Manual |
| Post-call persistence | UI/API | **NOT RUN** | Closure contract PASS | Manual |

---

## Recommended next actions (no code changes in this pass)

1. **Manual PSTN checklist** (sections 5–13) on production workspace — one boundary at a time; capture call ids / session revisions without publishing ANI.
2. **Resolve static blockers** (optional small fixes, separate approval): KB scalar propagation test or implementation; refresh architecture-invariants tool count; pipeline-boundary on cancel tool; wizard cert matrix summary buckets for `DEFERRED_NOT_EXPOSED`; wizard-pages voice fixture.
3. **Microsoft E2E:** run `cert:voice-v3-microsoft-appointment-live` (or PSTN script) on machine with connected Microsoft calendar.
4. When all required rows are **PASS**, set **VOICE_V3_LAUNCH_CERTIFICATION: PASS** and proceed to **MCTB launch certification**.

---

## Artifacts

- Static gate log: `/opt/cursor/artifacts/voice-v3-launch-cert/static-gate.log`
- Gap report: `/opt/cursor/artifacts/voice-v3-runtime-launch-gaps/VOICE-V3-RUNTIME-LAUNCH-GAP-REPORT.md`
- CFNA architecture cert notes: `docs/VOICE-V3-CFNA-LAUNCH-CERTIFICATION.md`
