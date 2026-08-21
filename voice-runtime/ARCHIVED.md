# ARCHIVED — TypeScript LiveKit Voice Runtime

**Status:** Removed from production (2026-08-21)

The TypeScript `voice-runtime/` package is **not** deployed, registered, or used for voice calls.

All LiveKit voice traffic uses **one Python worker only**:

```
voice-runtime-python → transovo-voice-runtime
```

## Do not run

```bash
# REMOVED — exits immediately
npm run voice-runtime:start
npm run voice-runtime:dev
```

## Outbound voice

Outbound AI calling is **disabled** during the clean-room rebuild. It will be reimplemented in Python later using the same template library.

## Source retained temporarily

Some files remain for reference while tests/scripts are migrated. They must not be registered as LiveKit agents or spawned in production.
