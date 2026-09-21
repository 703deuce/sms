# Voice V3 — Astra prompt-layer intake persistence fix (report)

**Date:** 2026-09-21  
**Commit:** `f2b3f82b`  
**Branch:** `cursor/voice-v3-final-completion-2304`  
**Related docs:** `docs/VOICE-V3-LIVEKIT-GPT-LIVE-READONLY-AUDIT.md`, `docs/VOICE-V3-ASTRA-INTAKE-PROMPT-ANALYSIS.md`, `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-21-JUSYBrzenWLq.md`

---

## Summary

Narrow **Astra instruction-layer** fix: when the caller clearly supplies or corrects configured intake, persist it **promptly** with `update_intake` during the current delegation — do not carry it only in conversation until book or a later turn.

**No changes** to LiveKit session, FunctionTool lifecycle, Python bridge, Node `update_intake` executor, booking providers, or Amy runtime/question sequencing.

**Problem diagnosed (Case 1):** Wiring and blocking `update_intake` are correct; prompts had a hole **before** the tool call (“whenever clearly provides” but not “persist now in this delegation”). Cross-tool “contact fields as needed” + model readiness wording allowed defer-until-book behavior (e.g. PSTN call `JUSYBrzenWLq`: failed `book_appointment` at 01:47:49, first `phone` write ~50s later at 01:48:39).

---

## 1. Exact prompt text changed

### `src/lib/voice-v3/prompts/astra-intake-instructions.ts`

Added **“Prompt persistence (production)”** block:

- When the caller clearly provides new or corrected configured intake information, persist it with `update_intake` during the **current delegated work**.
- Do **not** intentionally defer clearly supplied intake until booking, until all intake fields have been collected, or until a later conversational turn merely because scheduling or another operation is also in progress.
- **Conversation** is where newly supplied or corrected information appears; after `update_intake` **succeeds**, its returned intake state is **authoritative** for which persisted fields are present and which required fields are still missing.
- Use `updated_fields`, `missing_required_fields`, `objective` status, and the current authoritative state when deciding what information remains to be collected.
- Do not ask for a persisted field again merely because it appears earlier in the configured intake sequence.
- When the caller clearly corrects a previously persisted value, persist the new clear value with `update_intake` immediately; the newest clear correction supersedes the earlier persisted value.

**Preserved / integrated (not duplicated unnecessarily):**

- Multiple fields in one `update_intake` call when possible.
- Any order; no required questionnaire order.
- No uncertain fragments, abandoned phrases, or guesses; same-statement correction example.
- Combined intake + scheduling example (`update_intake` for name + scheduling tools; do not force scheduling through `update_intake`).

**Not added:** “Tool state is the sole source of truth” — conversation remains where new info and corrections originate.

---

### `src/lib/voice-v3/tools/astra-tool-contracts.ts`

**`UPDATE_INTAKE_TOOL_DESCRIPTION`** — inserted timing clause (existing rules kept):

> When the caller clearly provides or corrects such information, call this tool **during the current delegated work** rather than intentionally carrying that information only in conversation for later persistence.

Still includes: multiple fields per call, any order, latest clear correction, no guessing, intake-only (not scheduling dates/times).

---

### `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`

**Booking path item #2** — replaced weak recipe with:

- Typical order: persist clearly supplied intake when the caller provides it → `set_scheduling_preference` → `find_availability` → slot → `book_appointment`.
- **FIND may occur while intake is still incomplete**; do not require every configured intake field before `find_availability` unless a deterministic policy already requires it.
- Whenever the caller clearly supplies configured intake during booking/scheduling work, persist it **promptly** with `update_intake` rather than deferring merely because scheduling is underway.
- **Before `book_appointment`**, rely on current authoritative intake state and **existing deterministic booking preconditions**.

**Persistent vs temporary state:**

- Save with `update_intake` during the **same delegated work** when the caller supplies them — not only at book time.
- Clearly supplied configured intake is **not** “incomplete operation arguments”; persist it with `update_intake`.

**Model readiness vs executor preconditions** — added:

- Executor rejection is **not** a substitute for prompt intake persistence; do not defer clearly supplied configured intake to conversation alone because `book_appointment` may fail later.

**Not added:** “Collect all required intake before FIND.”

---

### Amy (voice)

**Unchanged** — still delegates for business facts; no tool names; no runtime question sequencing.

---

## 2. Files changed

| File | Role |
|------|------|
| `src/lib/voice-v3/prompts/astra-intake-instructions.ts` | Main timing / authority rules |
| `src/lib/voice-v3/tools/astra-tool-contracts.ts` | `UPDATE_INTAKE_TOOL_DESCRIPTION` timing |
| `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` | FIND vs intake independence; BOOK guard |
| `scripts/test-voice-v3-astra-intake-prompt-contract.ts` | **New** static regression |
| `scripts/test-voice-v3-astra-intake-cert.ts` | Live Astra scenarios A–E (+ F) |
| `scripts/test-voice-v3-astra-tool-contracts-audit.ts` | Asserts new phrases in compiled Astra prompt |
| `package.json` | `test:voice-v3-intake` includes prompt contract script |

---

## 3. Why each change was necessary

