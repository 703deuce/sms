# MCTB Analytics — metric definitions

All metrics respect the selected range (`7d`, `30d`, `90d`) unless noted.

## Recovery

| Metric | Definition |
|--------|------------|
| **Missed calls** | Count of `missedCallEvent` rows with `detectedAt >= since`. |
| **Recovery texts sent** | Missed-call events in range where `smsSentAt` is set OR `status === 'SENT'`. |
| **Customers replied** | Count of events in range with `status === 'CUSTOMER_REPLIED'`. |
| **Reply rate** | `round(100 * replied / textsSent)`; **0%** if `textsSent === 0`. Denominator is texts sent, not missed calls. |

## Delivery & engagement

| Metric | Definition |
|--------|------------|
| **Delivery rate (UI)** | `round(100 * textsSent / totalMissed)` — share of missed-call events that received a recovery text attempt. **Not** carrier SMS delivery confirmation. |
| **Delivery failures** | Events with `status === 'FAILED'`. Suppressed events are **not** counted as failures. |
| **Link clicks** | `linkClickEvent` in range where `missedCallEventId` is set. |
| **Opt-outs** | Suppressed events with `suppressionReason === 'OPTED_OUT'`. |

## Voicemail

| Metric | Definition |
|--------|------------|
| **Voicemails in range** | `voicemailMessage` count with `createdAt >= since`. |

## Suppression

Counts only events with `status === 'SUPPRESSED'` and non-null `suppressionReason`. Table **%** is share of suppressed events in the selected range (not share of all missed calls).

## Timezone

Uses server runtime `Date` for `since` and bucket keys (`YYYY-MM-DD` UTC slice from `toISOString`). Document for ops; workspace timezone alignment is a future enhancement.
