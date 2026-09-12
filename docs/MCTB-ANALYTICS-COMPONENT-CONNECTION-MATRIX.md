# MCTB Analytics — component connection matrix (abbreviated)

| Region | Component | Read source | Range | Action |
|--------|-----------|-------------|-------|--------|
| Header | Range 7/30/90 | URL `range` | sets all | `router.push` |
| KPI | Missed calls | `totalMissed` | yes | `/mctb/missed-calls?date=` |
| KPI | Recovery texts | `textsSent` | yes | missed calls |
| KPI | Replied | `replies` | yes | conversations |
| KPI | Reply rate | computed | yes | — |
| Funnel | 4 steps | same KPIs | yes | display |
| Chart | Missed over time | `trends.missedCalls` | yes | missed calls list |
| Chart | Recovery over time | `trends.recoveryTexts` | yes | missed calls |
| Chart | Replies over time | `trends.replies` | yes | conversations |
| Delivery | rate/failures/clicks/opt-outs | loader fields | yes | — |
| Suppression | reason rows | `suppressionByReason` | yes | missed calls + `q` |
| Voicemail | count | `voicemailCount` | yes | `/mctb/voicemail` |

**TEST RESULT:** Unit tests for range mapping and labels; browser QA BLOCKED without live session.
