# AI Lead Recovery — Universal Intent Catalog

Intent definitions are **global product behavior**. Workspaces may enable/disable handling; they must not redefine what an intent means.

## Pipeline

```
Inbound SMS → Intent Agent → structured intent → Policy Engine → specialist (optional) → Action Runtime → provider adapter
```

## Catalog

| Intent | Meaning |
|--------|---------|
| `GENERAL_INQUIRY` | Non-specific contact |
| `SERVICE_REQUEST` | Needs service / repair |
| `EMERGENCY_OR_URGENT` | Probable urgent safety issue |
| `CALLBACK_REQUEST` | Wants a phone call back |
| `BOOKING_REQUEST` | Wants an appointment |
| `SPECIFIC_TIME_REQUEST` | Named time/day preference |
| `PRICING_QUESTION` | Asks cost |
| `ESTIMATE_REQUEST` | Formal estimate |
| `SERVICE_AREA_CHECK` | Geographic eligibility |
| `AVAILABILITY_QUESTION` | When can you come (not booking yet) |
| `BUSINESS_HOURS` | Open/closed |
| `BUSINESS_FAQ` | General business question |
| `BUSINESS_LOCATION` | Where are you located |
| `EXISTING_CUSTOMER_ISSUE` | Prior customer / job |
| `RESCHEDULE_REQUEST` | Move appointment |
| `CANCEL_REQUEST` | Cancel appointment |
| `PAYMENT_REQUEST` | Pay / deposit |
| `PAYMENT_STATUS_QUESTION` | Payment status |
| `COMPLAINT` | Dissatisfaction |
| `SENSITIVE_OR_HIGH_RISK` | Safety / legal / medical risk |
| `WRONG_NUMBER` | Misdial |
| `OPT_OUT` | STOP / unsubscribe |
| `SPAM_VENDOR_RECRUITING` | Non-customer solicitation |
| `LANGUAGE_PREFERENCE` | Language choice |
| `UNKNOWN` | Insufficient confidence |

## Structured output

Runtime contract: `StructuredLeadIntent` in `src/lib/mctb/lead-recovery/types.ts`. No freeform prose as the runtime contract.

## Agent boundaries

- Intent Agent: classification only — **no** provider tools, **no** business policy.
- Implementation: `src/lib/mctb/lead-recovery/intent-agent.ts`
