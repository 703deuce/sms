# @transovo/voice-v3-runtime

**Single execution authority for Voice V3** (intake, delegation, scheduling, booking, transfers).

## Where the code lives

| Role | Path |
|------|------|
| **Authority (edit here)** | `src/lib/voice-v3/` |
| LiveKit bridge (monolith) | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` |
| New-app wizard / publish / Phone | `new-app/` |
| New-app execution mirror | `new-app/lib/server/voice-v3/` (core executors synced from authority) |
| New-app connector | `new-app/lib/server/voice-v3-runtime-connector/` |

New-app cannot import the monolith tree directly at runtime because the legacy app uses Supabase `prisma-compat` while new-app uses Prisma `DATABASE_URL`. Core executors are therefore **synced** from `src/lib/voice-v3` (not hand-maintained forks).

## Sync

```bash
node packages/transovo-voice-v3-runtime/sync-to-new-app.mjs
cd new-app && npm run test:voice-v3:golden-parity
```

Coolify `new-app/scripts/coolify-build.sh` runs sync before `next build`.

## What stays in new-app only

- Receptionist wizard, publish, Phone foundation session resolve
- DB import paths (`@/lib/server/db`) in allowed-delta files
- Conversational IVR four-tool profile (configuration boundary)

Do not resurrect legacy monolith UI, MCTB workers, or a second Node execution loop.
