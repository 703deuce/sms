# Voice V3 gap reconciliation report

## 1. Starting master SHA

`d5db122e` (`origin/master` at integration start).

## 2. Integration candidate

Branch: `cursor/voice-v3-reconcile-gap-to-master-2304`  
Commit: *(see `git rev-parse HEAD` on branch after push)*

## 3. Recovered capabilities

| Capability | Source branch / commit | Integration method |
|------------|------------------------|-------------------|
| Urgency in transfer | gap-closure `d275f9c3` | Restored `authorize-transfer.ts` wiring |
| Urgency + callback SLA metadata | gap-closure | `execute-request-callback.ts` + `persist-voice-v3-callback-request.ts` |
| On-call + after-hours transfer gating | gap-closure | Same `authorize-transfer.ts` |
| AI Call Recovery SMS | gap-closure `post-call/ai-call-recovery-sms.ts` | New module + hook on **`runVoiceV3CallHistoryPostProcess`** (not gap processor) |
| Outbound SMS resolver | gap-closure | `sms/resolve-voice-v3-outbound-sms.ts` |
| Spam protection (publish + blocklist + APIs) | gap-closure + spam branch | `spam-protection/*`, publish hook in `agent-service.ts`, Prisma `VoiceCallerBlock` |
| `take_message` / `search_business_knowledge` | gap-closure `3e16d2b5` | Tools + catalog + `authorize-tool-for-config` (search only when no FileSearch ids) |
| Google Calendar provider | gap-closure `2c6599e6` | `calendar/google/*`, `calendar-provider-runtime.ts`, compile + `from-published-agent` + FIND/BOOK dispatch merge |
| Astra intake prompt fix | final-completion `f2b3f82b` | Cherry-picked (prompt + contract tests) |

## 4. Deliberately preserved (master wins)

| Surface | Why |
|---------|-----|
| `runVoiceV3CallHistoryPostProcess` + `call-history/*` | Newer recording/transcript/summary/Deepgram path |
| FileSearch / vector store RAG | Newer native GPT-Live architecture |
| `demo-config-fallback` / fail-closed ACTIVE resolution | Master security behavior |
| `persist-booking-after-confirmation` | Post-book persistence on master |
| `call-forensics` in LiveKit bridge | Master observability (gap removed it) |
| Full gap `processVoiceV3CompletedCall` tree | Would replace call-history pipeline |

## 5. Deliberately not restored

| Item | Reason |
|------|--------|
| Gap `processVoiceV3CompletedCall` as primary processor | Superseded by master call-history |
| Wholesale `voice-v3-livekit.ts` from gap | Would drop forensics + reasoning effort semantics |
| Final-completion `55e48438` bundle | Overlaps master crawl/forensics; needs file-by-file replay |
| Post-call webhooks / knowledge-gap persistence | Not wired in this pass (migrations added; no hook in call-history yet) |
| Calendly V3 | Genuinely unsupported |

## 6. Conflicts / resolution notes

| Area | Resolution |
|------|------------|
| Post-call | Side-effect hook only on master pipeline |
| Booking dispatch | Provider runtime for busy + create; kept `persistVoiceV3BookingAfterConfirmation` |
| `from-published-agent` | Added Google connections; **kept** demo-config-fallback |
| Knowledge | FileSearch primary; `search_business_knowledge` when no vector stores |
| Prisma | Added migrations for caller blocks + knowledge gaps + webhook columns; schema models added |

## 7. Tests run (integration candidate)

- `scripts/test-voice-v3-qualification-urgency.ts` — **PASS**
- `scripts/test-voice-v3-wizard-backend-propagation.ts` — **PASS**
- `npx prisma validate` — **PASS**

PSTN / production deploy: **not performed** (per instructions).

## 8. Updated wizard connectivity status (integrated candidate)

| Feature | Status |
|---------|--------|
| Urgency rules | **WORKING** (transfer route + callback severity metadata) |
| On-call schedule | **WORKING** (transfer auth injects on-call destination when gated) |
| After-hours `whenClosed` gating | **WORKING** (transfer path via `behavior-gating`) |
| AI Call Recovery SMS | **WORKING** (post-call hook; needs sender + wizard flags) / **EXTERNAL SETUP** for SMS number |
| Spam / solicitation | **PARTIAL** — publish + blocklist APIs; **LiveKit screening prompt/tool ingress not fully merged** |
| Google Calendar | **BUILT / NEEDS PSTN CERTIFICATION** (provider recovered; OAuth + live book sign-off) |
| Microsoft Calendar | **WORKING** (unchanged certified path) |
| REQUEST_ONLY | **WORKING** |
| SEND_LINK | **WORKING** (unchanged) |
| FileSearch RAG | **WORKING** when indexed + flag / **EXTERNAL SETUP** for ingest |
| Delegated `search_business_knowledge` | **WORKING** when retrieval on and no vector stores |
| `take_message` | **WORKING** when capability authorized |
| Callback SLA | **PARTIAL** — metadata on persist; overdue job exists; product SLA enforcement not certified |
| Warm / waterfall transfer | **PARTIAL** (unchanged; needs PSTN delta test) |
| Recording / transcript / summary | **WORKING** (master call-history) |
| Post-call staff notifications | **WORKING** (existing notify-* on events; not expanded to gap webhook bundle) |
| Calendly V3 | **GENUINELY NOT IMPLEMENTED** |
| Agent Quality Studio | **DISPLAY ONLY / DEFERRED** |

## 9. Remaining genuine gaps

- Calendly live V3 booking  
- Full gap post-call webhook + knowledge-gap **processing** wired to call-history completion  
- LiveKit spam screening + `report_unwanted_solicitor` native tool (gap-complete; needs surgical livekit merge)  
- Callback SLA operational enforcement narrative vs wizard copy  
- PSTN certification for Google + recovery SMS + spam policies  

## 10. Deployment

**No production deployment** as part of this reconciliation.
