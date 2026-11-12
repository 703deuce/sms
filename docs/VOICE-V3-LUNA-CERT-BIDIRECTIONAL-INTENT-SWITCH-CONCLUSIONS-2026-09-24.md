# Voice V3 — Luna cert: bidirectional intent-switch conclusions

**Date (UTC):** 2026-09-24  
**Cert line:** +15717491060 · **Agent:** After-Hours Voice Agent UI CERT TEST 2304  
**Delegated backend under test:** `gpt-6-luna` (`VOICE_V3_ASTRA_MODEL=gpt-6-luna` on transovo-web)

This document captures the **product/engineering conclusion** after the same-night Luna PSTN cert sequence. Per-call forensics live in the linked audit files below.

---

## What this proves

The **reverse-direction intent-switch** test succeeded on Luna:

**callback intent → booking intent → real appointment**

The strongest signal: **Luna did not leave a callback behind** when the caller changed direction (`jpbrfMBzQd86` — no `callbackRequestId`, no `callback_requests` row).

### Sequence (`jpbrfMBzQd86`)

1. Caller initially headed toward a callback.
2. Luna called `request_callback` twice.
3. Runtime returned **`needs_information`** both times — **no callback created**.
4. Caller changed direction toward scheduling.
5. Luna called `set_scheduling_preference` twice with **invalid** arguments (failures before success).
6. Luna recovered and supplied valid scheduling arguments.
7. `find_availability` → **available**.
8. Luna attempted `book_appointment` too early.
9. Runtime blocked with **`MISSING_REQUIRED_INFORMATION`**.
10. Luna collected remaining intake (`update_intake`).
11. Luna called `book_appointment` again.
12. Booking **confirmed**.
13. **Microsoft Graph `externalId`** on `voice_appointments` — real external calendar write, not verbal-only confirmation.

---

## Bidirectional matrix (Luna, production cert)

| Intent transition | Call suffix | Luna result |
|-------------------|-------------|-------------|
| **Book → Callback** | `GhcuVC5EZbrq` | Callback persisted (`cmuf04qyy5q2a3p3l3l6d0255`) |
| **Callback → Book** | `jpbrfMBzQd86` | Appointment booked (`cmuf0k5zn01575p4w5o4t5o4v`) |

### Terminal paths (Luna)

| Path | Call suffix | Outcome |
|------|-------------|---------|
| Book → appointment | `jU5s6hKcGXo4` | `appointment_booked` |
| Book → callback | `GhcuVC5EZbrq` | `callback_requested` |
| Callback → book | `jpbrfMBzQd86` | `appointment_booked` |

**Assessment:** Luna is not “merely promising” on these cert tests — **core bidirectional intent-switch behavior** that was explicitly in scope **has been demonstrated in production** on the cert line.

---

## Runtime architecture (validated pattern)

The model does **not** need a perfect workflow understanding for the workflow to stay **safe**:

```
LLM imperfect tool attempt
  → deterministic runtime rejects
  → model receives structured result
  → conversation continues
  → valid action eventually succeeds
```

Observed on Luna calls:

| Layer | Example |
|-------|---------|
| Callback readiness | `request_callback` → `needs_information` until intake ready |
| Scheduling args | `set_scheduling_preference` → errors until valid semantics |
| Premature book | `book_appointment` → `not_ready` / `MISSING_REQUIRED_INFORMATION` |
| Terminal truth | Callback only when tool succeeds; book only with Graph `externalId` |

Luna did **not** hallucinate terminal outcomes: no phantom callback on the book pivot; no fake book on the callback pivots.

**Recommendation (frozen for this pass):** **Keep runtime unchanged.** Treat Luna `set_scheduling_preference` argument errors as an **isolated regression metric**, not an architecture change.

---

## Next investigation: `INVALID_ARGUMENTS` on scheduling

**Weakness on `jpbrfMBzQd86` is not the pivot** — it is:

```text
set_scheduling_preference → INVALID_ARGUMENTS → retry → INVALID_ARGUMENTS → success
```

**Premature `book_appointment`** is largely a **successful guardrail test** (same as Sol/Astra traces): runtime prevents forced booking until intake is complete.

**`INVALID_ARGUMENTS` is different** — inspect whether Luna:

- misunderstands the **tool schema** / structured scheduling fields, or
- needed multiple tries because **caller scheduling language** was ambiguous until clarified.

### Code paths (for forensics triage)

`set_scheduling_preference` (`src/lib/voice-v3/tools/set-scheduling-preference-tool.ts`):

1. **Zod parse failure** on `schedulingMeaningZodObject` → `INVALID_ARGUMENTS` (via tool executor).
2. **`!schedulingMeaningHasSignal(args)`** → `INVALID_ARGUMENTS` — “must include structured date or time semantics” (empty or non-actionable payload).
3. **`SCHEDULING_CLARIFICATION_REQUIRED`** / unresolved normalized preference — different code path (`not_ready`), not the same as empty-args `INVALID_ARGUMENTS`.

When logging regressions, **tag which branch** fired (parse vs no-signal vs clarification).

---

## Suggested next experiment

**Question:** How often does Luna produce `set_scheduling_preference` failures on **identical callback→book scripts** vs **GPT-5.6 Sol**?

**Method:**

- Same cert line, same scripted caller responses (or paired live smokes).
- Score per call from `metadata.voiceV3Forensics`:
  - count of `set_scheduling_preference` completions with `error` / `INVALID_ARGUMENTS`
  - count of `book_appointment` `not_ready` before success (guardrail — expect ≥1 on complex intake)
  - terminal outcome correctness (callback id vs `externalId`)
- **Do not change runtime** between A/B — only `VOICE_V3_ASTRA_MODEL`.

---

## Per-call audit files

| Doc | Call |
|-----|------|
| `docs/VOICE-V3-LUNA-VS-SOL-VS-ASTRA-CALL-COMPARISON-2026-09-24.md` | Luna book + Sol/Astra context |
| `docs/VOICE-V3-LUNA-CALLBACK-PIVOT-AUDIT-2026-09-24-GhcuVC5EZbrq.md` | Luna book → callback |
| `docs/VOICE-V3-LUNA-CALLBACK-TO-BOOK-AUDIT-2026-09-24-jpbrfMBzQd86.md` | Luna callback → book |
| `docs/VOICE-V3-CALLBACK-PIVOT-AUDIT-2026-09-24-KydsC6xPmGur.md` | Sol book → callback (same night) |
