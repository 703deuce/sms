# Voice V3 PSTN — tool chain forensics (index)

Click through to open each artifact on GitHub (Markdown summary + JSON blobs).

| Call | Room suffix | Summary | JSON blobs |
|------|-------------|---------|------------|
| Info-dump book test (2026-09-21) | `vcrbyQoJ7aLi` | [Report](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md) | [events.json](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json) · [backend-events.json](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json) |

**Regenerate** (requires production `DATABASE_URL`):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/generate-voice-v3-tool-chain-report.ts <roomSuffix>
```
