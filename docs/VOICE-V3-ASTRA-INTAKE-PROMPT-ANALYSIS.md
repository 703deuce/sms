# Voice V3 — Case 1 analysis & Astra/Amy intake prompt inventory

**Date:** 2026-09-21  
**Context:** PSTN call `JUSYBrzenWLq`; LiveKit GPT-Live read-only audit (`docs/VOICE-V3-LIVEKIT-GPT-LIVE-READONLY-AUDIT.md`); production forensics (`docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-21-JUSYBrzenWLq.md`).

**Purpose:** Document why **delayed/missed `update_intake` invocation by Astra** is the leading explanation for duplicate intake questions — and show **exact current prompt text** governing `update_intake` and intake collection (no code changes in this document).

---

## Executive summary

The `update_intake` **implementation** matches LiveKit’s normal blocking FunctionTool pattern (await Transovo, return authoritative JSON, no `ctx.update()`). Once a given `update_intake` **completes**, Astra receives explicit `updated_fields`, `missing_required_fields`, and `state_version`.

The **call timeline** points earlier in the pipeline:

| Event | UTC (approx) |
|--------|----------------|
| `book_appointment` failed `MISSING_REQUIRED_INFORMATION` | **01:47:49** |
| First backend write including **`phone`** | **01:48:39** (~50 seconds later) |

So the first phone repetition is **not** well explained by “phone saved → Astra forgot phone.” It **is** well explained by:

```
Caller says phone
→ Amy hears it (conversation context)
→ Astra has not yet called update_intake(phone)
→ Authoritative intake: phone still missing
→ Booking / intake objective still needs phone
→ Amy driven to ask for phone again
→ Eventually update_intake(phone) runs
```

**Mother’s name:** only one backend write at 01:49:35 — if the caller said it earlier, **heard ≠ persisted** until that tool call.

**Judgment (not measured):**

- ~**80%** — delayed/missed `update_intake` as conversation progresses  
- ~**15%** — Astra occasionally under-uses completed tool return state  
- ~**5%** — LiveKit 1.8.2 GPT-Live lifecycle / duplicate-tool bug  

**Most useful next move (prompt-only hypothesis):** tighten **Astra** instructions so new/corrected intake is persisted **immediately** via `update_intake`, not deferred until “booking path” or “as needed.”

---

## Why Case 1 fits the audit

Documented path after Astra calls `update_intake`:

```
Astra calls update_intake
→ LiveKit executes tool
→ Python awaits Transovo HTTP
→ Transovo mergeIntakeUpdate + replaceContext
→ result JSON returned
→ Python json.dumps → FunctionCallOutput
→ Astra continues
```

No `ctx.update()`, no background execution, no fire-and-forget, no manual `generate_reply` on the LiveKit V3 session path. Successful return shape includes `updated_fields`, `missing_required_fields`, `objective`, `state_version`.

The suspicious boundary is **before** the tool call:

```
Caller supplies information
→ Amy hears information
→ Astra should recognize new intake and call update_intake
→ (gap)
```

---

## 1. Tool description (what Astra sees on the function)

**File:** `src/lib/voice-v3/tools/astra-tool-contracts.ts`

```text
export const UPDATE_INTAKE_TOOL_DESCRIPTION = `Save one or more pieces of caller-provided information in the authoritative state for the current call. Use this whenever the caller clearly provides or corrects configured caller/intake information such as their name, email address, phone number, service reason, or another configured business field. Save every clearly provided configured field from the same caller statement in one call when possible. Fields may be provided in any order. If the caller clearly corrects an earlier value, save the newest clear value. Do not guess incomplete or uncertain information. This function updates caller/intake information only. It does not search availability, find an existing appointment, book, reschedule, cancel, transfer, or end the call. Do not use it merely because the caller mentions a scheduling date or time.`;
```

**What it says:**

- Use when caller clearly provides or corrects configured fields  
- Batch multiple fields from one statement when possible  
- Any order; corrections use newest clear value  

**What it does not say:**

- Call **immediately** on the turn intake appears  
- Persist **before** `find_availability` / `book_appointment`  
- Successful `update_intake` is the **only** authoritative intake for subsequent reasoning  
- Do **not** wait until “later in the booking path”  

---

## 2. Dedicated Astra intake block

**File:** `src/lib/voice-v3/prompts/astra-intake-instructions.ts`  
**Included in:** `buildAstraBackendInstructions()` via `buildAstraIntakeInstructions()`

