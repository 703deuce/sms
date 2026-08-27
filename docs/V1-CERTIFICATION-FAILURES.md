# V1 Certification Failures

Live list. Launch-blocking items are fixed in this same workstream, not parked.

| ID | Page | Action | Failure | Root cause | Fix | Retest result |
| --- | --- | --- | --- | --- | --- | --- |
| F001 | Header | Personal / Business toggle | Family/personal mode still visible | `WorkspaceModeToggle` in header | Removed toggle; workspace type is always BUSINESS | code PASS; prod browser routes PASS (toggle not deployed until PR #276 merge) |
| F002 | Dashboard / Compliance | HP / A2P status | Pages showed not compliant and 866 numbers | Metrics used first Active number + Mass Text registration `not_started`; 866 TFV treated as workspace blocker | Prefer `+15714073615`; 10DLC-approved local beats unverified 8xx; dashboard A2P uses sending-number status | code PASS; prod browser 27/27 routes PASS (HP metrics need deploy) |
| F003 | Send / Conversations | Outbound SMS from | Could send or display 866 as from-number | `take: 1` unordered; no HP preference on send | `pickPreferredSmsSendingNumber` in shell + `sendQuickSms` | code PASS; live SMS pending after deploy |
