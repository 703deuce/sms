# AI Lead Recovery — Policy Engine

## Separation rule

| Layer | Question |
|-------|----------|
| **Intent** | What does the customer want? |
| **Policy** | What does **this business** want Transovo to do? |
| **Runtime** | How is that executed deterministically? |

Never hardcode workspace behavior in LLM prompts (e.g. “if emergency, text owner”).

## API

```ts
evaluateLeadRecoveryPolicy({
  workspace,      // loadLeadRecoveryConfig(workspaceId)
  intent,           // StructuredLeadIntent
  collectedData,
  conversationState,
})
```

Returns phases: `COLLECT` | `EXECUTE` | `CLARIFY` | `HANDOFF`, plus `nextActions`, `blockedActions`, `responseConstraints`.

## Configuration

Stored at `customFieldsConfig.mctb.leadRecovery` (same schema for Setup UI and runtime).

Loader: `src/lib/mctb/lead-recovery/config.ts`

## Modes

- `STANDARD` — enabled actions per policy
- `CAPTURE_ONLY` — collect + notify only
- `INFORMATION_ONLY` — collect + notify, no booking/payment automation

## Re-evaluation

Policy is re-evaluated after each material turn; do not pre-compute entire conversation paths in the model.

## Implementation

`src/lib/mctb/lead-recovery/policy-engine.ts`