```text
When the caller provides multiple configured intake fields in the same statement, save all clearly provided fields together in one update_intake call rather than artificially processing one field at a time.

Intake fields may arrive in any order.
Do not require the caller to answer fields in the order they are configured.
Do not ask for or save a field again merely because it appears earlier in a configured list if authoritative state already contains a usable value.

When a caller clearly corrects an intake value, the newest clear value supersedes the earlier value.
Do not save uncertain fragments, abandoned phrases, or guessed values.
If a caller starts a value and corrects it in the same statement, save only the final clear value.

Example:
"My email is anthony@gmail—actually anthonyj@gmail.com."
Save email = anthonyj@gmail.com (not both values).

When caller information and an independent business request occur together, use the appropriate tools for both.

Example:
"I'm Anthony Johnson and do you have anything Tuesday afternoon?"
Relevant work may include update_intake (name) and find_availability (Tuesday afternoon).
Do not force the scheduling request through update_intake.
```

**Strong on:** multi-field one call, any order, don’t re-save if state already has value, corrections, intake vs scheduling split in combined utterances.

**Missing:**

- “Whenever new intake appears, call `update_intake` in **that** delegation”  
- “Do not defer intake until booking”  
- “Conversation memory ≠ persisted state until tool succeeds”  

---

## 3. Astra core instructions

**File:** `src/lib/voice-v3/prompts/astra-backend-core-instructions.ts`

Relevant excerpt:

```text
Use update_intake only for caller/business information that should be persisted.
Do not use update_intake merely because the caller mentioned a date or time while scheduling.
```

Also relevant (general discipline):

```text
Current verified application/tool state outranks an earlier conversational assumption.
Later clear caller corrections outrank earlier caller preferences.

Voice transcripts may contain incomplete phrases, transcription errors, self-corrections, or abandoned statements. Do not persist an uncertain value merely because a possible value appeared in the transcript. Prefer clear completed information and later corrections.
```

**Note:** “Do not persist uncertain values” is correct for the tool, but there is no paired rule: **do persist clear values promptly**.

---

## 4. Astra cross-tool instructions (ordering — important)

**File:** `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`

**Booking path (line 2 in numbered list):**

```text
2. New booking path: update_intake (contact fields as needed) → set_scheduling_preference (date/time semantics) → find_availability → caller chooses slot → book_appointment.
```

**Persistent vs temporary state:**

```text
Persistent vs temporary state:
- Save durable caller/business facts with update_intake when clearly known (name, reason, email candidate, configured fields).
- Scheduling preferences do not belong in update_intake. Use set_scheduling_preference for date/time semantics, then find_availability / book_appointment with authoritative ids when ready.
- Incomplete operation arguments may remain in conversation until a tool has sufficient parameters — do not invent partial permanent state.
```

**One utterance, multiple tools:**

```text
- A single caller statement may justify zero, one, or multiple independent tools (for example update_intake plus set_scheduling_preference). Do not call find_availability in parallel with set_scheduling_preference — FIND depends on normalized scheduling state.
```

**Model readiness vs executor:**

```text
Model readiness vs executor preconditions:
- You may call a tool when conversation suggests readiness; Transovo will reject mutations if preconditions fail. Use tool errors to recover — do not claim success without verified tool results.
```

**Why this fits call `JUSYBrzenWLq`:**

- Path says `update_intake` first but only **“(contact fields as needed)”** — not “all required contact fields before find/book.”  
- Astra can run find → slot → `book_appointment` while contact fields exist only in conversation.  
- Matches **failed book 01:47:49** and **phone not written until 01:48:39**.

**Contrast — callback has explicit urgency (no equivalent for intake):**

```text
5. Invoke request_callback as soon as the caller has clearly requested a callback — you do not need to believe every configured requirement is already satisfied; the trusted executor validates and may return needs_information.
```

There is **no** “invoke `update_intake` as soon as the caller clearly provides intake” line.

---

## 5. How Astra prompt is assembled

**File:** `src/lib/voice-v3/prompts/astra-backend-instructions.ts`

Order in final string:

1. `buildAstraBackendCoreInstructions()`  
2. Business name, timezone, current local date/time  
3. Configured intake field catalog (wizard keys)  
4. Service catalog, booking strategy  
5. Callback block (if enabled)  
6. **`buildAstraIntakeInstructions()`**  
7. Booking behavior, knowledge, transfer  
8. **`buildAstraCrossToolInstructions()`**  
9. Solicitor hint (if any)  
10. Closing: “Each function tool description defines when to call…”

Intake field catalog is built in `build-voice-v3-prompts.ts` as lines like:

```text
- {key} ({label}, type=..., required=...)
```

---

## 6. Amy (GPT-Live voice) — intake-related text

Amy does **not** receive function schemas. Relevant sections come from `buildLiveFrontendInstructions()` in `src/lib/voice-v3/prompts/live-frontend-instructions.ts` and `buildLiveDelegationPolicySection()` in `live-delegation-policy.ts`.

### Delegation policy — when to delegate

```text
Delegate to the backend when:
...
- The caller provides or corrects information that must be stored in authoritative business state.
...
- Careful backend reasoning is required beyond a simple conversational response.

Do not delegate to the backend when:
...
- You need a brief conversational clarification before the backend could perform useful work.
```

