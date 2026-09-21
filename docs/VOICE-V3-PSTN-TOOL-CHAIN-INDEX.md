# Voice V3 PSTN — tool chain forensics (index)

Click through to open each artifact on GitHub (Markdown summary + JSON blobs).

| Call | Room suffix | Summary | JSON blobs |
|------|-------------|---------|------------|
| **Dual info-dump (delegation telemetry)** | `dYDMLQvxF9xC` + `BRMzndUiiSem` | [**Master bundle**](./VOICE-V3-DUAL-PSTN-INFO-DUMP-FORENSICS-2026-09-21.md) · [delegation export](./VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json) | Per-call: [A](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.md) · [B](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.md) |
| Call A — booking intent first | `dYDMLQvxF9xC` | [Report](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.md) | [events](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.events.json) · [backend](./VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.backend-events.json) |
| Call B — dump then booking | `BRMzndUiiSem` | [Report](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.md) | [events](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.events.json) · [backend](./VOICE-V3-TOOL-CHAIN-BRMzndUiiSem.backend-events.json) |
| Info-dump book test (2026-09-21) | `vcrbyQoJ7aLi` | [Report](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md) | [events.json](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.events.json) · [backend-events.json](./VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json) |

**Regenerate** (requires production `DATABASE_URL`):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/generate-voice-v3-tool-chain-report.ts <roomSuffix>
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/bundle-voice-v3-dual-pstn-forensics.ts
```
