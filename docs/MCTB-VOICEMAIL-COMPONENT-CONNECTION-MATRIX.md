# MCTB Voicemail — component connection matrix

| Component | Read | Write | Persistence | Downstream | Error | Status |
|-----------|------|-------|-------------|------------|-------|--------|
| Number selector | numbers prop, URL | router numberId | — | filters GET | — | CONNECTED_AND_WORKING |
| KPI strip | summary | — | — | — | load error | CONNECTED_AND_WORKING |
| Inbox search/filter/sort | client | — | — | — | — | CONNECTED_AND_WORKING |
| Pagination | client | page/size | — | — | — | CONNECTED_AND_WORKING |
| Message detail | selected message | actions | various POST | callback/exclusions | action message | CONNECTED_AND_WORKING |
| Greeting rail | box, number | studio | update_box | active greeting | all numbers gate | CONNECTED_AND_WORKING |
| Settings toggles | box + number | saveSettings | update_box + enable_voicemail | delivery | validation | CONNECTED_AND_WORKING |
| Forwarding context | number settings | — | — | link to setup phone | — | READ_ONLY_BY_DESIGN |
| Test voicemail | — | modal | — | instructions | — | READ_ONLY_BY_DESIGN |
| Entitlement page | server | — | — | upgrade card | — | INTENTIONALLY_DISABLED_WITH_REASON |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0**
