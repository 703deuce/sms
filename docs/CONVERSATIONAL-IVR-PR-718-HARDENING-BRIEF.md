# Conversational IVR — PR #718 review & hardening brief

**Date:** October 20, 2026  
**PR:** [#718](https://github.com/703deuce/sms/pull/718) — `cursor/conversational-ivr-voice-v3-f350`  
**Follow-up branch (hardening):** `cursor/conversational-ivr-hardening-9779`

This document captures product review conclusions, code-verified gaps, acceptance tests, and what must happen before customer-ready launch. It complements `docs/TRANSOVO-CONTINUATION-AUDIT-2026-10-20.md`.

---

## 1. What PR #718 reportedly completed (and assessment)

| Component | Reported status | Assessment |
|-----------|-----------------|------------|
| Renamed AI Receptionist → Conversational IVR | Implemented | **Correct** — `lib/receptionist/runtime-profile.ts`, `lib/nav.ts` |
| Simplified navigation | Implemented | **Correct** — Call Routing, Message Taking, Knowledge; Appointments de-emphasized |
| Business Knowledge | Preserved | **Correct** — linked-KB compile (`knowledge-compile.ts`) |
| Semantic call routing | Implemented | **Correct approach** — `conversationalRoutes` + `compile-transfer-from-editor.ts`; route IDs, not invented numbers |
| Message taking | Implemented | **Correct intent** — `take_message` tool; **hardening:** must not depend on callback-request gate (fixed on hardening branch) |
| Booking / calendar tools | Disabled in active profile | **Correct** — `conversationalIvrToolAllowlist`, `editorToVoiceV3AgentConfig` IVR overrides |
| Structured intake enforcement | Bypassed for IVR | **Correct** — `collectIntake: false`, empty intake fields in IVR compile |
| Full Voice V3 receptionist code | Preserved | **Correct** — `runtimeProfile: full_receptionist` path unchanged |
| Worker ↔ web forensic / transfer actions | Connected on PR branch | **Improvement vs `master`** — `record_voice_v3_transfer_outcome`, forensics actions on `app/api/internal/voice-runtime/route.ts` |
| Automated tests | Local scripts | **Encouraging only** — not production PSTN verification |

**Active runtime tools (Conversational IVR profile):**

`end_call`, `search_business_knowledge`, `transfer_call`, `take_message` (+ capability-gated subsets via `conversationalIvrToolAllowlist`).

Published bundle must show `runtimeProfile: conversational_ivr` (editor field) and `runtime.toolNames` matching the allowlist after **republish**.

---

## 2. Three issues to fix before customer-ready

### Issue 1 — Ring groups are not end-to-end (biggest functional gap)

**What PR #718 did (problem):**

`conversational-routing-editor.tsx` exposed ring groups by taking **only the first member’s E.164**:

```ts
const first = g.members[0]?.destination
// ...
phoneE164: first.phoneE164
```

That does **not** run Phone’s simultaneous/sequential ring-group executor (`forwarding-service.ts`). Customer config says “ring three people”; runtime dials one.

**Product decision:**

- Do **not** advertise ring groups as Conversational IVR destinations until LiveKit transfer can invoke certified Phone ring-group behavior (or equivalent multi-leg bridge).
- **V1:** individual **forwarding destinations** and external PSTN numbers only.

**Hardening branch changes:**

- Remove ring groups from the destination picker UI.
- Publish validation rejects enabled routes with `destinationKind === "ring_group"`.
- Copy explains ring groups are future work.

**Acceptance tests (transfer):**

1. Route “Sales” → individual forwarding destination E.164 → PSTN call connects to that number; `voiceCall.transferred` / transfer outcome recorded.
2. Failed transfer (no answer) → configured fallback (`take_message` or `end_call`) without agent claiming success early.
3. **No** UI option to pick a ring group as IVR target until bridge ships.
4. Existing drafts with `ring_group` routes → publish blocked with clear error.

---

### Issue 2 — Call completion & post-call persistence

**Facts in repo:**

- `finalizeVoiceV3Call` in new-app **does** set `voiceCall.status = COMPLETED`, transcript, recording URL, intent metadata (synchronous DB).
- `new-app/lib/messaging/enqueue-advance.ts` **`enqueueJob` is a no-op stub** — anything that relied on BullMQ async jobs in new-app **does not run** (CRM paths only; not voice finalize today).
- Message notifications fire from **post-persist hooks** on callback/message persist (`execute-request-callback.ts` / `execute-take-message.ts`) — **not** from `enqueueJob`.
- PR report: verify `IN_PROGRESS` → `COMPLETED` after deploy — **still required**.

**Risks:**

- `voiceCall.create(...).catch(() => undefined)` on session resolve — finalize can return `not_found`.
- `take_message` previously reused `executeRequestCallback`, which returned `not_available` when `callbackRequestsEnabled === false` — **messages looked taken but were not persisted** (addressed on hardening branch via `execute-take-message.ts`).
- No proof yet that Python worker **always** calls `finalize_voice_v3_call` on hangup with transcript/summary.

**Required acceptance tests (not optional):**

1. PSTN call → `take_message` → DB row (`callbackRequest` with `sourceRoute: voice_v3_take_message`) + staff notification (SMS/email per config).
2. Call end → `voiceCall.status === COMPLETED`, `endedAt` set, transcript row if worker sent text.
3. Call detail / inbox shows message or summary (not only tool success in logs).
4. Idempotent finalize (duplicate worker hangup events do not corrupt state).

**Hardening follow-ups still open:**

- Remove or surface errors on failed `voiceCall.create`.
- Confirm worker finalize path in `voice-runtime-python` for production agent.
- Optional: synchronous notification summary on finalize for IVR when message taken (belt-and-suspenders).

---

### Issue 3 — Vector-store handling (partial fix)

**What PR did:**

- Linked KBs only at compile (`activeKnowledgeBaseIds` via `voiceAgentKnowledgeBase`).
- Runtime publish caps `openaiFileSearchVectorStoreIds` to **2** in bundle (`compile-runtime.ts` slice) to avoid OpenAI validation errors.

**Remaining concern:**

- If a workspace links **>2** KBs with vector stores, **silent truncation** at publish time could hide knowledge.

**Hardening branch changes:**

- Publish gate **fails** with explicit error when linked vector stores > 2.
- Publish gate checks **linked** KB content (FAQs / vector IDs), not “any active KB in workspace.”

**Acceptance tests:**

1. Link 3 vector-backed KBs → publish **blocked** with message to unlink or consolidate.
2. Link 1–2 KBs with FAQs → `search_business_knowledge` returns content from linked sources only.
3. UI shows limit before publish (future: knowledge settings copy).

---

## 3. Publishing & production profile verification

After deploy, **every live agent must be republished** or it may still run `full_receptionist` tools (booking, intake, etc.).

**Checklist (per workspace):**

1. Draft editor: `runtimeProfile === "conversational_ivr"` (default for new agents on PR branch).
2. Publish succeeds (no ring-group routes; knowledge within limits).
3. Published version JSON: `newAppReceptionist.editor.runtimeProfile`, `runtime.toolNames` ⊆ four tools.
4. LiveKit session resolve logs: `toolNames` in `VOICE_V3_PROMPT_FINGERPRINT` match allowlist.
5. Test call: attempt `book_appointment` via tool injection — must **not** be in `toolSchemas` returned to worker.

**Scripts (local):**

- `new-app/scripts/test-conversational-ivr-profile.mjs`
- `new-app/scripts/publish-workspace-receptionist.mjs` (with `WORKSPACE_ID`)

---

## 4. Recommended hardening pass (no new major features)

Priority order (matches product review):

| # | Work | Owner / area |
|---|------|----------------|
| 1 | Transfer E2E — individual destinations, failure/fallback, transfer outcome API | Voice + Python worker + PSTN |
| 2 | Ring groups **hidden** + publish guard | UI + `compile-runtime` (done on hardening branch) |
| 3 | Message persist independent of callback toggle | `execute-take-message.ts` (done on hardening branch) |
| 4 | Call finalize + `COMPLETED` + transcript | Worker + `finalize.ts` + DB checks |
| 5 | Knowledge publish validation (≤2 vector stores, linked KBs) | `publish-gate.ts` (done on hardening branch) |
| 6 | Republish all agents; verify tool allowlist in prod | Ops + `GET` session resolve / logs |

**Controlled PSTN matrix (manual):**

- Answer FAQ from linked knowledge.
- “Connect me to billing” → correct route → transfer succeeds or fallback.
- Leave message → visible in UI + notification.
- Hang up → call completed, no stuck `IN_PROGRESS`.

---

## 5. Production readiness scorecard (review)

| Area | Status |
|------|--------|
| Product scope / simplification | **Good** |
| Frontend conversion (PR #718) | **Reported complete** |
| Runtime tool restrictions | **Reported complete** (requires republish) |
| Transfer reliability | **Not verified** (outcome API on PR branch; PSTN pending) |
| Ring groups as destinations | **Was incorrect** — **restrict for v1** |
| Call finalization | **Incomplete verification**; message gate bug fixed on hardening branch |
| Vector knowledge completeness | **Improved** — explicit publish failure if >2 stores |
| Customer-ready | **Not yet** |

---

## 6. What not to rewrite

- Full Voice V3 booking/scheduling code (`full_receptionist` profile).
- Monolith MCTB TeXML/SMS pipelines until Phone/IVR hardening done.
- Phone Call Control forwarding core (`forwarding-service.ts`, webhooks).
- Approved shell: one product switcher, one contextual sidebar.

---

## 7. Merge strategy

1. Merge **PR #718** (feature conversion) when review satisfied.
2. Merge **hardening branch** (`cursor/conversational-ivr-hardening-9779`) on top for ring-group UI, message persist, publish gates.
3. Deploy web + **manually redeploy** `transovo-voice` worker; confirm `TRANSOVO_BACKEND_URL` → `https://transovo.ai`.
4. Republish agents; run PSTN acceptance matrix.
5. **Then** resume MCTB port without changing certified TeXML ingress.

---

*Generated from product review + repository audit. Update this file when acceptance tests pass.*
