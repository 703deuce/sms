# Transovo continuation audit (Oct 20 handoff)

This is a **code-and-docs gap report**, not another repo tour. Product decisions from the Oct 20 handoff are treated as the target state; implementation state is what is in `new-app/` on `master` as audited.

---

## Executive summary

| Area | Verdict |
|------|--------|
| **Phone** | **Largely wired** — 41 `app/api/phone/*` routes, server-driven overview, WebRTC shell, forwarding/ring-group runtime on **Call Control** numbers. Not uniformly production-proven. |
| **Conversational IVR (Oct 20 direction)** | **Partially prepared, not productized.** The four tools exist and work in the Voice V3 stack, but UI still says **AI Receptionist**, defaults still enable **live booking**, and there is **no “Conversational IVR” rename or launch profile** in the tree. |
| **Voice hardening (P1)** | **Real gaps** — Python worker expects internal API actions that **new-app does not implement**; message-taking has a **callback-gate bug**; transfer outcomes may not persist when production points at `transovo.ai`. |
| **MCTB** | **UI + policy hooks only** in new-app; **proven runtime remains monolith** (`src/app/api/telnyx/voice/mctb-*`, `src/lib/mctb/*`). Do not touch Telnyx routing until Phone/IVR path is stable. |

---

## A. What is implemented (evidence)

### Phone (primary launch product)

**Backend surface (real, not mock):**

- Routes under `new-app/app/api/phone/**` — calls, WebRTC token, forwarding, auto-attendant, power dialer, voicemail, analytics, readiness, routing, transfer, etc.
- Overview is **server-rendered against DB**: `new-app/app/app/phone/page.tsx` calls `getOverviewMetrics`, `listCalls`, `getPhoneReadiness`, `loadOwnedNumbers`, etc.
- Completion narrative: `docs/NEW-APP-PHONE-COMPLETION.md` (dated 2026-10-19) — aligns with current code (contrast: `docs/NEW-APP-PHONE-WIRING-AUDIT.md` is **stale** — it claims zero phone APIs).

**Call forwarding / ring groups (Call Control path):**

- Ring groups resolve members and call `startForwardingFlow` with **simultaneous** or **sequential** queues — `new-app/lib/server/phone/routing/menu-executor.ts` (ring_group) + `forwarding-service.ts` (dial all legs vs first + `sequentialQueue`).
- Webhook continuation for sequential/simultaneous race: `routing-webhook.ts`, `routing-logic.ts`.

**Shared routing store:**

- `workspaceCallRouting.policyJson` via `new-app/lib/server/phone/routing.ts` — includes `mctbEnabled`, `aiCoverage`, `receptionistAgentId` (comment: extension point for AI/MCTB).
- Per-number answering policy: `resolve-effective-policy.ts`, forwarding store/APIs.

**Number / product switching:**

- `new-app/lib/server/telephony/switch-product.ts` — `shared_voice` merges `receptionistAgentId` + `aiCoverage` into workspace policy while moving carrier ingress for Voice V3.

### Voice / “receptionist” runtime (foundation for Conversational IVR)

**LiveKit session + publish path:**

- `resolveNativeVoiceV3LiveKitSession` — published bundle only for PSTN, creates `voiceCall` row, builds tool list from catalog ∩ `bundle.runtime.toolNames` — `new-app/lib/server/voice-v3/resolve-livekit-session.ts`.
- Editor → runtime: `compilePublishedBundle` / `enabledVoiceToolNamesFromEditor` — `new-app/lib/server/receptionist/compile-runtime.ts`, `editor-screen-mapping.ts`.
- Python worker executes tools via `POST /api/internal/voice-runtime` — `voice-runtime-python/.../backend_client.py`.

**Intended IVR tools (all present in code):**

| Tool | Implementation |
|------|----------------|
| `end_call` | `voice-v3/tools/end-call-tool.ts` |
| `search_business_knowledge` | DB FAQ search — `voice-v3/knowledge/search.ts`, `execute-search-business-knowledge.ts` |
| `transfer_call` | Authorize in TS — `transfer-call-tool.ts`, `authorize-transfer.ts`; **execute on wire in Python** — `transfer_executor.py` |
| `take_message` | `take-message-tool.ts` → persistence path via callback stack (see gaps) |

