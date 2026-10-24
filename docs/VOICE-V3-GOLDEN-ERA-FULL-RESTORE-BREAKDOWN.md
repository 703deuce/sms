# Voice V3 golden-era full restore (a4a63466c)

## What was restored

**Golden anchor:** `a4a63466c` (2026-09-24) — documented golden-era Voice V3 / LiveKit PSTN stack.

**Authority tree (562 paths)** — every file that existed at the anchor under:

| Area | Role |
|------|------|
| `src/lib/voice-v3/**` | TypeScript runtime authority (tools, prompts, calendar, intake, delegation, state) |
| `src/lib/voice-v3-basic/**` | Wizard/browser helpers |
| `src/lib/voice/python-runtime-bridge/voice-v3*.ts` | LiveKit session resolve for monolith ingress |
| `src/app/api/internal/voice-runtime/**` | Tool execution HTTP surface for Python worker |
| `voice-runtime-python/transovo_voice/voice_v3/**` | LiveKit Python worker (session, tools, transfer, intake collection) |
| Matching `scripts/*voice-v3*` at anchor | Cert/test scripts present at golden |
| `docs/VOICE-V3*` at anchor | Specs and audits that existed at golden |

Machine list: `docs/VOICE-V3-GOLDEN-ERA-FULL-FILE-MANIFEST.json`

**Removed post-golden runtime code** (not in anchor): native intake bridge modules (`intake_task.py`, `intake_bridge.py`, …), monolith-only post-golden TS (e.g. `livekit-inbound-dispatch.ts`, `collect_caller_intake` tool path), and cert scripts that only applied to the retired intake rewrite.

## new-app production layer (not in golden monolith tree)

Golden monolith did not ship `new-app/lib/server/voice-v3/resolve-livekit-session.ts`, `execute-tool.ts`, scheduling adapters, or Telnyx transfer coordinators. Those **65+ integration files** are listed in `docs/VOICE-V3-GOLDEN-ERA-NEW-APP-INTEGRATION-MANIFEST.json`.

**Runtime mirror:** all `src/lib/voice-v3/*.ts` twins are copied to `new-app/lib/server/voice-v3/` (305 files). Verifier requires byte-identical content for mirrored paths.

**Golden intake tool surface restored on session bootstrap:**

- `buildLiveKitIntakeFunctionTools()` merged into `toolSchemas` in `resolve-livekit-session.ts` (same as `voice-v3-livekit.ts` on monolith).
- Editor default tool list uses `update_intake` (not post-golden `collect_caller_intake`).
- Removed `new-app/.../collect-caller-intake-tool.ts`.

## How we prove “every Voice V3 touch is accounted for”

```bash
env -u NODE_OPTIONS node scripts/verify-voice-v3-golden-era-coverage.mjs
```

Exit `0` means:

1. **992** tracked repo paths that touch Voice V3 / LiveKit are classified.
2. **561** golden authority files match the `a4a63466c` blob exactly.
3. **268** new-app mirror files match their `src/lib/voice-v3` twin.
4. Integration, post-golden documentation, post-golden scripts, reports, and prisma migration paths are explicitly manifest-listed (no orphan drift).

Regenerate golden files:

```bash
env -u NODE_OPTIONS node scripts/restore-voice-v3-golden-era-full.mjs
```

## Intentionally not reverted to golden blobs

- **Post-golden documentation** (`docs/VOICE-V3-*` added after Sept 24): listed in `docs/VOICE-V3-GOLDEN-ERA-POST-GOLDEN-DOCUMENTATION-MANIFEST.json` — audit/history only, not runtime.
- **Post-golden tooling** (restore + coverage scripts, cert ledgers): `docs/VOICE-V3-GOLDEN-ERA-POST-GOLDEN-SCRIPTS-MANIFEST.json`.
- **Database migrations** that mention `voice_v3`: immutable history.
- **new-app-only** wiring (session resolve, execute-tool, scheduling, transfer): integration manifest; behavior patched for golden intake merge where it differs from master.

## Operational expectation after deploy

PSTN LiveKit V3 should again expose **`update_intake` / per-field intake tools** to the model, persist intake via authoritative tools (not `get_intake_state` polling loops), and allow **`send_booking_link`** when intake requirements are met — matching Sept 2026 golden tool surface and prompts.
