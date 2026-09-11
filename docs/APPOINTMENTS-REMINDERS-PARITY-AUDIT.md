# Reminders — Competitive Parity Audit

| Capability | Result | Notes |
|------------|--------|-------|
| Multiple reminder steps | **PASS** | 3 core + `additionalSteps` |
| Custom timing | **PASS** | `minutesBefore` inline + time-of-day advanced |
| Add extra reminders | **PASS** | Up to 8 additional steps |
| Remove reminders | **PARTIAL** | Custom steps only; core steps disable |
| SMS | **PASS** | |
| Email | **PASS** | |
| Confirmation message | **PASS** | `confirmation` step at book |
| Per-offering override | **GAP** | Workspace default only |
| Service / Class / Workshop / Meeting | **PASS** | Same sequence; class occurrence uses `startsAt` |
| Cancellation suppression | **PASS** | `remindersSuppressed` |
| Reschedule recalculation | **PASS** | `reminderGeneration` bump |
| Last-minute booking | **PASS** | Past-due skip |
| Timezone | **PASS** | Platform timezone on config |
| Merge fields | **PASS** | Documented tags + renderer |
| Secure reschedule/cancel links | **PASS** | Tokens in merge vars |
| Delivery status / activity | **PARTIAL** | Timeline-based; not full provider webhook matrix |
| Failure reason | **PARTIAL** | When logged to timeline |
| SMS opt-out | **PASS** | Canonical suppression + consent |
| Quiet hours | **GAP** | Per-step skip only |
| Template reuse | **PASS** | Per-step templates on platform config |
| Form-completion link | **N/A** | Use workflow/template token if added later |