**Receptionist UI/API (still “AI Receptionist”):**

- Nav: `new-app/lib/nav.ts` — product title **AI Receptionist**, includes **Appointments**.
- Overview uses live APIs: `fetchReceptionistOverview` — `components/receptionist/overview-page-content.tsx`.
- Calls list/detail from `voiceCall` + tool executions — `receptionist/calls-service.ts`.

### MCTB (new-app)

- Pages: `/app/mctb/*` (overview, calls, conversations, recovery, analytics).
- Small shared helpers: `new-app/lib/mctb/*` (e.g. booking link URL validation).
- Telephony binding model: `mctb_texml` in `telephony/bindings.ts`, `switch-product.ts`, `product-routes.ts`.
- **No** `new-app/app/api/mctb/*` and **no** eligibility/SMS/TeXML engine in new-app.

---

## B. Conversational IVR conversion — what the repo actually shows

Oct 20 product decision is **not fully reflected in code**:

| Claim (handoff) | Repo state |
|-----------------|------------|
| Renamed to Conversational IVR | **No** string/branding; nav still **AI Receptionist** |
| Active tools = 4 only | **Capability-gated**, not IVR-default: `DEFAULT_AGENT` has `book`, `reschedule`, `cancel`, `smsConfirm` on — `new-app/lib/agent.ts` |
| Booking/intake removed from active behavior | **Still default-on**; publish gate **requires calendar** when `book` + `live` — `publish-gate.ts`, `validateEditorForPublish` |
| Semantic routing to phone system | Transfer targets come from **editor `transfers[]`**, not Phone **forwarding destinations** / departments — separate config surfaces |
| Conversion “done” | **Infrastructure only** (tools, KB search, transfer authorize + Python executor). **Product defaults + UI + worker API parity** incomplete |

There *is* a test fixture for IVR-like tooling (`wizard_booking_disabled` — answer + message + transfer only) in `capability-parity-audit.ts`, but it is **not** the default editor or publish template.

---

## C. Priority hardening gaps (where to continue)

### P1 — Transfers

**Works in principle:** Tool returns `transfer_authorized` + `execution` plan; Python runs direct/warm SIP transfer — `voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py`.

**Gap — outcome persistence on new-app:**

- Worker calls `record_voice_v3_transfer_outcome` — `transfer_executor.py`.
- **Monolith** implements it: `src/app/api/internal/voice-runtime/route.ts` → `record-voice-v3-transfer-outcome-for-python.ts`.
- **new-app** internal route **does not** — only 6 actions in `new-app/app/api/internal/voice-runtime/route.ts`.

**Expected fix:** Port `recordVoiceV3TransferOutcomeForPython` (and notifications) into `new-app/lib/server/...` and add the `case` to new-app’s voice-runtime route. Until then, transfers may **connect on the wire** but **call records / UI / notifications** can be wrong when `TRANSOVO_BACKEND_URL` is `transovo.ai`.

**Gap — routing authority:** Conversational IVR must transfer to **Phone-configured** PSTN destinations (ring groups, external forward). Today Voice uses **`editor.transfers`** compiled in `compile-transfer-from-editor.ts`, not `forwardingDestination` / ring group rows.

---

### P2 — Ring groups

**For Phone (Call Control):** Simultaneous + sequential appear **implemented** in `forwarding-service.ts` + webhook follow-up — not “first member only.”

**Caveat:** Effective forwarding runs only when `telephony.routingMode === "telnyx_call_control"` — `resolve-effective-policy.ts`. Numbers on **`livekit_sip`** (typical Conversational IVR ingress) **do not** use this path; `resolve-destination.ts` marks `livekit_sip` / `mctb_texml` as unsupported for Phone forwarding resolution.

