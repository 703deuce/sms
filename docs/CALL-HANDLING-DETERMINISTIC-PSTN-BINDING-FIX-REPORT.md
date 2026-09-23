# Call Handling — deterministic PSTN wizard binding fix

**Status:** Source fix complete — **do not merge / deploy** until live PSTN matrix below.

**Branch:** `cursor/call-handling-ownership-switch-2304`

---

## 1. Files changed (this fix)

| File | Change |
|------|--------|
| `src/lib/voice-v3/resolve-pstn-wizard-binding.ts` | Explicit Call Handling agent bind + invalid explicit fail-safe |
| `src/lib/voice-v3/pstn-wizard-agent-selection.ts` | **New** — pure decision + legacy picker helper |
| `scripts/test-call-handling-pstn-wizard-binding.ts` | **New** — regression tests |
| `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md` | **New** — separate launch item (not implemented) |
| `docs/CALL-HANDLING-DETERMINISTIC-PSTN-BINDING-FIX-REPORT.md` | This report |

---

## 2. Resolver behavior before / after

**Before:** `To E.164` → workspace → published agents `updatedAt DESC` → first `isAppointmentReceptionistAgent` → `notePstnLegWizardContext`.

**After:**

1. Same `PhoneNumber` lookup (includes `settingsJson`).
2. If `activeCallHandler === "ai_receptionist"` **and** `hasExplicitCallHandlingSelection` **and** `parkedAiReceptionistAgentId` → validate agent → bind **that** id (`bindSource: explicit_call_handling`).
3. If explicit path applies but agent invalid → log `VOICE_V3_PSTN_EXPLICIT_CALL_HANDLING_AGENT_INVALID` → **no bind, no legacy fallback**.
4. Else → **unchanged** legacy recency loop (`bindSource: legacy_recency`).

Downstream (`telnyx-webhook-handler`, OpenAI Live accept, sessions, SIP) **unchanged**.

---

## 3. Validation on explicit agent ID

`isValidPublishedAppointmentReceptionist`:

- `voiceAgent` exists in resolved `workspaceId`
- `publishedVersionId` set
- `status === "ACTIVE"`
- `loadVoiceAgentRuntimeConfig` + `isAppointmentReceptionistAgent(cfg)`

---

## 4. Invalid explicit binding behavior

Same as **no successful bind** historically: function returns without `notePstnLegWizardContext`. Live accept may proceed with default config if `consumeRecentPstnLeg()` has no `agentId` (pre-existing behavior). **Does not** fall back to a newer receptionist when explicit Call Handling AI was requested but invalid.

---

## 5–7. Test results (source)

```bash
npx tsx scripts/test-call-handling-pstn-wizard-binding.ts
npx tsx scripts/test-call-handling-ownership.ts
```

| Test | Result |
|------|--------|
| Multiple receptionists (#123 explicit, #456 newer legacy) | **PASS** — explicit decision returns #123; legacy picker documented as #456 |
| Separate DID | **PASS** — resolver does not reference `phoneNumberId` / join tables (static) |
| Legacy / no explicit Call Handling | **PASS** — `decideExplicit` false when no `explicitSelectionAt` |
| MCTB active | **PASS** — explicit bind not attempted |
| Switch does not call `notePstnLegWizardContext` | **PASS** (static) |

DB-backed “wrong workspace / unpublished agent” validation is covered by `isValidPublishedAppointmentReceptionist` implementation; add integration tests if needed before PSTN cert.

---

## 8–9. Regression scripts

Run on this branch:

| Script | Result |
|--------|--------|
| `npx tsx scripts/test-call-handling-ownership.ts` | **PASS** |
| `npx tsx scripts/test-call-handling-pstn-wizard-binding.ts` | **PASS** |

Additional MCTB/V3 suite (run before merge): `test-mctb-final-pipeline-contract`, `test-voice-v3-wizard-step7-v3-path` — run in CI/local as usual (not re-run in this doc pass if environment-limited).

---

## 10–11. Confirmations

- **No agent phone associations changed** — no `syncVoiceAgentPhoneAssignment`, no `VoiceAgentPhoneNumber` writes in this fix.
- **No Voice V3 runtime architecture changed** — only `tryNotePstnWizardBindingFromToE164` binding selection; SIP forward and Live accept unchanged.

---

## 12. Source-readiness verdict

**Ready for live PSTN certification** of Call Handling + deterministic multi-receptionist binding, subject to:

1. Real call To ingress A with two published receptionists → **parked** agent answers.
2. MCTB ↔ AI ↔ MCTB on same ingress without CFNA change.
3. Publish AI while MCTB explicit → ingress stays MCTB (existing publish gate).
4. Split SMS sender unchanged by switch (separate platform/customer sender product work tracked in `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`).

**Merge/deploy first** (Coolify), then run PSTN checks on the environment that receives live Telnyx webhooks. PSTN certification cannot precede deployed code.

See **`docs/CALL-HANDLING-FINAL-SOURCE-REGRESSION-REPORT.md`** for full regression matrix and certification checklist.
