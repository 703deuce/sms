# Voice V3 callback — tool, prompts, and code reference

Copy-friendly reference for how callback works in Voice V3: tool name, wiring, descriptions, schema, executors, and what Amy vs Astra actually see.

**Cert agent:** `cmshz2lc25c622c4i58303501` (ws_1)  
**Related artifact:** `/opt/cursor/artifacts/voice-v3-callback-effective-contract-ws1.json`  
**Regenerate contract dump:** `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/dump-voice-v3-callback-effective-contract.ts`

---

## 1. Tool name and who uses it

- **OpenAI function name:** `request_callback`
- **Who calls it:** **Astra** (delegated `gpt-6-astra` on Live `sessions.accept`), not Amy. Amy only delegates; she does not get tool schemas.
- **Registration:** catalog entry → `buildVoiceV3AstraFunctionTools` → `buildVoiceV3AstraDelegationResponses(...).tools` on session accept.

### Catalog entry

**File:** `src/lib/voice-v3/tools/voice-tool-catalog.ts`

```typescript
  {
    name: "request_callback",
    kind: "mutation",
    telemetryName: "request_callback",
    definition: requestCallbackTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildRequestCallbackOpenAiTool,
  },
```

Gating in same file:

```typescript
    case "request_callback":
      return isRequestCallbackAuthorized(config);
```

### Delegation attach (session accept)

**File:** `src/lib/voice-v3/intake/delegation-config.ts`

```typescript
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
  agentConfig: VoiceV3AgentConfig = resolveVoiceV3AgentConfig(),
): ResponsesDelegationConfig {
  const intakeEnabled = voiceV3IntakePipelineEnabled();
  const transport = resolveVoiceV3IntakeTransport();
  const useFunctionTool = intakeEnabled && transport === "function_tool";

  const tools = useFunctionTool ? buildVoiceV3AstraFunctionTools(agentConfig) : [];

  return {
    model: VOICE_V3_ASTRA_MODEL,
    instructions: astraInstructions,
    reasoning: {
      effort: "low",
    },
    text: {
      verbosity: "low",
    },
    parallel_tool_calls: useFunctionTool && voiceV3DelegationParallelToolCallsEnabled(),
    tool_choice: useFunctionTool ? "auto" : "auto",
    max_output_tokens: intakeEnabled ? 768 : 200,
    tools,
  };
}
```

### Build entrypoint

**File:** `src/lib/voice-v3/tools/build-openai-tools.ts`

```typescript
export function buildVoiceV3AstraFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  return buildVoiceV3AstraFunctionToolsFromCatalog(config);
}
```

### Authorization gate

**File:** `src/lib/voice-v3/tools/authorize-tool-for-config.ts`

```typescript
export function isRequestCallbackAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.callHandling.callbackRequestsEnabled === true;
}
```

```typescript
    case "request_callback":
      return isRequestCallbackAuthorized(config);
```

---

## 2. Tool description (what Astra reads on the function)

This is the **only** place the word “callback” appears in the compiled Astra instruction bundle; it is **not** repeated in the ~8903-char Astra system prompt body.

**File:** `src/lib/voice-v3/tools/astra-tool-contracts.ts`

```typescript
export const REQUEST_CALLBACK_TOOL_DESCRIPTION = `Authoritative action to arrange a business callback on this call. Use when the caller asks for a callback, asks someone from the business to contact them later, cannot complete another action and wants human follow-up, or changes from another workflow such as booking or receiving a booking link to requesting a callback instead. Do not use merely because the caller has a general question you can answer from business knowledge. Before submitting, ensure only the configured callback-required information is known — reuse facts already collected during this call via update_intake and do not ask for booking-only fields (email, scheduling preference, booking notes, etc.) unless they are also required for callback. Null callback_phone uses the trusted inbound caller number when configured; provide callback_phone only when the caller wants a different number. Null reason is allowed when the reason is already stored in shared call facts. You must invoke this tool to arrange a callback — conversational reassurance alone does not record anything. Do not tell the caller that someone will call them back, that the callback is arranged, recorded, or confirmed until this tool returns callback_requested with success. If required callback facts are still missing, collect only those missing callback fields, then call this tool. If the tool fails or returns needs_information, do not claim success.`;
```

---

## 3. Tool schema + OpenAI wire format (Zod → strict function)

**File:** `src/lib/voice-v3/tools/request-callback-tool.ts`

