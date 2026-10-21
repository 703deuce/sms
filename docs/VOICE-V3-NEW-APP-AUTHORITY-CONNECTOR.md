# New-App → Voice V3 authority connector (implemented)

## Architecture

```
New-App wizard / publish / Phone
        ↓
new-app/app/api/internal/voice-runtime/route.ts
        ↓
receptionist/runtime/session.ts  (Phone foundation resolve — new-app adapter)
receptionist/runtime/tools.ts    (thin)
        ↓
voice-v3-runtime-connector/execution-host.ts
        ↓
new-app/lib/server/voice-v3/execute-tool.ts  (Prisma + session store)
        ↓
execute-voice-tool + registry  (synced from src/lib/voice-v3)
```

## Authority

| Component | Location |
|-----------|----------|
| **Canonical executors** | `src/lib/voice-v3/` |
| **Package boundary** | `packages/transovo-voice-v3-runtime/` |
| **Sync** | `node packages/transovo-voice-v3-runtime/sync-to-new-app.mjs` |
| **Parity gate** | `cd new-app && pnpm run test:voice-v3:golden-parity` |
| **Execution authority test** | `new-app/scripts/test-voice-v3-runtime-execution-authority.ts` |

## Why not import monolith directly in new-app?

Legacy `src/lib/db` uses Supabase prisma-compat; new-app uses Prisma `DATABASE_URL`. Core scheduling/booking **logic** is shared via sync; **persistence adapters** stay in new-app for allowed-delta files.

## Excluded (not pulled into new-app)

- Legacy monolith UI and layouts
- MCTB / campaign workers
- Node sideband coordinator / second Responses loop
- Full `../../src` import graph

## LiveKit worker

Unchanged: `TRANSOVO_BACKEND_URL` → new-app `/api/internal/voice-runtime`.

## PSTN verification still required

Worker, published config, call context, and delegation telemetry must be validated on a real call after deploy.