Backend capabilities list includes (when `collectIntake`):

```text
- Save or correct caller information required by the business.
```

### Backend delegation section (Amy)

```text
# BACKEND DELEGATION
A separate reasoning backend (not you) handles tool selection and calendar operations.
You do not see or name internal tools. Delegate naturally when the caller needs
appointment availability, booking changes, customer records, or other business actions.
Delegate when the caller provides or corrects facts the backend should remember:
booking intent, dates/times, intake details, or slot choices — in any order.
There is no required question sequence; capture whatever the caller volunteers.
```

### Persona (when wizard `confirmDetails` is on)

```text
- Confirm names, numbers, and important details.
```

### Style (examples)

```text
"Sure. What's the best email for you?"
```

### Tension (Amy vs authoritative state)

- Amy is tuned for natural collection, duplex listening, and one question at a time.  
- Delegation is required for “facts that must be stored” but **not** “delegate immediately on the same turn the caller volunteers.”  
- Amy can say “Got it” while Astra has not run `update_intake` yet → matches “you already gave that” with empty authoritative intake.  
- Amy does not see `missing_required_fields` in tool JSON; only Astra does — and prompts do not strongly say “after successful `update_intake`, never re-ask fields listed in `updated_fields`.”

---

## 7. Checklist: what we tell Astra/Amy today

| Question | Current guidance |
|----------|------------------|
| When to call `update_intake` | “Whenever clearly provides/corrects” (tool description); “when clearly known” (cross-tool) |
| Call immediately when intake appears | **Not stated** |
| Multiple fields per utterance | **Yes** (tool description + `astra-intake-instructions`) |
| Wait until later / booking path | **Implied** by “contact fields as needed” + scheduling-first; **not** forbidden before book |
| Amy independently gathers fields | **Yes** — one question at a time, confirm details, natural email/phone prompts |
| Amy vs Astra conflict | Volunteer any order + delegate for intake vs linear booking recipe + “as needed” contact; **no** “persist all required intake before book” |

---

## 8. What successful `update_intake` returns (for Astra)

After Python `json.dumps`, Astra sees (conceptually):

```json
{
  "ok": true,
  "status": "INTAKE_UPDATED",
  "data": {
    "updated_fields": ["phone"],
    "rejected_fields": [],
    "missing_required_fields": ["email", "mother_s_name", "..."],
    "objective": {
      "status": "IN_PROGRESS",
      "missing_required_fields": ["..."]
    },
    "state_version": 12
  }
}
```

**Node executor:** `src/lib/voice-v3/tools/update-intake-tool.ts`  
**Pipeline:** `executeVoiceTool` → `updateIntakeTool.execute` → `mergeIntakeUpdate` → `replaceContext` → `toolOk("INTAKE_UPDATED", { ... })`

Prompts do **not** explicitly instruct Astra to treat this payload as the sole source of truth for “what is still missing” vs conversational memory.

---

## 9. Conceptual prompt direction (not implemented)

Architecture (Amy/Astra split, blocking tools) can stay as-is. Missing copy is roughly:

```text
Whenever the caller provides new or corrected intake information relevant to the current objective,
persist it with update_intake immediately.
Do not wait until booking or until all intake fields have been collected.
If one caller utterance provides multiple fields, persist all confidently supplied fields together in one update_intake call.
Treat a successful update_intake result (updated_fields, missing_required_fields, objective.status) as the authoritative intake state for all subsequent reasoning.
Do not ask the caller again for a field that appears in updated_fields on the latest successful update_intake result unless the caller clearly corrects it.
```

Optional cross-tool tweak: replace “update_intake (contact fields as needed)” with required configured intake **before** `book_appointment` (and clarify whether find/book may run when intake objective is incomplete).

---

## 10. Key source files (quick reference)

| Topic | Path |
|--------|------|
| `update_intake` tool description | `src/lib/voice-v3/tools/astra-tool-contracts.ts` |
| Astra intake section | `src/lib/voice-v3/prompts/astra-intake-instructions.ts` |
| Astra core | `src/lib/voice-v3/prompts/astra-backend-core-instructions.ts` |
| Astra cross-tool / booking path | `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` |
| Astra assembly | `src/lib/voice-v3/prompts/astra-backend-instructions.ts` |
| Amy + delegation | `src/lib/voice-v3/prompts/live-frontend-instructions.ts`, `live-delegation-policy.ts` |
| Prompt compile | `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` |
| Node `update_intake` executor | `src/lib/voice-v3/tools/update-intake-tool.ts` |
| LiveKit tool wrapper | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| LiveKit GPT-Live audit | `docs/VOICE-V3-LIVEKIT-GPT-LIVE-READONLY-AUDIT.md` |
| Call forensics | `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-21-JUSYBrzenWLq.md` |

---

*End of document.*
