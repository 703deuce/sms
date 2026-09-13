# AI Lead Recovery — Config Schema

**Single source of truth:** `customFieldsConfig.mctb.leadRecovery` — Setup UI and runtime must read/write this structure.

## Top-level

```json
{
  "enabled": true,
  "version": 1,
  "globalMode": "STANDARD",
  "enabledIntents": ["BOOKING_REQUEST", "EMERGENCY_OR_URGENT"],
  "intentPolicies": { "BOOKING_REQUEST": { ... } },
  "fallbackPolicy": { ... },
  "collectCapabilities": ["NAME", "ADDRESS", "REASON"],
  "answerCapabilities": ["HOURS", "FAQ"],
  "actionCapabilities": ["SEND_BOOKING_LINK", "AI_BOOK"],
  "handoffTriggers": {
    "uncertain": true,
    "complaint": true,
    "sensitive": true,
    "emergency": true,
    "highValue": false
  },
  "bookingLinkId": "..."
}
```

## Per-intent policy shape

```json
{
  "enabled": true,
  "collect": ["ADDRESS", "ISSUE_DESCRIPTION"],
  "mode": "AI_BOOK",
  "actions": ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
  "customerMessage": "Someone will contact you shortly.",
  "conditions": [],
  "providerConfiguration": {},
  "escalation": { "escalateHuman": false }
}
```

## Validation

- `AI_BOOK` without calendar readiness → `policyHealth: NEEDS_CONFIGURATION`
- Unknown action in stored policy → do not execute; mark needs configuration
- No OAuth tokens or Stripe secrets in policy — only connection/target IDs

## Types

`src/lib/mctb/lead-recovery/types.ts`  
Loader/saver: `src/lib/mctb/lead-recovery/config.ts`

## Defaults

When `leadRecovery` is absent but `mctb.aiBooking.enabled` is true, loader enables lead recovery and maps booking policy to `AI_BOOK`.

## Migration / duplicate runtime

- **UI:** `/mctb/ai-lead-recovery` is the canonical policy editor; `mctb.aiBooking` setup fields remain for provider OAuth/targets only until fully merged.
- **Runtime:** When `leadRecovery.enabled`, legacy top-level `handleMctbAiBookingInboundSms` bypass is **disabled**; `AI_BOOK` enters only via Lead Recovery action routing.
- **Removal target:** Delete standalone AI Booking SMS shortcut after all workspaces persist `leadRecovery` (no synthetic-only config).
