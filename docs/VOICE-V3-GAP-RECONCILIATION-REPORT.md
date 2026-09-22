# Voice V3 gap reconciliation report

## 1. Starting master SHA

`d5db122e` (`origin/master` at integration start).

## 2. Integration candidate

Branch: `cursor/voice-v3-reconcile-gap-to-master-2304`  
Integration commit: `0ff5d1df` (`feat(voice-v3): reconcile gap-closure capabilities onto master`)  
Branch HEAD (docs pin): `0072e59e`

**Merge to `master`:** not performed. This document is the pre-merge zero-loss gate.

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

---

## 11. Zero-loss verification (pre-`master` merge gate)

Verified after `git fetch origin --prune` on **2026-09-22**.

### 11.1 Git

| Item | SHA / value |
|------|-------------|
| Current `origin/master` | `d5db122e5854f00ae8cd5aed60d93ebe8073a6d4` |
| Reconciliation integration commit | `0ff5d1df` |
| Final integration candidate (branch HEAD) | `0072e59ee244ea5e65584ed8973c19e52d0ba72a` |
| Merge base (`master` ∩ candidate) | `d5db122e` |
| Commits on `master` not in candidate | **0** (master has not advanced past reconciliation base) |
| Commits on candidate not in `master` | `0ff5d1df`, `0072e59e` |
| Integration model | **Additive:** branch created from `d5db122e`; delta applied on top — **not** wholesale gap-closure merge |

If `origin/master` advances before merge, **rebase or cherry-pick `0ff5d1df` onto the new master** and re-run this section (especially deletions and website/legal byte-compare).

### 11.2 `origin/master` → final candidate diff

| Metric | Result |
|--------|--------|
| Files changed | **59** |
| Insertions / deletions | **+3915 / −161** (edits only; no tree removals) |
| **Deleted files** (`--diff-filter=D`) | **none** |
| **Renamed files** (`--diff-filter=R`) | **none** |
| Existing Prisma migrations removed | **none** (master: 21 dirs → candidate: 24 dirs) |

**Migrations added (additive only):**

- `prisma/migrations/20260920120000_voice_knowledge_gaps/`
- `prisma/migrations/20260920194500_voice_v3_caller_blocklist/`
- `prisma/migrations/20260920210000_voice_post_call_webhooks_blocks/`

**Changed-file summary (by area):**

- Docs: `VOICE-V3-GAP-RECONCILIATION-PLAN.md`, `VOICE-V3-GAP-RECONCILIATION-REPORT.md`
- Prisma: schema + 3 migrations (above)
- Voice V3: calendar/google/*, provider runtime, FIND/BOOK dispatch, transfer auth, callback persist, post-call recovery SMS, tools (take_message, search_business_knowledge), spam-protection/*, webhooks/*, config compile/from-published, Astra intake prompts + tests
- APIs: `blocked-callers`, `block-caller`
- UI glue: `spam-unwanted-calls-editor.tsx`
- Telnyx: `telnyx-spam-header-trunk.ts`
- `agent-service.ts`: spam publish sync hook
- `package.json`: adds `test-voice-v3-astra-intake-prompt-contract.ts` to `test:voice-v3-intake`

Full path list: `git diff --name-only origin/master...origin/cursor/voice-v3-reconcile-gap-to-master-2304`

### 11.3 Website / legal bundle (master wins — verified identical)

Byte-identical between `origin/master` and candidate:

| Surface | Path |
|---------|------|
| MCTB marketing homepage | `src/app/page.tsx` |
| Appointments marketing | `src/app/(public)/appointments/page.tsx` |
| Opt-in documentation | `src/app/opt-in-documentation/page.tsx` |
| Opt-in diagram asset | `src/components/landing/mctb/mctb-opt-in-flow-diagram.jpg` |
| Privacy | `src/app/privacy/page.tsx` |
| Terms | `src/app/terms/page.tsx` |
| SMS opt-in | `src/app/sms-opt-in/page.tsx` |
| Middleware | `src/middleware.ts` |

### 11.4 MCTB / product surfaces (verified identical)

| Route / area | Path | Status |
|--------------|------|--------|
| MCTB overview | `src/app/(app)/mctb/page.tsx` | identical |
| MCTB voice agent wizard | `src/app/(app)/mctb/voice-agent/page.tsx` | identical |

No candidate diff touches MCTB marketing, setup, or SMS platform routes outside Voice V3 lib changes.

### 11.5 Protected master implementations (verified on candidate)

| Requirement | Verification |
|-------------|--------------|
| Call history pipeline | `runVoiceV3CallHistoryPostProcess` remains primary; **no** `processVoiceV3CompletedCall` |
| AI recovery hook | `maybeSendVoiceV3AiCallRecoverySms` called from `post-call-pipeline.ts` |
| Native FileSearch | `resolve-agent-knowledge-retrieval.ts` **unchanged** vs master; `useGptLiveFileSearchRag` present |
| Microsoft booking | `persist-booking-after-confirmation` still referenced from `book-dispatch.ts` |
| LiveKit bridge | `voice-v3-livekit.ts` **not** in changed-file set (forensics/telemetry preserved) |
| ACTIVE agent safety | `from-published-agent` diff adds Google connections only; env/demo fallback path retained |

### 11.6 Recovered Voice capability (present on candidate)

| Capability | Evidence on candidate |
|------------|----------------------|
| Urgency rules / transfer auth | `urgency/evaluate-urgency.ts`, `transfer/authorize-transfer.ts` |
| On-call + after-hours gating | `authorize-transfer.ts` + behavior gating imports |
| AI Call Recovery SMS | `post-call/ai-call-recovery-sms.ts` + pipeline hook |
| Outbound SMS resolver | `sms/resolve-voice-v3-outbound-sms.ts` |
| Google Calendar V3 | `calendar/google/*`, `calendar-provider-runtime.ts`, compile/from-published |
| `take_message` | `tools/take-message-tool.ts`, catalog + authorization |
| `search_business_knowledge` fallback | `knowledge/execute-search-business-knowledge.ts`, catalog gating |
| Spam / blocklist | `spam-protection/*`, Prisma `VoiceCallerBlock`, APIs, publish hook |
| Callback SLA metadata | `callback/persist-voice-v3-callback-request.ts`, `execute-request-callback.ts` |
| Astra intake prompt fix | Cherry-pick `f2b3f82b` (prompt + `test-voice-v3-astra-intake-*`) |

### 11.7 STOP condition

**Unexpected deletions:** none → **proceed to human review** (not auto-merge).

**Master merge / deploy:** blocked until explicit approval after this report.

### 11.8 Remaining gaps (unchanged — report separately)

- LiveKit spam/solicitor screening completion (`report_unwanted_solicitor` ingress)
- Google Calendar PSTN certification
- AI Call Recovery PSTN certification
- Warm/waterfall transfer PSTN certification
- Callback SLA full enforcement (metadata only on candidate)
- Calendly V3 unsupported
- Agent Quality Studio deferred
- Post-call webhook + knowledge-gap **processing** hooks on call-history (migrations/schema present; not fully wired)
