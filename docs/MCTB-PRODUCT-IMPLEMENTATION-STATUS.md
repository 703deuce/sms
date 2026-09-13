# MCTB + Payments — current implementation status (source of truth)

**Last reconciled:** 2026-09-13  
**Supersedes:** Older screenshots or notes that say AI Booking is “not wired yet,” Stripe invoice mode is “future only,” or Lead Recovery is “backend only.”

---

## AI Booking (runtime)

| Item | Status |
|------|--------|
| Conversation runtime wired | **YES** — `handleMctbAiBookingInboundSms` |
| Durable session | **YES** — `mctb_ai_booking_sessions` / Prisma store |
| Setup config persisted | **YES** — `customFieldsConfig.mctb.aiBooking` |
| `BOOKING_CONFIRMED` persisted | **YES** — `mctb_conversation_booking_activities` |

**Environment-dependent means ONLY (not missing app code):**

- Real Calendly or Microsoft connection + booking target
- DB migrations applied
- Workspace entitled / `aiBooking.enabled` (or Lead Recovery `AI_BOOK` policy)
- Live MCTB SMS sender + provider capabilities/scopes
- OpenAI optional (deterministic fallbacks exist)

Detail: `docs/MCTB-AI-BOOKING-IMPLEMENTATION-STATUS.md`

**Do not reopen** AI Booking architecture unless a **failing test** proves a code defect.

---

## AI Lead Recovery

| Item | Status |
|------|--------|
| Intent → policy → action runtime | **YES** — `src/lib/mctb/lead-recovery/*` |
| Inbound SMS order | Handoff → Lead Recovery → John fallback (legacy AI Booking bypass when LR enabled) |
| Canonical config | `customFieldsConfig.mctb.leadRecovery` |
| Dedicated UI | **YES** — `/mctb/ai-lead-recovery` |
| Multi-intent sequencing | **YES** — `intent-plan.ts` |
| Text-to-Pay action (policy) | **YES** — authoritative amount required |
| Domain activity events | **YES** — booking activity ledger + idempotency |

Rulebooks: `docs/runtime-rules/AI-LEAD-RECOVERY-*.md`

---

## Stripe Connect Text-to-Pay

| Flag | Value |
|------|--------|
| `CANONICAL_CHARGE_MODEL` | **DIRECT** |
| `PAID_FROM_BROWSER_RETURN` | **NO** |
| `PAID_FROM_VERIFIED_PROVIDER_STATE_ONLY` | **YES** |
| `STRIPE_SEND_INVOICE` (backend) | **WIRED** |
| `STRIPE_SEND_INVOICE` (Payments UI) | **WIRED** — Request payment drawer |
| `STRIPE_CONNECTED_ACCOUNT_REFUNDS` | **WIRED** |
| `STRIPE_EVENT_ACCOUNT_TENANT_VALIDATION` | **WIRED** |
| `CROSS_WORKSPACE_STRIPE_MUTATIONS` | **BLOCKED** |

Detail: `docs/runtime-rules/providers/STRIPE-CONNECT-TEXT-TO-PAY-CONFORMANCE-AUDIT.md`

**Do not rebuild** Stripe architecture.

**Environment-dependent:** Stripe Connect onboarding, `charges_enabled`, webhook endpoint + `event.account`, Prisma migration for invoice/refund columns.

---

## Microsoft / Calendly provider rulebooks

- Microsoft full operations appendix: **YES**
- Stripe + Microsoft conformance tests in `scripts/test-*-conformance*.ts`

---

## Remaining product work (not architecture)

1. **Polish** AI Lead Recovery page (structured test results, all scenario panels, Overview status card).
2. **Live validation** with real calendar, SMS, Stripe, and migrations in target environment.
3. Incremental UX on Payments (refund from detail drawer, invoice status copy).

---

## Obsolete language — do not use

- “AI Booking not wired yet”
- “BOOKING_CONFIRMED not persisted”
- “Stripe Send Invoice not implemented” (backend + UI selector)
- “Lead Recovery needs a new architecture pass”
