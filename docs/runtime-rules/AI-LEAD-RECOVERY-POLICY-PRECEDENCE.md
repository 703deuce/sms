# AI Lead Recovery — Policy Precedence

Deterministic order (lower number wins). Do not rely on DB insertion order.

| Rank | Category |
|------|----------|
| 1 | `OPT_OUT` / compliance |
| 2 | `WRONG_NUMBER` |
| 3 | `SENSITIVE_OR_HIGH_RISK` |
| 4 | `COMPLAINT` |
| 5 | `EMERGENCY_OR_URGENT` |
| 6 | Active transactional session (e.g. slot selection) |
| 7 | `EXISTING_CUSTOMER_ISSUE` |
| 8 | Custom workspace rules |
| 9 | Intent default policy |
| 10 | Unknown fallback |

Implementation: `src/lib/mctb/lead-recovery/policy-precedence.ts` — `pickPrimaryIntentForPolicy()` when multiple intents appear in one message.

## Multiple intents

Example: “Come tomorrow and how much?” → primary `BOOKING_REQUEST`, secondary `PRICING_QUESTION`. Policy engine sequences actions; do not drop secondary intents silently.
