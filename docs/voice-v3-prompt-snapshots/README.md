# Voice V3 prompt snapshots

Full Amy (GPT-Live frontend) + Astra/Luna (backend) instructions as compiled from this repo.

| File | Use case |
|------|----------|
| [amy-and-astra-wizard-default.txt](./amy-and-astra-wizard-default.txt) | Wizard defaults + guardrails |
| [amy-and-astra-cert-m365.txt](./amy-and-astra-cert-m365.txt) | Cert PSTN booking (M365 tools) |
| [both-scenarios-combined.txt](./both-scenarios-combined.txt) | Both in one file |

Regenerate:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/write-voice-v3-prompt-snapshots.ts
```
