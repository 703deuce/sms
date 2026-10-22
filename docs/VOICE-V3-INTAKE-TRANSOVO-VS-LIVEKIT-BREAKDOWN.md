# Voice V3 intake — Transovo custom tools vs LiveKit collectors

This document explains **how intake works today** in the Voice V3 + LiveKit receptionist stack: the **bulk** tool (`update_intake`), **per-field passive** tools (`set_intake_<key>`), **active LiveKit collection** (`collect_intake_field`), how the system **remembers what it already has**, and how that compares to using **only** LiveKit’s prebuilt tasks.

Use this when deciding: “bulk custom intake for arbitrary wizard fields” vs “LiveKit GetPhoneNumberTask / GetEmailTask for one field at a time.”

---

## 1. Mental model (one sentence)

**Configuration** (wizard collect fields) defines *what* to ask. **Transovo Node** owns *authoritative persisted state* per call. **The LLM** chooses tools. **LiveKit Python worker** runs some tools locally (active collection + safety fallbacks) and proxies everything else to Node over HTTP.

---

## 2. Where intake fields come from

| Step | What happens |
|------|----------------|
| Business configures **Collect fields** in the appointment receptionist wizard | Name, phone, email, custom labels (e.g. “favorite dinosaur”), required flags |
| Compile | `compileWizardCollectFieldsToV3Intake()` → `VoiceV3AgentConfig.intakeFields[]` |
| Types | `email` / `phone` inferred from field id/key; everything else defaults to `text` |
| Session bootstrap | `resolve-livekit-session.ts` sends `intakeFields: buildLiveKitIntakeFieldMetadata(config)` to the Python worker |

**Key file:** `new-app/lib/server/voice-v3/config/wizard-collect-fields-v3.ts`

Each `IntakeFieldDefinition` has: `key`, `label`, `type`, `required`, `description`, optional `enumValues`, `collectionStrategy`.

There is **no separate database schema per call** for intake during the call — values live in the in-memory **Voice V3 call runtime** (`ctx.runtime`), keyed by field `key`, until post-call persistence elsewhere.

---

## 3. Tool inventory (what the model sees)

At session resolve, tools are merged from:

1. **Astra catalog** (`voice-tool-catalog.ts`) — includes `update_intake`, booking, transfer, send link, etc.
2. **LiveKit intake pack** (`livekit-intake-tool-schemas.ts`) — one passive tool per configured field + `collect_intake_field`

**Key file:** `new-app/lib/server/voice-v3/resolve-livekit-session.ts` (merges catalog + intake tools into `toolSchemas` for the worker)

### 3.1 `update_intake` — bulk / multi-field (Transovo custom)

| Property | Detail |
|----------|--------|
| **Purpose** | Save **one or more** configured fields in **one** tool call when the caller clearly provided them |
| **Schema** | **Strict** object: **every** configured field is a property; use `null` for “not mentioned this turn” |
| **Execution** | **Node** (`update-intake-tool.ts` → `mergeIntakeUpdate` → `validateAndNormalizeIntakeValue`) |
| **Description** | `astra-tool-contracts.ts` → `UPDATE_INTAKE_TOOL_DESCRIPTION` |

**How multi-field works (no “splitting” service on the worker):**

1. Model calls `update_intake` with an object like:
   ```json
   {
     "name": "Anthony Johnson",
     "phone": "+15551234567",
     "email": "a@example.com",
     "service_reason": null,
     "favorite_dinosaur": "Triceratops"
   }
   ```
2. `normalizeUpdateIntakeArguments()` turns LLM junk (`"null"`, `"N/A"`, `"}"`) into real `null`.
3. `mergeIntakeUpdate()` **only applies non-null keys**. Null/absent keys **do not erase** already-saved values.
4. Each non-null value is validated per field **type** (E.164 phone, email regex, enums, etc.).
5. Response includes `updated_fields`, `rejected_fields`, `missing_required_fields`, `objective.status`.
6. Live context is updated with **SHARED CALLER FACTS** so the model is told what is already on file (see §5).

**Key files:**

