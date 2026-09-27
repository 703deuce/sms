# Voice V3 — runtime launch gap reclassification

**Gate:** `npm run test:voice-v3-runtime-launch-classification` · **Report:** `npm run report:voice-v3-runtime-launch-gaps`

## What changed vs the 216-row connection list

The original export counted **~99 `CONFIGURED_NOT_IMPLEMENTED`** manifest leaves. That number mixed:

- Real customer-visible gaps
- Stale labels (runtime already wired — especially **Send Booking Link**)
- Calendly / CRM / long-term memory (out of V1 Voice scope)
- Child fields of parents that already execute (transfer plan step timeout, on-call entry fields)
- UI-only KB provisioning (website crawl) vs runtime RAG (`search_business_knowledge`)

We added **launch classification** (`wizard-v3-runtime-launch-classification.ts`) and remap manifest execution status after build so `CONFIGURED_NOT_IMPLEMENTED` means only **exposed launch gaps**.

### Corrected manifest totals (209 wizard leaves)

| Status | Count | Meaning |
|--------|------:|---------|
| ACTIVE_EXECUTION | 167 | Deterministic runtime or tool path |
| LIVE_PROMPT_CONTROL | 5 | GPT-Live instructions next session |
| CONTROL_PLANE_ONLY | 19 | Setup / persistence (unchanged) |
| CONFIGURED_NOT_IMPLEMENTED | **3** | Exposed gap per manifest rules |
| OUT_OF_SCOPE_RETIRED | 5 | Calendly + CRM |
| UI_METADATA_ONLY | 12 | KB setup / SLA display |
| HIDDEN_STATE_ONLY | 3 | Internal ids / legacy flags |

**Send Booking Link:** `bookingLinkUrl` and `bookingLinkLabel` are **ACTIVE_EXECUTION** — consumed by `resolveSendLinkConfig`, `executeSendBookingLink`, and `send_booking_link` authorization. P0 contract: `npm run test:voice-v3-send-booking-link-matrix` and `test:voice-v3-configuration-certification-contract`.

**LIVE_PROMPT_CONTROL:** Export now marks **Live agent after Activate = YES** (instructions on next GPT-Live session), not “control plane only.”

## Visible launch blockers (4 feature families)

These are the narrowed **VISIBLE_UNIMPLEMENTED** set from launch classification (not 99):

1. **`answerWhen`** — compiled but LiveKit ingress does not gate answer timing.
2. **`ringBehavior` / `ring_team_first`** — compiled but ingress does not honor ring-team semantics.
3. **`detectVoicemailOnTransfer`** — compiled on `callHandling`; V3 transfer authorization payload does not pass AMD to the LiveKit worker (legacy `lib/voice/transfers.ts` only).
4. **`appointmentTypes[].requiredFields[]`** — per-service required intake not fully enforced on `book_appointment`.

Everything else previously listed as “not implemented” in the manifest worksheet is either **already executing** (after-hours gating, holidays, on-call, qualification, urgency, transfer waterfall, outbound SMS, AI call recovery post-call, etc.) or **reclassified** out of launch scope / UI-metadata.

## Knowledge / RAG

| Control | Launch classification | Runtime |
|---------|----------------------|---------|
| `knowledgeItems[]` | ACTIVE | Hot context in Amy instructions |
| `linkedKnowledgeBaseId`, `knowledgeBaseEnabled` | ACTIVE | `search_business_knowledge` + retrieval compile |
| `websiteUrl`, `knowledgeSource` | UI_METADATA | Indexes KB; not a per-call tool argument |

## Next implementation order (suggested)

1. Transfer AMD on V3 LiveKit path (`detectVoicemailOnTransfer`)
2. Ingress / control-plane: `answerWhen`, `ringBehavior`
3. Per-appointment-type required fields gate on `book_appointment`

Do **not** implement Calendly, CRM, or long-term memory for standard Voice V1 launch unless product scope changes.
