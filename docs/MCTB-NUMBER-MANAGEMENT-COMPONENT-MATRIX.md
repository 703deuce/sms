# MCTB number management — component matrix

| COMPONENT | WHERE | READ | ACTION | PERSISTENCE | PROVIDER | ERROR | STATUS |
|-----------|-------|------|--------|-------------|----------|-------|--------|
| Manage number button | Phone & Forwarding | setup GET | Open drawer | — | — | — | CONNECTED_AND_WORKING |
| Choose number button | Phone & Forwarding | setup GET | Open add drawer | — | — | — | CONNECTED_AND_WORKING |
| Messaging status chip | Phone & Forwarding | phone messagingStatus | Open verify drawer | — | — | — | CONNECTED_AND_WORKING |
| Number summary | Manage drawer | GET `/api/mctb/numbers` | — | — | — | Banner | CONNECTED_AND_WORKING |
| Copy number | Manage drawer | row.e164 | clipboard | — | — | — | CONNECTED_AND_WORKING |
| Use this number | Manage drawer | list | POST select | MCTB config | — | Inline | CONNECTED_AND_WORKING |
| Add another number | Manage drawer | — | Open add | — | — | — | CONNECTED_AND_WORKING |
| Assign recommended | Add drawer | — | POST provision_auto | onboarding state + phone row | Telnyx/Twilio provision | Inline | CONNECTED_AND_WORKING |
| Search numbers | Add drawer | — | POST premium/search | search log | Telnyx/Twilio inventory | Inline | CONNECTED_AND_WORKING |
| Select search result | Add drawer | search | reserve + complete | phone row | purchase | Inline | CONNECTED_AND_WORKING |
| Submit verification | Verify drawer | GET tfv + setup | POST `/api/mctb/tfv` | TFV record | Twilio TFV | Inline | CONNECTED_AND_WORKING |
| Edit business/campaign | Verify drawer | — | Link `/compliance/*` | registration | — | — | CONNECTED_AND_WORKING |
| Legacy `/mctb/numbers` | Redirect | — | 302 → phone?open=manage | — | — | — | CONNECTED_AND_WORKING |
| Onboarding TFV/number | Recovery step | onboarding GET | Same drawers | — | — | — | CONNECTED_AND_WORKING |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0**