- Schema: `new-app/lib/server/voice-v3/intake-objective/build-intake-tool-schema.ts` (`buildUpdateIntakeZodSchema`)
- Merge + validate: `new-app/lib/server/voice-v3/intake-objective/merge-intake-update.ts`, `validate-intake-value.ts`
- Execute: `new-app/lib/server/voice-v3/tools/update-intake-tool.ts`

**Important:** Transovo does **not** run NLP to “split” one sentence into fields. The **model** extracts fields and passes them in one JSON object. That is the “custom bulk” design you wanted for “I’m Anthony, my phone is X, my email is Y.”

---

### 3.2 `set_intake_<key>` — single-field passive (generated per wizard field)

| Property | Detail |
|----------|--------|
| **Name** | `set_intake_${sanitized_key}` e.g. `set_intake_phone`, `set_intake_favorite_dinosaur` |
| **Purpose** | Record **one** field when the caller clearly said it **this turn** |
| **Parameters** | `{ "value": string \| null }` |
| **Execution** | Worker may intercept → usually **`update_intake` on Node** with `{ [key]: value }` |

**Key file:** `new-app/lib/server/voice-v3/tools/livekit-intake-tool-schemas.ts` (`buildPassiveFieldTool`)

Tool description tells the model: prefer `update_intake` when multiple fields appear in one statement; for LiveKit-backed types, prefer `collect_intake_field` when **asking** for a missing value (not guessing).

---

### 3.3 `collect_intake_field` — single-field **active** LiveKit collection

| Property | Detail |
|----------|--------|
| **Purpose** | Ask for **one** missing field using a **LiveKit prebuilt task** (spoken flow, corrections) |
| **Parameters** | `{ "field_key": "<wizard key>" }` |
| **Execution** | **Python worker** runs task → then calls Node `update_intake` with `{ [field_key]: collectedValue }` |

**Key files:**

- Tool schema: `livekit-intake-tool-schemas.ts` (`buildCollectIntakeFieldTool`)
- Dispatch: `voice-runtime-python/transovo_voice/voice_v3/tools.py` → `_dispatch_intake_tool`
- Task runner: `voice-runtime-python/transovo_voice/voice_v3/intake_active_collection.py`

**LiveKit task mapping** (`intake_collection.py` / `resolve-intake-collection-kind.ts`):

| Field key / type | Collection kind | LiveKit class |
|------------------|-----------------|---------------|
| `name`, `full_name`, type `name` | `livekit_get_name` | `GetNameTask` |
| `email`, type `email` | `livekit_get_email` | `GetEmailTask` |
| `phone`, type `phone` | `livekit_get_phone` | `GetPhoneNumberTask` |
| `address`, type `address` | `livekit_get_address` | `GetAddressTask` |
| `dob`, `date_of_birth`, type `date` | `livekit_get_dob` | `GetDOBTask` |
| `service_reason`, custom text, enums | `livekit_function_tool` | **No** prebuilt task |

For `livekit_function_tool`, `collect_intake_field` **errors** — use conversation + `update_intake` / `set_intake_*`.

---

## 4. Runtime path (who runs what)

```
Caller speech
    → LiveKit GPT-Live session (Python)
        → LLM chooses tool
            → collect_intake_field / set_intake_* 
                  → Python: run_active_intake_collection (if collect or bad passive value)
                  → HTTP: update_intake on Node
            → update_intake
                  → Python (optional): augment bad LiveKit-field strings → active collection
                  → HTTP: update_intake on Node
            → book_appointment, send_booking_link, …
                  → HTTP: Node tool handlers
```

**Worker client:** `voice-runtime-python/transovo_voice/voice_v3/tool_client.py` → `execute_voice_v3_livekit_tool`

**Intake metadata on worker:** `config.intakeFields` from session resolve (keys, types, `liveKitToolName`).

### 4.1 Safety net (not “ask again because we forgot”)

Python may call LiveKit active collection when:

- Model calls `collect_intake_field` (intentional ask), or
- Model calls `set_intake_*` or `update_intake` with a **junk/unusable** value for a field that **has** a LiveKit task (e.g. phone `"}"`, placeholder `"null"`).

It does **not** run active collection for a field that is simply **omitted** or **null** in `update_intake` — omission means “nothing new this turn,” not “go ask.”

