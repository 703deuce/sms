# MCTB AI Booking — implementation status (reconciled)

> **Canonical summary:** `docs/MCTB-PRODUCT-IMPLEMENTATION-STATUS.md`  
> This file is the AI Booking–specific detail. Older screenshots saying **“Not wired yet”** are **obsolete**.

| Capability | Status | Evidence |
|------------|--------|----------|
| **Conversation runtime wired** | **YES** | `handleMctbAiBookingInboundSms` in `src/lib/mctb/ai-booking/conversation-runtime.ts`; called from `customer-sms.ts` (directly or via Lead Recovery `AI_BOOK` delegate) |
| **Durable session store** | **YES** | Prisma `MctbAiBookingSession` / `mctb_ai_booking_sessions`; `session-store-prisma.ts` (45m TTL), not ephemeral-only |
| **Setup config persisted** | **YES** | `customFieldsConfig.mctb.aiBooking` via `loadMctbAiBookingConfig` / `saveMctbAiBookingConfig`; API `GET/POST /api/mctb/ai-booking/config` |
| **BOOKING_CONFIRMED persisted** | **YES** | `recordMctbBookingConfirmedActivity` → `mctb_conversation_booking_activities` kind `BOOKING_CONFIRMED`; invoked from `conversation-runtime.ts` on provider success |

## What is still environment-dependent (only after the above)

These require a **real workspace** with integrations — not missing application wiring:

- Connected **Calendly** or **Microsoft** calendar with passing **preflight/readiness**
- **MCTB SMS** sender approved for live inbound/outbound
- **OpenAI** key optional (deterministic fallbacks exist)
- **Entitlement** / `aiBooking.enabled` in workspace config

## Lead Recovery overlay

Inbound SMS primary path is **AI Lead Recovery** (`handleMctbLeadRecoveryInboundSms`). Booking remains one policy action that delegates to the same AI Booking runtime above.

## Do not use as blockers

- “Not wired yet” on conversation runtime / session / setup / BOOKING_CONFIRMED — **obsolete**
- “Environment dependent” **without** distinguishing missing calendar/SMS vs missing code — use this table instead