**Product implication:** “Ring staff, then AI overflow” in UI (`call-handling.tsx`, `staffFirstSec`) is **not** one PSTN leg on a LiveKit-assigned DID — consistent with `docs/NEW-APP-VOICE-ROUTING-PHONE-MCTB-RECEPTIONIST-EXPLAINED.md`, but **not** the integrated story customers may expect.

---

### P3 — Message taking

**Persistence path exists** for callbacks: `persistVoiceV3CallbackRequest` → `callbackRequest` table.

**Bug — `take_message` gated like callback:**

In `new-app/lib/server/voice-v3/callback/execute-request-callback.ts`, `executeRequestCallback` returns `not_available` when `!config.callHandling.callbackRequestsEnabled`.

`take_message` calls `executeRequestCallback` — `take-message-tool.ts` — but authorization only checks `capabilities.takeMessages`, **not** `callbackRequestsEnabled`. Message taking can **silently fail** when callbacks are disabled in call handling.

**UX gap:** No obvious receptionist call-detail surfacing of “message left” (grep shows no `take_message` / `callbackRequest` in `components/`).

---

### P4 — Call finalization

**Implemented:** `finalizeVoiceV3Call` updates `voiceCall`, transcript, recording, intent — `post-call/finalize.ts`.

**Risks:**

1. Session bootstrap: `voiceCall.create(...).catch(() => undefined)` — `resolve-livekit-session.ts` — finalize then returns **`not_found`** with no surfaced error.
2. Worker may call **`append_voice_v3_forensic_events`** — `tool_client.py` — **not** on new-app voice-runtime route (same class of gap as transfer outcomes).
3. Confirm whether Python always invokes `finalize_voice_v3_call` on hangup (trace in worker entrypoint — not fully audited in this pass).

---

### P5 — Business knowledge

**Real DB path:** `voiceKnowledgeBase` + `voiceKnowledgeSource` FAQ rows — `knowledge/search.ts`.

**Publish gate** requires KB when `capabilities.answer` — `publish-gate.ts`.

**Not demo-hardcoded** for runtime search; editor defaults still contain **demo dental copy** in `DEFAULT_AGENT` (`lib/agent.ts`) — new workspaces inherit that until replaced.

**Vector / file-search path:** Catalog enables `search_business_knowledge` when vector store IDs empty; RAG path exists in `gpt-live-file-search-rag.ts` for other configs.

---

### P6 — Publication / activation / worker parity

**Publish → PSTN:** Requires `publishedVersionId`; session loads `newAppReceptionist` bundle — good.

**Tool surface at runtime:** `toolSchemas = catalogTools.filter(t => allowed.has(t.name))` where `allowed` = `enabledVoiceToolNamesFromEditor` — so **published editor capabilities** still control booking tools unless you change defaults/editor/publish template for Conversational IVR.

**Worker ↔ web contract (critical for production on transovo.ai):**

| Action | Monolith | new-app |
|--------|----------|---------|
| `resolve_voice_v3_livekit_session` | ✓ | ✓ |
| `execute_voice_v3_livekit_tool` | ✓ | ✓ |
| `finalize_voice_v3_call` | ✓ | ✓ |
| `record_voice_v3_transfer_outcome` | ✓ | **✗** |
| `append_voice_v3_forensic_events` | ✓ | **✗** (likely) |

Verify `TRANSOVO_BACKEND_URL` on the voice worker points at the same app that serves these routes (docs still mention `app.transovo.ai` in places).

---

## D. Shared routing authority & MCTB eligibility

**Single policy JSON:** `workspaceCallRouting` — phone + flags for MCTB/AI — `routing.ts`.

**Per-number telephony record:** `routingMode`: `livekit_sip` | `telnyx_call_control` | `mctb_texml` — `telephony-record.ts`, `bindings.ts`.

**Conflict (by design today):**

- One Telnyx `connection_id` per DID.
- Phone forwarding executor **explicitly skips** LiveKit/MCTB modes — `resolve-destination.ts`.
- MCTB recovery eligibility, press-1, SMS — **not implemented in new-app**; monolith owns webhooks under `src/app/api/telnyx/voice/mctb-*`.
- `mctbEnabled` in policy is a **flag only** until a port connects missed-call classification on the **same** `HumanCall` / `voiceCall` identity (today: separate worlds for Phone vs Voice V3).