**Usability checks:** `voice-runtime-python/transovo_voice/voice_v3/intake_value_usability.py` (when deployed).

---

## 5. How the agent “already knows what it got”

Three mechanisms work together:

| Mechanism | What it does |
|-----------|----------------|
| **Persisted state** | `VoiceV3CallContext.intake.values[fieldKey]` with value, revision, `verificationStatus` |
| **Tool responses** | Every successful `update_intake` returns `missing_required_fields` and objective status |
| **Live context injection** | `buildSharedCallerFactsLiveSummary()` pushed to Live thinking/commentary after updates |

**Key file:** `new-app/lib/server/voice-v3/intake-objective/build-shared-caller-facts.ts`

Prompts (`astra-intake-instructions.ts`) explicitly say:

- Use `update_intake` for multi-field statements.
- Do **not** re-ask for fields already reported as collected.
- Use `collect_intake_field` only when you **still need** a specific missing field and must ask.

**Objective engine:** `deriveIntakeObjective()` computes required vs missing per active operation (book, callback, etc.) — `derive-intake-objective.ts`, `operation-requirements.ts`.

---

## 6. Custom fields (e.g. “favorite dinosaur”)

| Aspect | Behavior |
|--------|----------|
| Wizard | Custom collect field → `type: "text"` (unless email/phone id) |
| Tools | `set_intake_favorite_dinosaur` + included in `update_intake` schema |
| LiveKit task | **None** (`livekit_function_tool`) |
| Collection | Agent asks in natural language; persists via `update_intake` or `set_intake_*` when clear |
| Validation | Text/enum rules in `validate-intake-value.ts` only — no GetDinosaurTask |

This is why you keep **Transovo bulk intake**: LiveKit ships collectors for common PII shapes, not arbitrary business questions.

---

## 7. Side-by-side: Transovo hybrid vs “LiveKit only”

### 7.1 One caller sentence with three facts

| Approach | What happens |
|----------|----------------|
| **Transovo (current)** | Model calls **`update_intake`** once with `name`, `phone`, `email` set and other keys `null`. Node validates and merges. One round-trip. |
| **LiveKit only** | No single first-party “save these 3 fields” tool. Typical pattern: three separate task invocations or three passive string tools — **three** structured collection flows or three LLM-extracted strings without shared bulk schema. |

### 7.2 “What’s your phone number?” (field still missing)

| Approach | What happens |
|----------|----------------|
| **Transovo (intended)** | Model calls **`collect_intake_field`** `{ "field_key": "phone" }` → `GetPhoneNumberTask` → `update_intake`. |
| **Transovo (misuse)** | Model puts guessed digits in `update_intake` → Node may reject; worker may fallback to `GetPhoneNumberTask` if value is junk. |
| **LiveKit only** | Always route through `GetPhoneNumberTask` (or equivalent) for that field — no shared Node validation layer unless you add it. |

### 7.3 Email / name / address / DOB

Same pattern as phone: **`collect_intake_field`** maps to `GetEmailTask`, `GetNameTask`, `GetAddressTask`, `GetDOBTask` via `resolve_intake_collection_kind`.

Passive capture of clear values still goes through **`update_intake`** (bulk) or **`set_intake_*`** (single) on Node with type validation.

### 7.4 Custom wizard field

| Approach | What happens |
|----------|----------------|
| **Transovo** | `update_intake` / `set_intake_customkey`; no LiveKit task. |
| **LiveKit only** | Custom `function_tool` or free conversation; you implement validation and persistence yourself. |

### 7.5 Remembering state / not re-asking

| Approach | What happens |
|----------|----------------|
| **Transovo** | Central call runtime + objective + **SHARED CALLER FACTS** in Live context; null keys in `update_intake` do not wipe prior values. |
| **LiveKit only** | You must maintain session/userdata and prompt the model with what was collected; LiveKit tasks do not automatically merge with your CRM schema. |

---

## 8. Validation rules (Node — authoritative)

| Type | Normalization |
|------|----------------|
| `phone` | E.164 via `normalizePhoneE164`; rejects placeholders |
| `email` | Lowercase + regex |
| `number` | Parsed number |
| `text` + `enumValues` | Must match enum |
| Other text | Trimmed string |

