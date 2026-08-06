# Amy product experience & four runtimes

Status: **implemented with real data wiring** — full PSTN booking → owner change → second call loop still requires a human call after Coolify deploys the Calendly `source:voice` fix (PR companion branch).

## Four runtimes

| Runtime | Prompt contract | Implementation | Write permission |
|---|---|---|---|
| Caller Amy | `prompts/caller-amy.ts` + `build-agent-config.ts` | Telnyx assistant + booking tools | `live_tools` |
| Owner Amy | `prompts/owner-amy.ts` | `owner-chat.ts` (retrieval + proposals) | `publish_with_approval` |
| Workflow Architect | `prompts/workflow-architect.ts` | `workflow-architect.ts` + validator | drafts free; promote needs confirm |
| Diagnostic specialist | `prompts/diagnostic-specialist.ts` | `execution-trace.ts` + control commands | `none` |

Registry: `runtime-registry.ts` → Control `get_runtime_registry`.

## Pages → real records

| Page | Backing data |
|---|---|
| Home | `metrics.today` (24h), health, readiness blockers, daily report recommendations, activity, proposals |
| Talk | `owner_ask` — explain last call, configure proposals, workflow drafts, test suite + simulation, safe repair, duplicate |
| Work | Activity/Calls (traces + employee timeline + `/voice/calls`), Appointments (`list_agent_appointments`), Attention, Results (7-day metrics + definitions) |
| Build & Test | Workflow link + drafts, test suite, proposals, versions + rollback, deployments/drift + runtime registry |
| Settings | General/booking/fields/voice proposals; Knowledge (Company Brain / Amy / review); Connections; Health with impact; Permissions four-bucket + mode switch |
| Permissions | `describeAutonomyMode` → `buckets` (may always / auto-repair / must approve / never) |

## Control API allowlist

All Owner/Diagnostic/setup commands including `get_setup_readiness`, `get_deployment_drift`, `get_runtime_registry`, `get_field_ownership_report`, `list_agent_appointments` are allowlisted in `api/agents/[id]/control/route.ts`.

## End-to-end acceptance

Script: `scripts/amy-product-acceptance.mjs`

Sequence to prove (after deploy):

1. Smoke-login → load Amy agent view (Home metrics/health real)
2. Talk: “What happened on the last call?” → evidence href
3. Talk: “Require an email for this service” → proposal → confirm → publish
4. Drift check healthy / soft-warn
5. Live call to DID → Calendly `provider:calendly` → book with email → Activity timeline
6. Disconnect calendar → degraded → booking request / message — reconnect → healthy

Do **not** mark complete because a route exists — require UI evidence, DB state, tool traces, Telnyx/calendar state.