```typescript
const requestCallbackArgsSchema = z.object({
  callback_phone: z
    .string()
    .nullable()
    .describe(
      "Callback number when the caller wants a different number than the inbound line. Null to use shared call facts or trusted inbound caller ID.",
    ),
  reason: z
    .string()
    .nullable()
    .describe(
      "Why the caller wants a callback, when not already stored in shared call facts.",
    ),
  preferred_time: z
    .string()
    .nullable()
    .describe(
      "Optional natural-language callback time preference (morning, afternoon, anytime, etc.). Not a scheduled appointment.",
    ),
  notes: z
    .string()
    .nullable()
    .describe("Optional extra notes for the business; not trusted configuration."),
});

export type RequestCallbackArgs = z.infer<typeof requestCallbackArgsSchema>;

export function buildRequestCallbackOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "request_callback",
    parameters: requestCallbackArgsSchema,
    description: REQUEST_CALLBACK_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}
```

**Note:** On the cert agent, the compiled JSON schema marks all four properties as required (each may be `null`). **Name / phone / service_reason** requirements are **not** in the schema; they come from `operationRequirements.request_callback` and `src/lib/voice-v3/callback/callback-requirements.ts` at execution time.

**Cert agent `operationRequirements.request_callback`:**

```json
["name", "phone", "service_reason"]
```

**Booking contrast:**

```json
["name", "phone", "email", "service_reason", "mother_s_name"]
```

---

## 4. Runtime tool handler (what runs when Astra calls the function)

**File:** `src/lib/voice-v3/tools/request-callback-tool.ts`

```typescript
export const requestCallbackTool: VoiceToolDefinition<RequestCallbackArgs> = {
  name: "request_callback",
  description: "request_callback",
  parameters: {},
  validate: (raw) => requestCallbackArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeRequestCallbackOrError(config);
    if (denied) return denied;

    let snap = mergeDialogActiveGoalFromTool(ctx.runtime.getSnapshot(), "REQUEST_CALLBACK");
    ctx.runtime.replaceContext(snap);
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const { executeRequestCallback } = await import("../callback/execute-request-callback");
    const { result, nextContext } = await executeRequestCallback({
      workspaceId,
      agentId: config.agentId ?? null,
      config,
      context: snap,
      args,
    });
    ctx.runtime.replaceContext(nextContext);
    return result;
  },
};
```

---

## 5. Executor (requirements, ANI, persist, tool results)

**File:** `src/lib/voice-v3/callback/execute-request-callback.ts`

Key flow:

1. Check `callbackRequestsEnabled`
2. `getMissingCallbackRequirementKeys` → `needs_information` + `missingFields` if incomplete
3. `resolveCallbackPhoneE164` (arg, intake phone, or ANI when `callbackUseAniByDefault`)
4. Idempotency → `persistVoiceV3CallbackRequest`
5. Success: `callback_requested` + set `dialog.activeGoal: "REQUEST_CALLBACK"` via `withCallback`

```typescript
export async function executeRequestCallback(
  input: ExecuteRequestCallbackInput,
): Promise<ExecuteRequestCallbackOutput> {
  const { config, context, args } = input;
  let ctx = context;

  console.log("VOICE_V3_CALLBACK_REQUEST_STARTED", {
    callId: ctx.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  if (!config.callHandling.callbackRequestsEnabled) {
    return {
      result: toolOk("not_available", { status: "not_available" }),
      nextContext: ctx,
    };
  }

  ctx = withCallback(ctx, callbackFromContext(ctx));

  const missing = getMissingCallbackRequirementKeys(config, ctx, args);
  if (missing.length > 0) {
    console.log("VOICE_V3_CALLBACK_REQUIREMENTS_MISSING", {
      callId: ctx.callId,
      missingFields: missing,
    });
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: missing,
      }),
      nextContext: ctx,
    };
  }

  const callbackPhone = resolveCallbackPhoneE164(config, ctx, args);
  if (!callbackPhone) {
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: ["phone"],
      }),
      nextContext: ctx,
    };
  }

  const reason = resolveCallbackReasonText(config, ctx, args);
  const callerName = resolveCallbackCallerName(ctx);
  const preferredTime = args.preferred_time?.trim() || null;

  // ... idempotency, persistVoiceV3CallbackRequest, callback_requested ...
}
```

**Requirements helper:** `src/lib/voice-v3/callback/callback-requirements.ts` (`resolveConfiguredCallbackRequiredKeys`, `getMissingCallbackRequirementKeys`, ANI policy).

---

## 6. Persistence

**File:** `src/lib/voice-v3/callback/persist-voice-v3-callback-request.ts`

