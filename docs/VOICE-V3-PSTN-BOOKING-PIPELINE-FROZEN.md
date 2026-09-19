# Voice V3 PSTN Microsoft booking pipeline (FROZEN)

**Pipeline ID:** `voice_v3_pstn_booking_microsoft_v1`  
**Frozen revision:** `2026-09-19-ws1-pstn-microsoft-book-cert`  
**Status:** PSTN-certified — **do not change booking behavior without explicit sign-off and re-cert**

**Certified call:** 2026-09-19, workspace `ws_1`, line `+15717491060`, live session `live_u7_EPmVEp3oMMiXmdMIv8epTgIJhqzfYrYZ`, deploy `d001625bb3b98834219b8ed48d34abc0dc59cd20`.  
**Forensics:** `/opt/cursor/artifacts/WS1-CALL-FORENSICS-live_u7_EPmVEp3oMMiXmdMIv8epTgIJhqzfYrYZ.md`

Constants: `src/lib/voice-v3/frozen-booking-pipeline.ts`  
Runtime path (detail): `docs/voice-v3/BOOKING-PIPELINE-RUNTIME-PATH.md`

---

## Frozen rule

**No changes** to the PSTN booking path below except bug fixes that restore this spec, or intentional recert with revision bump.

Do **not**:

- Route Voice V3 FIND/BOOK through Voice V2 Telnyx webhooks, `book_offered_slot`, `calendar_availability`, or `voice-receptionist-wizard/pipelines/*-certified`
- Reintroduce `emit_caller_meaning` / English NLP scheduling on the FIND path
- Swap production PSTN accept to a different config resolver (env-only test harness as default)
- Merge MCTB, Caller Amy, or mass-SMS booking into `src/lib/voice-v3/calendar/book-dispatch.ts`
- Add alternate “shadow” booking executors selected by undeclared env flags

**Allowed without recert:** wizard **presentation** compile (business name, hours, intake field labels) when FIND/BOOK/tool contracts unchanged. **Not allowed without recert:** tool schemas, revalidation rules, Microsoft commit path, scheduling normalizer semantics, offer-set lifecycle.

---

## Architecture (frozen)

```
PSTN → Telnyx → OpenAI SIP (gpt-live-1)
  → POST OpenAI live.transport.incoming
  → src/lib/voice-v3-basic/openai-live-webhook.ts
       resolveVoiceV3AgentConfigForAgent (wizard) or booking-agent-config fallback
       createVoiceV3CallRuntime → VOICE_V3_BOOKING_PIPELINE_ACTIVE (pipeline_id)
  → Live session accept + Astra delegation (gpt-6-astra)
  → Tools via executeVoiceTool:
       set_scheduling_preference → scheduling-normalizer
       find_availability → find-dispatch → microsoft-find-availability → offer set
       update_intake → intake objective (gates book)
       book_appointment → book-dispatch → revalidate → microsoft-create-booking → BOOKING_CONFIRMED
```

**Not in this pipeline:** `/api/telnyx/voice-v2/find-availability`, `/api/telnyx/voice-v2/book-offered-slot`, LiveKit voice booking, Agent John workflow tools.

**Shared read-only:** Microsoft Graph datetime helpers under `voice-v3/calendar/microsoft/*` (not Voice V2 booking executors).

---

## Certified behavior (2026-09-19)

| Step | Evidence |
|------|----------|
| Wizard config at accept | `VOICE_V3_AGENT_CONFIG_RESOLVED`, `config_source: wizard_published`, WS1 Cert Plumbing Co / Riley |
| Scheduling | First `set_scheduling_preference` may return `SCHEDULING_CLARIFICATION_REQUIRED`; retry with date succeeds |
| FIND | `find_availability` ~1.5s, `AVAILABILITY_OFFER_SET_CREATED`, 12 slots |
| Intake | Five `update_intake` calls → `INTAKE_OBJECTIVE_COMPLETED` |
| BOOK | `BOOKING_REVALIDATION_PASSED`, `MICROSOFT_EVENT_CREATED`, `BOOKING_CONFIRMED`, tool `confirmed` + `provider_event_id` |

---

## Verification

| Command | Purpose |
|---------|---------|
| `npm run test:voice-v3-booking-pipeline-frozen-contract` | Static lock on pipeline ID, files, imports, tool wiring (no HTTP) |
| `npm run verify:voice-v3-booking-pipeline-frozen` | Contract + pipeline boundary + booking unit suite |

After any change to `VOICE_V3_BOOKING_FROZEN_SOURCE_FILES`:

1. Run verify command above  
2. Place one **new** PSTN book on `+15717491060` (ws_1)  
3. Bump `VOICE_V3_BOOKING_FROZEN_REVISION` and baseline git SHA in `frozen-booking-pipeline.ts`  
4. Update this doc’s certified call reference  

---

## Isolation from other products

| Product | Boundary |
|---------|----------|
| **MCTB** | TeXML ingress only — no import from `lib/mctb/*` into voice-v3 calendar |
| **Voice V2 / Caller Amy** | No `voice-v2/pipelines` or Telnyx V2 booking routes from voice-v3 |
| **Mass texting** | No campaign booking; SMS tools are separate capabilities |

Enforced by `src/lib/voice-v3/pipeline-boundary.ts` and `scripts/test-voice-v3-pipeline-boundary.ts`.
