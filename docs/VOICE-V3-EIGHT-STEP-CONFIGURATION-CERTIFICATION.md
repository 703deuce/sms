# Voice V3 — Eight-step configuration → published runtime certification

**Status:** `VOICE_V3_CONFIGURATION_CERTIFIED: FAIL` (launch gate not met)  
**Branch context:** Receptionist editor consolidation (`cursor/receptionist-wizard-sidebar-nav-2304`)  
**Last updated:** 2026-09-27

This document defines the **required** certification standard and records what is **proven today** vs **still open**.

---

## Required standard (launch)

> Customer changes UI → saves → publishes/activates → **published** configuration changes → **next eligible inbound call** loads that configuration → LiveKit/GPT-Live session behaves accordingly.

209/209 leaf propagation (`scripts/test-voice-v3-wizard-backend-propagation.ts`) proves **contract-level** mapping when values are placed on wizard state. It does **not** prove UI wiring, reload, publish freshness on PSTN, or behavioral correctness on a real call.

---

## Publish / activate path (static trace)

| Stage | Code |
|-------|------|
| UI Activate | `activate-step.tsx` → `patch({ activationMode: "activate_now" })` → `onActivate` |
| Client | `persistReceptionistActivate()` → `POST /api/solutions/appointment-receptionist` `{ action: "activate", state: full wizard }` |
| Server | `route.ts`: activate **skips per-step merge** — full request body is authoritative |
| Persist + publish | `save-setup.ts` / agent service → new `voiceAgentVersion` + `publishedVersionId` |
| Production calls | `resolveVoiceV3LiveKitSession` → `resolveVoiceV3AgentConfigForAgent` **per inbound call** |
| Config load | `loadVoiceAgentRuntimeConfig` reads **`publishedVersionId` config** (no in-process cache in that loader) |
| TESTING calls | `resolveWizardSnapshotForVoiceV3` uses **draft** for browser test (`TESTING` status) |

**Config freshness expectation:** After successful activate, the **next** PSTN session should compile from the new `publishedVersionId` because each call re-queries Prisma. **Not live-proven in this pass.**

---

## Contract tests (automated)

Run:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-configuration-certification-contract.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:voice-v3-wizard-backend-propagation
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-draft-vs-published-resolution.ts
npx tsx scripts/test-wizard-merge-on-save.ts
```

Artifacts: `/opt/cursor/artifacts/voice-v3-configuration-certification/`

### Mandatory booking strategy switch (contract)

`test-voice-v3-configuration-certification-contract.ts` proves:

- `MICROSOFT_365` → `find_availability` / `book_appointment` authorized; `send_booking_link` **not** authorized (mismatch error).
- `SEND_LINK` + URL → `send_booking_link` authorized; direct book/find **not** authorized.
- Astra instructions mention `send_booking_link` for link strategy.
- Round-trip back to Microsoft re-enables direct book tools.

**Live PSTN Call C (owner scenario):** still **NOT_RUN** here.

---

## Parity items (spam / solicitor) — verified in code

| Control | Opus Step 5 UI | Mutation | Runtime consumer |
|---------|----------------|----------|-------------------|
| `spamLikelyPolicy` | `SpamUnwantedCallsEditor` radio group (`call-handling-step.tsx`, `presentation==="opus"`) | `patch({ spamLikelyPolicy })` | `compileVoiceV3AgentConfig` → `spamProtection`; inbound screening in `voice-v3-livekit.ts` + Telnyx sync jobs |
| Solicitors | Same editor — `solicitorPolicy` radios | `patch({ solicitorPolicy, salesSolicitationEnabled, salesSolicitationAction })` | `spamProtection.solicitorPolicy`; tool `report_unwanted_solicitor` via `isReportUnwantedSolicitorAuthorized` |

MCTB-only `salesSolicitationEnabled` toggle remains MCTB-only; Opus uses the richer editor.

---

## Control ledger

Generate machine-readable ledger:

```bash
PROPAGATION_REPORT=/opt/cursor/artifacts/voice-v3-wizard-backend-propagation/report.json \
  node scripts/generate-voice-v3-eight-step-control-ledger.mjs
```

Output: `control-ledger.json` with **one row per manifest leaf** (209+) plus operational and navigation rows.

**Important:** Manifest leaves are **state paths**, not every nested UI control (e.g. each transfer destination field). A second-phase UI scanner is required for exhaustive per-widget rows. Operational rows are included separately.

### Ledger status semantics (current pass)

| Status | Meaning |
|--------|---------|
| `PASS — RUNTIME (contract leaf propagation only)` | Leaf touched in `wizard-leaf-propagation-verify` — **not** full UI→reload→PSTN |
| `PASS — BACKEND/OPERATIONAL` | API wired statically; live action not run |
| `PASS — NAVIGATION` | URL/step sync only |
| `REQUIRES_CERT` | No propagation report / not tested |
| `FAIL — …` | Propagation cert failure |

---

## Live test matrix (required before PASS gate)

| Call | Scenario | Status |
|------|----------|--------|
| A | Knowledge / hours change → publish → ask on new call | **NOT_RUN** (manual PSTN) |
| B | Microsoft book | **NOT_RUN** |
| C | Switch to Send booking link → new call | **NOT_RUN** |
| D | Greeting / voice | **NOT_RUN** |
| E | Transfer destination | **NOT_RUN** |
| F | After-hours | **NOT_RUN** |

Cloud agent cannot execute Telnyx PSTN matrix; owner/staging required.

---

## Launch gate checklist (§23)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Every interactive element accounted for | **PARTIAL** — 209 leaves + ops; full UI decomposition pending |
| 2 | Runtime consumer for runtime-affecting settings | **PARTIAL** — contract propagation only |
| 3 | Save/reload per control | **NOT_RUN** |
| 4 | Cross-step save safety | **PASS** — `test-wizard-merge-on-save.ts` + contract merge case |
| 5 | Publish uses saved configuration | **STATIC PASS** — activate sends full state; **live NOT_RUN** |
| 6 | Next call resolves new publish | **STATIC PASS** — per-call `loadVoiceAgentRuntimeConfig`; **live NOT_RUN** |
| 7–13 | Provider switch, knowledge, voice, transfer, capabilities, dead buttons | **NOT_RUN** live |

---

## Verdict

```
VOICE_V3_CONFIGURATION_CERTIFIED: FAIL
```

**Blockers for launch certification:**

1. No per-control UI save/reload matrix executed.
2. No live PSTN matrix (especially booking strategy switch on **new session**).
3. Control ledger rows are manifest-leaf granularity until UI decomposition completes.

**Do not merge/deploy** on contract tests alone. Use this doc + artifacts to drive the live matrix on staging/production.