```typescript
export async function persistVoiceV3CallbackRequest(
  input: VoiceV3CallbackPersistInput,
): Promise<VoiceV3CallbackPersistResult> {
  const prisma = getPrisma();
  const existing = await prisma.callbackRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      metadata: {
        path: ["voiceV3", "idempotencyKey"],
        equals: input.idempotencyKey,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, callbackRequestId: existing.id, duplicate: true };
  }

  const row = await prisma.callbackRequest.create({
    data: {
      workspaceId: input.workspaceId,
      callerE164: input.callbackPhoneE164,
      businessE164: input.businessE164,
      phoneNumberId: input.phoneNumberId,
      reason: input.reason,
      notes: input.notes,
      status: "new",
      sourceRoute: "voice_v3_request_callback",
      metadata: {
        source: "VOICE_V3",
        voiceV3: {
          idempotencyKey: input.idempotencyKey,
          lifecycleStatus: "REQUESTED",
          callId: input.callId,
          liveSessionId: input.liveSessionId,
          agentId: input.agentId,
          callerName: input.callerName,
          inboundAni: input.inboundAni,
          preferredCallbackTime: input.preferredTime,
          customFieldsSnapshot: input.customFieldsSnapshot,
        },
      },
    },
    select: { id: true },
  });
  // ...
}
```

---

## 7. Prompt parts — Amy (GPT-Live)

Amy instructions: `src/lib/voice-v3/prompts/live-frontend-instructions.ts` (includes delegation policy, capability summary, truth rules).

### Delegation policy (no callback bullet)

**File:** `src/lib/voice-v3/prompts/live-delegation-policy.ts`

```typescript
export function buildLiveDelegationPolicySection(
  config?: VoiceV3AgentConfig,
): string {
  const caps = config?.capabilities;
  const backendCaps: string[] = [];
  if (!caps || caps.collectIntake) {
    backendCaps.push("- Save or correct caller information required by the business.");
  }
  if (!caps || caps.checkAvailability) {
    backendCaps.push("- Check real appointment availability.");
  }
  if (!caps || caps.bookAppointments) {
    backendCaps.push("- Create new appointments.");
  }
  if (!caps || caps.findAppointments) {
    backendCaps.push("- Find existing appointments.");
  }
  if (!caps || caps.rescheduleAppointments) {
    backendCaps.push("- Reschedule existing appointments.");
  }
  if (!caps || caps.cancelAppointments) {
    backendCaps.push("- Cancel existing appointments.");
  }
  if (!caps || caps.transferCalls) {
    backendCaps.push("- Transfer the live call to an authorized human or destination.");
  }
  backendCaps.push(
    "- End the telephone call through the telephony/application layer when appropriate.",
  );

  return `
# DELEGATION POLICY

Backend capabilities:
${backendCaps.join("\n")}

Delegate to the backend when:
- The caller asks what appointment dates or times are available.
- The caller asks whether a specific appointment time is available.
- The caller wants to create an appointment.
- The caller wants information about an appointment that already exists.
- The caller wants to reschedule an existing appointment.
- The caller wants to cancel an existing appointment.
- The caller provides or corrects information that must be stored in authoritative business state.
- The caller asks for a real call transfer or accepts a transfer.
- A correction changes backend work that has already been requested or is currently in progress.
- The answer depends on authoritative application state, provider state, or an external action.
- Careful backend reasoning is required beyond a simple conversational response.

Do not delegate to the backend when:
- The caller is greeting you or making ordinary conversation.
- You can answer naturally from the current conversation.
- The caller asks you to repeat or clarify a still-current result already available in the conversation.
- You need a brief conversational clarification before the backend could perform useful work.
- No authoritative application state, external lookup, external action, or backend reasoning is required.

Delegate before making a claim that depends on backend work.
Do not guess availability, booking state, cancellation state, transfer state, or any other external result while backend work is pending.
Continue the natural spoken conversation while backend work is running when the next conversational response does not depend on that result.
An interruption in conversation does not automatically cancel backend work.
If the caller corrects or changes a backend request, delegate the correction so the backend can update the active work.
Do not promise that an external action succeeded until verified backend/provider state supports that claim.
`.trim();
}
```

**Compiled Amy instructions on cert agent:** ~14,179 chars. Word **“callback” does not appear** in the compiled Amy text (`amy_contains_callback_word: false` in contract dump).

Amy has generic **TRUTH AND CONFIRMATION** in `live-frontend-instructions.ts` (never claim success without backend) but nothing naming callback or `request_callback`.

---

## 8. Prompt parts — Astra (system instructions)

