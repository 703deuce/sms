# Voice V3: Golden era vs recent calls (what changed)

**Purpose:** Side-by-side of what the **571 / +15717491060** “golden era” used when Sol↔Luna bookings were reliable, versus what **master had immediately before PR #682** (the prompts in effect on your **recent** broken calls). This is **instruction-layer only** — not a full repo diff.

| Reference | Commit | Date (approx.) |
|-----------|--------|----------------|
| **Golden era** | `a4a63466c` | 2026-09-24 |
| **Recent (pre-restore)** | `origin/master` @ `155872ef4` | 2026-10-16+ |
| **Restore branch** | `cursor/voice-v3-golden-era-sept-f350` | Copies golden text into **5 files** only |

---

## What you were doing in the golden era

- **Product:** Voice V3 on **LiveKit** (not Basic), PSTN on **+15717491060** (571).
- **Architecture:** **Amy** (GPT-Live frontend) + **Astra** delegated backend (**Sol** or **Luna** — you flipped `VOICE_V3_ASTRA_MODEL` / bootstrap `backend_model`; **same prompt text** for both).
- **Behavior you remember:** “Next available” worked without re-asking the day; **book before intake complete** failed cleanly and **recovered** into questions without getting stuck; switching booking ↔ callback ↔ booking did not deadlock.
- **Evidence in DB:** Cluster of `appointmentBooked: true` LiveKit V3 calls on that DID around late September 2026, aligned with `a4a63466c`.

**Backend default in git at golden era:** `delegation-config` defaulted to **`gpt-5.6-sol`**, with env override for Luna. **Production today** defaults **`gpt-6-luna`**; your Luna runs in September used the **same prompts** — model family is not the main story in this doc.

---

## What did *not* change between golden era and recent calls

These paths are **identical** between `a4a63466c` and `origin/master` (no diff in git):

- Delegated **tool executors** (book / find / intake handlers under `src/lib/voice-v3/tools/` for the core calendar path).
- **No** golden-era vs recent diff on `handle-delegated-voice-tools`, `book-appointment-tool`, etc.

So the regression you felt on recent calls is **not** explained by Luna/Sol handler code rewrites in that window — it lines up with **prompt / policy / tool-description** changes and **wizard surfacing** (below).

---

## Files PR #682 restored (golden → current agent text)

Only these five were reverted to **Sept 24 wording**:

| File | Role |
|------|------|
| `src/lib/voice-v3/prompts/live-frontend-instructions.ts` | Amy / GPT-Live |
| `src/lib/voice-v3/prompts/live-delegation-policy.ts` | When Amy delegates |
| `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` | Luna/Astra cross-tool rules |
| `src/lib/voice-v3/prompts/astra-callback-instructions.ts` | Callback path |
| `src/lib/voice-v3/tools/astra-tool-contracts.ts` | OpenAI function **descriptions** Luna sees |

Everything else on master (wizard compile, LiveKit provisioning, `operation-requirements`, `effective-prompt-capabilities.ts`, `build-voice-v3-prompts.ts`, `delegation-config.ts`) **stayed as-is**.

---

## 1. Amy (`live-frontend-instructions.ts`)

### Golden era (shorter, config-flag driven)

- Capabilities listed from **compile-time flags** (`bookAppointments`, `rescheduleAppointments`, etc.).
- **No** `# COLLECTING CALLER INFORMATION` block.
- **No** `# CONFIGURED CALLER INFORMATION (THIS BUSINESS)` block listing wizard `requiredIntakeKeys` with backend field ids.
- **No** `effective-prompt-capabilities` / **connection greeting role** split (`full_business` vs repeat welcome).
- **No** extra “conversation mechanics live in CORE CONVERSATION STYLE” cross-reference layer.
- Greeting: simpler **speaks-first** hint string; no “caller already heard connection audio” rules.

### Recent calls (master before #682)

Commits (among others): `c043e4ddb` consolidate Amy/Astra prompts, `155872ef4` weekday + wizard intake surfacing.

**Additions / rewrites:**