**Do not** add a second routing engine; extend **`workspaceCallRouting` + per-number policy + telephony bindings** and port MCTB **eligibility rules** from monolith when ready.

---

## E. MCTB migration dependencies (after Phone/IVR hardening)

| Layer | Status |
|-------|--------|
| new-app UI | Mostly **fixture-driven** (`lib/data.ts`) on overview/home/MCTB pages |
| APIs | **Monolith** — e.g. `src/app/api/mctb/*`, Telnyx TeXML ingress |
| Platform sender / consent | Monolith `src/lib/mctb/*` |
| new-app prep | Bindings, switch to `mctb_texml`, booking-link validator |

**Preserve:** TeXML certified pipeline (`docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`), platform sender, suppression — port handlers into `new-app/app/api` + `lib/server/mctb` without rewriting logic.

---

## F. Recommended next coding pass (ordered)

1. **Worker API parity (new-app)** — Port `record_voice_v3_transfer_outcome` (+ transfer notifications) and `append_voice_v3_forensic_events` from `src/lib/voice/python-runtime-bridge/*` into `new-app/lib/server/...` and extend `app/api/internal/voice-runtime/route.ts`. *Result:* transfers and forensics match monolith contract when backend is transovo.ai.

2. **Fix `take_message` persistence** — Separate message-taking from `callbackRequestsEnabled` (dedicated persist or shared “staff message” model); fix `mergeDialogActiveGoalFromTool(..., "REQUEST_CALLBACK")` in `take-message-tool.ts`. *Result:* tool success = DB row; visible on call detail or inbox.

3. **Conversational IVR launch profile (product, minimal code)** — Without deleting V3 booking code:
   - New default editor (or migration on publish): `book/reschedule/cancel/smsConfirm` off, `answer/message/transfer` on, appointments `strategy: 'none'`.
   - Rename nav/copy to **Conversational IVR**; hide/de-emphasize Appointments route in nav (keep route/code).
   - Adjust `enabledVoiceToolNamesFromEditor` / publish validation so IVR publish does **not** require calendar.
   - *Result:* published `toolNames` match the four-tool launch.

4. **Transfer destination sync** — Map Phone forwarding destinations / departments into `transfer` policy (or shared table) so “billing” resolves to authorized E.164. *Result:* IVR transfers hit the same numbers as Phone menus/forwarding.

5. **Harden call identity** — Remove silent `voiceCall.create` swallow; ensure finalize always has a row; link `HumanCall` when Call Control and LiveKit share a business story (future overflow work).

6. **Phone regression pass** — Focused tests on: outbound WebRTC, inbound answer, external forward, ring group sequential/simultaneous, voicemail write, power dialer state — using existing `test:phone*` scripts in `new-app/package.json`.

7. **MCTB (later)** — API port plan: TeXML webhooks → new-app, replace MCTB page data sources, wire eligibility to call outcomes — **without** changing Coolify MCTB ingress until cutover plan is explicit.

---

## G. Do not rewrite / defer (touch only when instructed)

| Preserve | Reason |
|----------|--------|
| Full Voice V3 booking/scheduling toolchain | Deferred product; keep for later |
| Monolith MCTB TeXML/SMS/consent pipelines | Certified; reference for port |
| Phone forwarding / Call Control webhook core | Recently wired; harden, don’t replace |
| Approved shell (product switcher + one sidebar) | `lib/nav.ts` pattern |
| `wizard-v3-runtime-launch-classification.ts` | Launch-scope documentation in code |
| Mass SMS / AR / campaigns routes in monolith | Out of launch scope |

---

## Alignment with launch strategy

**Finish Phone + Conversational IVR runtime integration first** — especially worker internal API parity, transfer/message persistence, and IVR launch defaults — **then** MCTB port without disturbing Telnyx ingress.

Natural first implementation PR: **worker voice-runtime action parity + `take_message` fix** (small, verifiable, unblocks PSTN hardening on transovo.ai).
