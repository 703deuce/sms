# AI Receptionist — configuration tracing

Observability for the appointment receptionist wizard: **what the customer selected → what the server received → what persisted → what compiled/published → what the LiveKit runtime loaded**.

No product behavior changes. Enable structured traces in server logs during debugging.

## Enable tracing

| Environment | Effect |
|-------------|--------|
| `RECEPTIONIST_CONFIG_TRACE=1` | Server summaries + merge/persist/publish/runtime compile logs (default **on** outside production) |
| `RECEPTIONIST_CONFIG_TRACE_VERBOSE=1` | Per-field `FIELD` lines on merge/publish diff |
| `NEXT_PUBLIC_RECEPTIONIST_CONFIG_TRACE=1` | Browser `[RECEPTIONIST][UI_CHANGE]` lines (default **on** outside production) |

## Correlation ID

Every Save / Test / Publish sends `receptionistTraceId` (`rec_…`) in the JSON body and `X-Receptionist-Trace-Id` header. The API echoes `data.receptionistTraceId`.

Draft revision (when present): `draftConfig.advanced.wizardConfigRevision`.

## Log phases

| Tag | When |
|-----|------|
| `[RECEPTIONIST][UI_CHANGE]` | Client field edit (no autosave) |
| `[RECEPTIONIST][SAVE_DRAFT][SUCCESS]` | Draft save summary + persist verification |
| `[RECEPTIONIST][MERGE][SUMMARY]` | Step merge / ownership / guardrails |
| `[RECEPTIONIST][SIDE_EFFECT][UNEXPECTED_LIVE_EFFECT]` | Draft save recorded live sync, hooks, compile, etc. |
| `[RECEPTIONIST][STAGE][*]` | Activate/publish pipeline stages |
| `[RECEPTIONIST][PUBLISH_DIFF]` | Draft vs previous published wizard snapshot |
| `[RECEPTIONIST][TEST][*]` | Wizard step 7 browser live test compile |
| `[RECEPTIONIST][RUNTIME_LOAD]` | LiveKit Python worker after bootstrap (production calls) |

## Field registry

Canonical top-level fields and owners: `listTopLevelRegistryEntries()` in  
`src/lib/solutions/appointment-receptionist/config-tracing/field-registry.ts`.

Nested paths are discovered at diff time via `flattenWizardState()`.

## Configuration vs behavioral proof

- **Configuration proof:** traces show saved, compiled, published, and loaded values + tool lists.
- **Behavioral proof:** tool **invocation** and external booking success are **not** implied by `RUNTIME_LOAD` — use existing call/tool telemetry for that.

## Tests

```bash
npx tsx scripts/test-receptionist-config-tracing.ts
```

Full inventory and gap analysis: `docs/AI-RECEPTIONIST-CONFIG-TRACING-REPORT.md`.

## Implementation map

- `src/lib/solutions/appointment-receptionist/config-tracing/*`
- `src/app/api/solutions/appointment-receptionist/route.ts`
- `src/components/solutions/appointment-receptionist/wizard.tsx`
- `src/lib/voice-v3-basic/wizard-browser-live-test.ts`
- `voice-runtime-python/transovo_voice/observability/receptionist_config_trace.py`
