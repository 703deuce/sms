# MCTB launch item — explicit PLATFORM vs CUSTOMER SMS sender mode

**Status:** Separate from PR #483 (Call Handling). **Not implemented** in Call Handling work.

## Problem

Today, split-sender behavior can rely on:

- `phoneNumberId` (voice ingress) as first SMS candidate
- `smsPhoneNumberId` as second candidate when ids differ
- **Authorization order** picking the first approved sender

That can make a **platform sender** win indirectly when the voice ingress is **not** SMS-authorized. That is fragile product semantics, not an intentional “platform mode.”

## Target product semantics (future)

| Mode | Behavior |
|------|----------|
| **PLATFORM** | Outbound MCTB recovery always uses configured Transovo platform sender |
| **CUSTOMER** | Outbound uses configured customer A2P/TFV sender |

Do **not** rely permanently on “ingress isn’t authorized, therefore second candidate wins.”

## Scope note

PR #483 does **not** change MCTB SMS runtime. This item remains for MCTB launch / messaging configuration.