| Change | Why |
|--------|-----|
| Intake instructions | Audit showed strong *how* to save intake, weak *when* to call `update_intake` |
| Tool description | Reinforces timing at the function Astra invokes |
| Cross-tool booking line | “Contact fields as needed” + readiness allowed “keep going until backend stops me at BOOK” |
| Tests | Encode policy in CI without runtime changes |

---

## 4. FIND before intake completion

**Yes — preserved and explicit.**

Cross-tool includes: `FIND may occur while intake is still incomplete`.

Desired flow still allowed:

```
Caller: Tuesday afternoon. I'm Anthony, 571-…
→ set_scheduling_preference / find_availability (may run while intake incomplete)
→ update_intake(name, phone) when caller supplies them
```

---

## 5. BOOK deterministic preconditions

**Unchanged in code.**

Prompt: before `book_appointment`, rely on authoritative intake state and existing deterministic booking preconditions (e.g. `MISSING_REQUIRED_INFORMATION` on premature book — as on call `JUSYBrzenWLq`).

---

## 6. Corrections

**Supported.**

- Intake instructions: newest clear correction supersedes **persisted** value; persist immediately with `update_intake`.
- Tool description: save newest clear value on correction.
- “Don’t ask for already persisted fields” does **not** mean “never update a stored field” when the caller corrects it.

Example:

```
Caller: 571-111-1111 → update_intake(phone=A)
Later: Actually 571-222-2222 → update_intake(phone=B)  // B authoritative
```

---

## 7. Uncertainty handling

**Unchanged.**

Do not persist incomplete phrases, uncertain transcription, abandoned values, or guesses. Rule is: **clear** new/corrected configured intake → persist promptly — not “anything resembling intake.”

---

## 8. Focused regression tests

### Static (no `OPENAI_API_KEY`)

**`scripts/test-voice-v3-astra-intake-prompt-contract.ts`**

Policy checks (aligned with Cases A–F):

- Prompt persistence timing in intake instructions
- No defer-until-book language as the fix
- `updated_fields` / `missing_required_fields` in instructions
- Correction supersedes persisted value
- Uncertainty / fragments rule
- Tool description: “current delegated work”
- Cross-tool: FIND while intake incomplete; prompt persist during scheduling; BOOK uses authoritative intake
- Must **not** require all intake before FIND

Also asserted in **`scripts/test-voice-v3-astra-tool-contracts-audit.ts`**.

### Live Astra tool selection (requires `OPENAI_API_KEY`)

**`scripts/test-voice-v3-astra-intake-cert.ts`** scenarios:

| Label | Intent |
|-------|--------|
| `caseA_phone_only` | Phone → `update_intake(phone)` |
| `caseB_name_and_phone` | One call with name + phone |
| `caseC_intake_plus_scheduling` | Name + Tuesday → `update_intake(name)` (scheduling may follow) |
| `caseD_phone_correction` | Correct persisted phone → `update_intake(phone)` |
| `caseE_phone_already_persisted` | Email only when phone already saved → `update_intake(email)` |
| `case8_incomplete_email` | Abandoned fragment → no `update_intake` (Case F) |

Run:

```bash
npx tsx scripts/test-voice-v3-astra-intake-prompt-contract.ts
npx tsx scripts/test-voice-v3-astra-intake-cert.ts   # needs OPENAI_API_KEY
```

---

## 9. Test results (agent run)

| Command | Result |
|---------|--------|
| `npx tsx scripts/test-voice-v3-astra-intake-prompt-contract.ts` | **PASS** |
| `npx tsx scripts/test-voice-v3-astra-tool-contracts-audit.ts` | **PASS** |
| `npx tsx scripts/test-voice-v3-intake.ts` | **PASS** |

`test-voice-v3-astra-intake-cert.ts` was **not** run in the cloud agent environment (no `OPENAI_API_KEY`).

Full intake script chain:

```bash
npm run test:voice-v3-intake
```

---

## 10. What was explicitly NOT changed

- LiveKit `GPTLiveModel` / `delegation="responses"`
- FunctionTool registration / `ctx.update()` (none added)
- Python `TransovoV3ToolClient` / tool bridge
- Node `executeVoiceV3ToolForLiveKit` / `update-intake-tool.ts` executor logic
- Microsoft / Google calendar booking implementations
- Conversation revision, transfer, post-call, MCTB
- Amy `live-frontend-instructions.ts` / delegation policy (substantial)

---

## 11. Commit

```
f2b3f82b fix(voice-v3): prompt Astra to persist intake promptly via update_intake
```

---

## 12. Architecture reminder (unchanged)

```
Caller supplies intake (conversation)
        ↓
Astra should call update_intake promptly in current delegation
        ↓
LiveKit FunctionTool (blocking, awaited)
        ↓
Transovo mergeIntakeUpdate + replaceContext
        ↓
JSON: ok, status INTAKE_UPDATED, data.updated_fields, missing_required_fields, objective, state_version
        ↓
Astra continues; Amy speaks from delegation outcome
```

LiveKit audit: `docs/VOICE-V3-LIVEKIT-GPT-LIVE-READONLY-AUDIT.md` — implementation matches documented blocking tool pattern.

---

*End of report.*
