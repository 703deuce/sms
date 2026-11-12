# Integration Certification

Workspace-aware, connection-aware certification for Transovo integrations. **Defaults to `ws_1`** — it does not create a fake workspace unless you explicitly pass a different workspace id.

## Quick start

```bash
# Full certification (fixtures + live when connected)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:integration-cert

# Fixture-only (no live provider API calls — safe for CI without credentials)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:integration-cert:fixtures

# Human-readable + JSON reports
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/integration-cert-report.ts
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CERT_WORKSPACE_ID` | `ws_1` | Workspace to certify against |
| `CERT_FIXTURE_ONLY` | — | Set `1` to skip live probes |
| `CERT_SKIP_LIVE` | — | Same as fixture-only for live path |
| `CERT_LIVE_ONLY` | — | Skip fixture suite |
| `CERT_ARTIFACTS` | `./artifacts` | Report output directory |

App-level OAuth client ids/secrets (`PIPEDRIVE_CLIENT_ID`, `ZOHO_CLIENT_ID`, etc.) enable OAuth flows but **certification reads connected workspace credentials from the database**, not `.env` tokens.

## Decision flow (per provider)

```
ws_1
  ↓
load integration connection record
  ↓
connected?
  ├─ yes → validateConnection() (harmless API probe, refresh OAuth once if expired)
  │         ├─ ok + production → LIVE
  │         ├─ ok + sandbox/dev  → SANDBOX
  │         └─ fail              → SIMULATED + report connection problem
  └─ no  → SIMULATED on real ws_1 (fixtures through real parsers/runtime)
```

**SIMULATED does not mean fake application.** Fixture events still enter through real webhook parsers, workspace resolution, database, and automation runtime on `ws_1`. Only the external provider boundary is faked.

## Modes

| Mode | Meaning |
|------|---------|
| `LIVE` | Connected, credentials validated, live acceptance/smoke ran |
| `SANDBOX` | Connected developer/sandbox org (e.g. Salesforce DE) |
| `SIMULATED` | Fixture suite on real `ws_1` — live OAuth/webhook **not** tested |
| `SKIPPED` | Explicitly skipped |

A simulated PASS is **never** reported as a live-provider PASS.

## Providers (V1 matrix)

| Provider | Bucket | Notes |
|----------|--------|-------|
| Pipedrive | Connected live account | OAuth on `ws_1` when connected |
| Calendly | Connected live account | OAuth on `ws_1` when connected |
| Zoho CRM | Connected live account | OAuth on `ws_1` when connected |
| JotForm | Connected live account | API key on `ws_1` when connected |
| Salesforce | Sandbox/dev account | Connect a Developer Edition org to `ws_1` for live path; fixtures always run |

## Two levels of testing

### Level 1 — Fixture certification (every provider)

Canonical webhook payloads per supported trigger, correlated with `certRunId`, exercised through:

`provider payload → parser → normalization → workspace resolution → automation bridge`

### Level 2 — Live smoke (connected providers only)

Reuses existing acceptance batteries (`runCrmAcceptanceSuite`, `runIntegrationAcceptance`):

- OAuth/token validation (real API probe)
- Representative create/read/update at provider
- Webhook normalization + idempotency
- Trigger E2E where supported

Live objects use `[TRANSOVO CERT]` naming. External ids are tracked and cleaned up after the run unless retained for delayed webhook validation.

## CLI

```bash
npx tsx scripts/integration-cert-report.ts \
  --workspace ws_1 \
  --providers pipedrive,calendly \
  --fixture-only \
  --json ./artifacts/cert.json \
  --markdown ./artifacts/cert.md
```

## Module entry

```ts
import { runIntegrationCertification } from "@/lib/integrations/certification";

const report = await runIntegrationCertification({
  workspaceId: "ws_1",
  providerFilter: ["pipedrive", "calendly"],
});
```

## Related scripts

- `npm run test:native-integrations` — adapter/registry contracts
- `npm run test:crm-enterprise` — CRM enterprise contracts
- `scripts/test-flow-builder-full-cert.ts` — full automation trigger matrix on `ws_1`
- `scripts/crm-live-readiness.ts` — env presence for CRM OAuth (no secrets printed)