Built in `src/lib/voice-v3/prompts/astra-backend-instructions.ts` from:

- `buildAstraBackendCoreInstructions()` — `src/lib/voice-v3/prompts/astra-backend-core-instructions.ts`
- Business / intake catalog / booking strategy append
- `buildAstraIntakeInstructions()` — `src/lib/voice-v3/prompts/astra-intake-instructions.ts`
- `buildAstraCrossToolInstructions()` — `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts`
- Closing: *“Each function tool description defines when to call…”*

**Compiled Astra instructions on cert agent:** ~8903 chars. Word **“callback” does not appear** in the instruction body (`astra_contains_callback_word: false`). Callback semantics are on the **tool description** only.

### Cross-tool paths (booking / reschedule / cancel — no callback path)

**File:** `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` (excerpt)

```text
Tool discipline (production):
1. One authoritative step at a time. Prefer the most specific tool for the caller's immediate need.
2. New booking path: update_intake (contact fields as needed) → set_scheduling_preference (date/time semantics) → find_availability → caller chooses slot → book_appointment.
3. Reschedule path: find_appointment → set_scheduling_preference (new time semantics) → find_availability → caller chooses slot → reschedule_appointment.
4. Cancel path: find_appointment → explicit caller confirmation → cancel_appointment with confirmed=true.
5. Never invent offer_set_id, slot_id, or provider_event_id. Only use values returned by tools in this call.
...
```

---

## 9. Intake / operation context (Live thinking append)

Not in Amy’s initial system prompt; pushed via `session.thinking.append` (e.g. after `update_intake`).

**File:** `src/lib/voice-v3/intake-objective/build-intake-context.ts`

```typescript
  return `
INTAKE OBJECTIVE
Purpose: ${objectiveDescription}
Active operation: ${operation}
Status: ${objective.status}
Required information (for this operation only):
${requiredLines.join("\n") || "(none configured)"}
Optional information:
${optionalLines.join("\n") || "(none configured)"}
Rules:
- Caller facts are shared for the whole call; only missing fields for the active operation need collection.
- When the caller changes intent (for example booking to callback), stop requiring fields that belong only to the previous operation.
- Persistent caller facts belong in intake state; incomplete scheduling preferences may stay conversational until find_availability has enough to search.
- Preserve already collected information.
- Collect missing required information naturally (model decides how to ask — no scripted next question from Transovo).
- The caller may provide multiple fields at once; one caller utterance may require multiple tools when appropriate.
- Do not unnecessarily ask again for information already collected or verified.
- Email fields marked for voice verification may show as candidate until confirmed.
`.trim();
```

**Active operation resolution:** `src/lib/voice-v3/intake-objective/operation-requirements.ts` — `UNKNOWN` / `GENERAL` defaults to **`book_appointment`** (or send_link strategy). `REQUEST_CALLBACK` goal maps to `request_callback` only after tool sets goal.

---

## 10. End-to-end flow

1. **Amy** delegates (Live creates `session.delegation`).
2. **Astra** receives `instructions` + `tools[]` including `request_callback`.
3. Astra calls **`request_callback`** (function call on delegated Responses).
4. **`requestCallbackTool.execute`** → **`executeRequestCallback`** → **`persistVoiceV3CallbackRequest`**.
5. Function output returned to delegation; Amy may speak using authoritative result.

**If Astra returns plain message text instead of a function call:** `handle-delegated-meaning.ts` logs `output_text.done_ignored` — no tool, no persistence.

---

## 11. Production tool surface (cert PSTN log fingerprint)

Both cert calls logged:

```text
VOICE_V3_TOOL_SURFACE_COMPILED {
  tool_count: 10,
  tools: [
    'update_intake',
    'set_scheduling_preference',
    'find_availability',
    'book_appointment',
    'find_appointment',
    'reschedule_appointment',
    'cancel_appointment',
    'transfer_call',
    'end_call',
    'request_callback'
  ]
}
```

Contract versions (Call A accept):

- `live_prompt_version`: `voice-v3-live-v2`
- `astra_prompt_version`: `voice-v3-astra-v2`
- `tool_contract_version`: `1df5e2c6553b4af8`
- `astra_instructions_hash`: `9494859c1a5bf893`

---

## 12. Related forensic reports

- `/opt/cursor/artifacts/voice-v3-callback-forensic-report-A-F.md` — PSTN cert root cause A–F
- `/opt/cursor/artifacts/voice-v3-callback-pstn-cert-2026-09-19-report.md` — cert timing summary