1. **`effective-prompt-capabilities`** — Amy capabilities and greeting behavior depend on **which tools are actually registered** for this agent (book vs request-only vs send-link).
2. **`# CONFIGURED CALLER INFORMATION`** — Required wizard fields injected into Amy’s prompt with labels and `` `field.key` `` ids; “listen naturally; include in delegation context.”
3. **`# COLLECTING CALLER INFORMATION`** — Explicit one-question-at-a-time intake rules; **do not read missing-field lists or backend error payloads aloud**.
4. **`# TRUTH AND CONFIRMATION`** — Moved/consolidated “never invent / never say you’re all set” copy.
5. **Greeting policy** — If connection audio already played full business welcome, Amy must **not** repeat it; short “How can I help?” transition.

**Symptom link (your recent calls):**

- Re-asking “what day?” after “next available” → can be **Amy** not re-delegating with updated context, or **backend** re-running FIND with stale preference; golden text had simpler delegation loops without the new “stale delegation” essay (see §2).
- Book fail → silence / “hello?” → golden Amy text had less rigid “don’t read errors aloud” vs recent; recovery still depends on **Live recovery push** (unchanged in git) **plus** Astra rule #7 (restored in #682).

---

## 2. Amy delegation policy (`live-delegation-policy.ts`)

### Golden era

- **Fixed** backend capability bullets (booking, reschedule, cancel, transfer, callback, etc.).
- **Fixed** “Delegate when” list (availability, book, existing appt, reschedule, cancel, store info, transfer, correction in flight, …).
- Shorter rules: delegate before claims; don’t guess while pending; **re-delegate on correction**; callback completion guards.

### Recent calls

- **Capability-gated** bullets — only mention tools enabled for **this** wizard manifest (`runtimeHasTool`).
- Extra **“You continuously own the live conversation”** block:
  - Backend may still be running from an **older** request.
  - Don’t assume stale delegation matches current caller intent.
  - Don’t wait for stale work before reacting to **new** input.
  - Confirmed provider outcomes stay facts; **change direction → delegate again**.
- Separate delegate-when lines for **request-only** and **send-link** strategies.

**Symptom link:** More text about stale backend work can interact badly with **parallel delegations** (caller says “9 o’clock” while FIND still running) — either helpful (re-delegate) or confusing (model waits / double-asks). Golden policy was **less verbose** on that edge.

---

## 3. Astra cross-tool (`astra-cross-tool-instructions.ts`)

### Golden era (flat numbered “Tool discipline” list)

- Single numbered list (items 1–10) including booking order, callback path (if enabled), identifiers, scheduling preference block at bottom.
- **Rule 7 (critical for recovery):**  
  *If a tool returns **not_ready**, **missing fields**, stale offer set, or clarification required, choose the **corrective tool** or let Amy ask — do not repeat the same failed mutation blindly.*
- **No** `THIS_WEEKDAY` vs `NEXT_WEEKDAY` paragraph in this file (weekday semantics left to executor + `set_scheduling_preference` tool description).
- **No** `OUTCOME_UNKNOWN` handling.
- **No** per-strategy subsections (request-only, send-link) generated from `runtimeHasTool`.

### Recent calls

- Reorganized into **sections 1–8** (“Tool authority”, “Tool selection”, “Caller intent”, “Intake persistence”, “Enabled workflows”, “Error and unknown outcomes”, …).
- Workflows built from **`effective-prompt-capabilities`** + booking strategy (direct calendar vs REQUEST_ONLY vs SEND_LINK).
- **Scheduling preference** subsection added with explicit weekday rule:  
  bare “Monday” on a Friday → **THIS_WEEKDAY** (nearest upcoming); **NEXT_WEEKDAY** only when caller clearly means **following calendar week**.
- **New:** `OUTCOME_UNKNOWN` — do not repeat mutation unless state permits.
- Rule 7 **still present** in section 6, but buried inside a larger doc (same sentence in spirit).

**Symptom link:**

- **“Next Monday” skipped a week** on recent calls is **unlikely** to be because golden prompts were smarter — master actually **added** weekday disambiguation in **both** cross-tool and `set_scheduling_preference` description. Wrong Monday more likely **executor / preference normalization** or **stale FIND** after re-ask, not removal of THAT text in golden era.
- **Stuck after book error** — golden era emphasized corrective tool / Amy ask in a **short** rule 7; recent era added more sections but same rule; if recovery failed, check **whether Amy receives structured recovery** on book fail (runtime), not only this paragraph.

