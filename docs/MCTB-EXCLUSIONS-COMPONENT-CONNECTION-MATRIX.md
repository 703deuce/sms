# MCTB Exclusions — component connection matrix

| COMPONENT | READ SOURCE | WRITE ACTION | PERSISTENCE | RUNTIME EFFECT | ERROR STATE | STATUS |
|-----------|-------------|--------------|-------------|----------------|-------------|--------|
| Page load | `GET /api/mctb/exclusions` | — | — | — | Retry banner | CONNECTED_AND_WORKING |
| Summary strip | Client aggregate of GET data | — | — | — | — | CONNECTED_AND_WORKING |
| Search | Client filter on phone/reason | — | — | — | — | CONNECTED_AND_WORKING |
| Reason filter | Client filter | — | — | — | — | CONNECTED_AND_WORKING |
| Source / origin filters | Client filter | — | — | — | — | CONNECTED_AND_WORKING |
| Sort | Client sort | — | — | — | — | CONNECTED_AND_WORKING |
| Pagination | Client slice | — | — | — | — | CONNECTED_AND_WORKING |
| Add exclusion (header) | — | Opens modal | — | — | — | CONNECTED_AND_WORKING |
| Add modal submit | — | `POST /api/mctb/exclusions` | `Suppression` upsert | `BLOCKED_NUMBER` when enabled | Inline + toast | CONNECTED_AND_WORKING |
| Duplicate warning | Client + GET list | — | — | — | View/Edit link | CONNECTED_AND_WORKING |
| Edit reason | — | `POST` upsert same phone | Updates `reason` | Unchanged suppression | Toast | CONNECTED_AND_WORKING |
| Remove exclusion | — | `DELETE /api/mctb/exclusions?id` | Row deleted | May allow recovery if other rules pass | Toast | CONNECTED_AND_WORKING |
| Personal block row actions | GET shows row | — | — | Still suppressed | Remove hidden | READ_ONLY_BY_DESIGN |
| Copy phone | Display | Clipboard | — | — | Toast | CONNECTED_AND_WORKING |
| How exclusions work | Audit/runtime docs | — | — | Explains recovery-only scope | — | CONNECTED_AND_WORKING |
| Expires / Added by | — | — | — | — | Columns omitted | INTENTIONALLY_DISABLED_WITH_REASON |
| Bulk select | — | — | — | — | Not in product | INTENTIONALLY_DISABLED_WITH_REASON |
| Status filter | — | — | — | — | Not in model | INTENTIONALLY_DISABLED_WITH_REASON |

**BROKEN:** 0 · **NO_OP:** 0 · **PLACEHOLDER:** 0