**Key file:** `new-app/lib/server/voice-v3/intake-objective/validate-intake-value.ts`

On `INVALID_FORMAT` / `EMPTY_VALUE` for fields with LiveKit collectors, Node may attach recovery hint: `use_collect_intake_field: true` (`update-intake-tool.ts`).

---

## 9. Prompts that steer tool choice

| File | Role |
|------|------|
| `astra-intake-instructions.ts` | Bulk vs individual LiveKit collection; don’t re-ask persisted fields |
| `astra-backend-instructions.ts` | Booking link + phone collection notes |
| `UPDATE_INTAKE_TOOL_DESCRIPTION` | Model-facing bulk save contract |

Republish receptionist / new prompt fingerprint after prompt changes.

---

## 10. File map (quick navigation)

| Concern | Path |
|---------|------|
| Wizard → intake fields | `new-app/lib/server/voice-v3/config/wizard-collect-fields-v3.ts` |
| Bulk tool schema | `new-app/lib/server/voice-v3/intake-objective/build-intake-tool-schema.ts` |
| Bulk tool execute | `new-app/lib/server/voice-v3/tools/update-intake-tool.ts` |
| Per-field + collect tools | `new-app/lib/server/voice-v3/tools/livekit-intake-tool-schemas.ts` |
| LiveKit kind map (TS) | `new-app/lib/server/voice-v3/intake-objective/resolve-intake-collection-kind.ts` |
| LiveKit kind map (Python) | `voice-runtime-python/transovo_voice/voice_v3/intake_collection.py` |
| Active tasks (Python) | `voice-runtime-python/transovo_voice/voice_v3/intake_active_collection.py` |
| Worker tool wiring | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| Session tool surface | `new-app/lib/server/voice-v3/resolve-livekit-session.ts` |
| “Already have …” summary | `new-app/lib/server/voice-v3/intake-objective/build-shared-caller-facts.ts` |
| Missing / complete | `new-app/lib/server/voice-v3/intake-objective/derive-intake-objective.ts` |

---

## 11. Design takeaway (for your comparison)

| Layer | Own it in Transovo | Delegate to LiveKit |
|-------|--------------------|---------------------|
| **Which fields exist** | Wizard `intakeFields` | — |
| **Multi-field utterance** | `update_intake` | — |
| **Arbitrary questions** | `update_intake` / `set_intake_*` | — |
| **Authoritative state + “don’t ask again”** | Call runtime + objective + shared facts | — |
| **Ask for phone/email/name/address/DOB with correction UX** | Orchestrate via `collect_intake_field` | `Get*Task` implementations |
| **Fix model junk on passive save** | Node reject + optional worker fallback | Active task re-prompt |

**Worker redeploy** is required for Python changes (`tools.py`, `intake_active_collection.py`, `intake_value_usability.py`). **Web deploy** carries Node/TS changes. **Republish agent** carries prompt/tool description changes.

---

## 12. Example flows (end-to-end)

### A — Bulk (preferred when caller volunteers everything)

1. Caller: “I’m Anthony, phone 555-123-4567, email anthony@example.com.”
2. Model: `update_intake({ name, phone, email filled; other keys null })`.
3. Node: merges three fields; response `missing_required_fields: []` if nothing else required.
4. Live context: SHARED CALLER FACTS lists all three → model should not ask again.

### B — Individual LiveKit field (preferred when agent must ask)

1. Name and email already saved.
2. Model: `collect_intake_field({ field_key: "phone" })`.
3. Python: `GetPhoneNumberTask` conversation.
4. Python: `update_intake({ phone: "+1..." })` on Node.
5. Facts summary updated; send_booking_link can omit `destination_phone` if policy uses ANI.

### C — Custom field

1. Wizard field `favorite_dinosaur` (text).
2. Caller: “Triceratops.”
3. Model: `update_intake({ favorite_dinosaur: "Triceratops", ...nulls })` or `set_intake_favorite_dinosaur({ value: "Triceratops" })`.
4. No LiveKit task involved.

---

*Generated for internal architecture comparison — Voice V3 receptionist / booking-link intake.*
