# AI Lead Recovery — Action Registry

Finite product actions. The model cannot invent action names.

## Registry

Defined in `src/lib/mctb/lead-recovery/action-registry.ts`:

- `SEND_BOOKING_LINK`
- `AI_BOOK` → scheduling specialist + `handleMctbAiBookingInboundSms` (provider adapters follow Calendly/Microsoft rulebooks)
- `CREATE_CALLBACK_REQUEST`
- `SEND_OWNER_SMS` / `SEND_TEAM_SMS` / `SEND_EMAIL_SUMMARY`
- `ROUTE_TO_TEAM` / `ROUTE_TO_ON_CALL`
- `SEND_TEXT_TO_PAY` → PaymentRequest service → Stripe rulebook (never LLM → Stripe)
- `CHECK_PAYMENT_STATUS`
- `ANSWER_APPROVED_INFORMATION`
- `ESCALATE_HUMAN`
- `END_AUTOMATION` / `SUPPRESS_CONTACT`
- `FOLLOW_UP`
- `COLLECT_FIELD` / `CUSTOMER_MESSAGE` / `NO_OP`

## Authorization

Before execution (`action-runtime.ts` + policy):

1. Action enabled in workspace `actionCapabilities`
2. Policy permits action
3. Required fields present
4. Provider connected when required
5. Entitlements satisfied

## Provider mapping

| Product action | Provider rules |
|----------------|----------------|
| `AI_BOOK` | `CALENDLY-BOOKING-RULES.md`, `MICROSOFT-OUTLOOK-CALENDAR-RULES.md` |
| `SEND_TEXT_TO_PAY` | `STRIPE-CONNECT-TEXT-TO-PAY-RULES.md` |

Policy chooses **what**; provider adapters choose **how**.