---

## 4. Tool descriptions (`astra-tool-contracts.ts`)

### Diff (golden → recent) — one material change on `set_scheduling_preference`

**Recent master added** (golden did **not** have this paragraph in the tool description):

> Weekday-only requests: when the caller names a weekday without saying "next week" … use **THIS_WEEKDAY** for the nearest upcoming occurrence … Use **NEXT_WEEKDAY** only when the caller clearly means the following calendar week …

`update_intake`, `find_availability`, `book_appointment` descriptions: **unchanged** between golden and recent (per git diff).

**PR #682** restored golden **without** that weekday paragraph in the tool contract (Sept behavior relied on model + deterministic resolver without this extra text).

---

## 5. Callback instructions (`astra-callback-instructions.ts`)

Small wording/layout differences between golden and recent (14 lines in diff). Same authoritative flow: `request_callback`, `needs_information` / `missingFields`, no fake completion.

---

## 6. Still on master but *not* restored to golden (agent-adjacent)

These differ from Sept 24 but were **left on master** intentionally (wizard / infra):

| Area | Golden vs recent |
|------|------------------|
| `effective-prompt-capabilities.ts` | **New on master** — drives Amy/Astra conditional sections. |
| `build-voice-v3-prompts.ts` | Master injects **`requiredIntakeKeys`** into Astra service catalog lines. |
| `delegation-config.ts` | Default model **gpt-5.6-sol** (golden) vs **gpt-6-luna** (master). Env override unchanged. |
| `operation-requirements.ts`, `compile-voice-v3-agent-config.ts`, wizard manifest | Many changes — **not** agent prompt text but affect **which tools** register and **which intake keys** are required. |
| LiveKit provisioning / dispatch | **New** since golden — does not change Sept prompt files. |

---

## 7. Map: your reported recent failures → likely layer

| What you saw on recent calls | Golden era | Recent (pre-#682) | Still on master after #682? |
|------------------------------|------------|-------------------|-----------------------------|
| “Next available” then asked for day again | Worked | Amy/delegation + FIND preference state | Amy/delegation **golden**; weekday text **removed** from tool contract again |
| “Next Monday” wrong week | Worked | Added THIS_WEEKDAY rules in prompts | Tool contract back to golden (no extra weekday paragraph); **resolver code unchanged** |
| Book tried early → should ask missing fields smoothly | Worked | Astra rule 7 + intake sections | Rule 7 **restored**; wizard intake block **still** in Amy via other files |
| Got stuck / silence after failed book | Worked | Prompt + possible missing Live recovery payload to Amy | Recovery **push code** same as golden; prompts **restored** on Astra/Amy |
| Sol vs Luna both worked | Yes | Luna default on master; same prompts for both | **Luna default kept** |

---

## 8. Commits that touched agent prompts after golden era

```
155872ef4 Clarify weekday scheduling semantics and surface wizard intake fields to Amy
c043e4ddb refine(voice-v3): consolidate Amy/Astra prompts and greeting roles
f2dae623a fix(voice-v3): wizard capability parity audit and prompt-tool alignment
f11488dff Voice V3: reclassify runtime launch gaps; fix Send Link manifest
```

---

## 9. How to regenerate this diff locally

```bash
# Agent prompt files only (golden vs master)
git diff a4a63466c origin/master -- \
  src/lib/voice-v3/prompts/live-frontend-instructions.ts \
  src/lib/voice-v3/prompts/live-delegation-policy.ts \
  src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts \
  src/lib/voice-v3/prompts/astra-callback-instructions.ts \
  src/lib/voice-v3/tools/astra-tool-contracts.ts

# What PR #682 changed (should match inverse of above for those 5 files)
git diff origin/master cursor/voice-v3-golden-era-sept-f350 --stat
```

---

## Summary sentence

**Golden era and recent calls used the same tool-handler code**; what changed was mostly **October prompt consolidation** — wizard-aware capabilities, intake surfacing, greeting roles, longer delegation stale-work rules, and **weekday semantics in Luna’s `set_scheduling_preference` description**. **PR #682** put the **Sept 24 Amy/Astra prompt + tool-description text** back for the five files above while keeping **Luna as default** and all wizard/provisioning work intact.
