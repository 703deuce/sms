# Voice V3 prompt refinement pass (Amy + Astra)

## Intent

One targeted consistency pass on the **existing** Voice V3 builders (`buildLiveFrontendInstructions`, `buildAstraBackendInstructions` and modules). Preserves proven conversational and tool discipline; does not introduce a second prompt system.

Builds on PR **#677** (`cursor/voice-v3-wizard-capability-parity-f350`): conditional Astra workflows, effective tool gating for Amy capabilities, placeholder knowledge filtering, capability parity tests.

## Amy changes

| Area | Change |
|------|--------|
| Structure | Reordered sections; merged turn-taking, interruptions, corrections; capabilities + business facts at end |
| Intake speech | New `COLLECTING CALLER INFORMATION` — one field per turn; no reading missing-field lists aloud |
| Greeting | `resolveConnectionGreetingRole()` — `none` / `holding` / `full_business` (see connection greeting doc) |
| Duplication | Persona no longer repeats brevity/one-question bullets covered in core style |

## Astra changes

| Area | Change |
|------|--------|
| Callback | Aligned `astra-callback-instructions.ts` with executor-first `request_callback` + `needs_information` |
| Cross-tool | Renumbered sections 1–8; workflows conditional on registered tools; calendar path labeled "Direct calendar booking" |

## Regression tests

- `npx tsx scripts/test-voice-v3-capability-parity-audit.ts`
- `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npm run test:voice-v3-prompts`
- `npx tsx scripts/test-voice-v3-astra-tool-contracts-audit.ts`

## Production verification (manual)

- Wizard test agent `cmu42zyel1c4x01090c6s335z` / `+15714073615` — compare greeting, one-question intake, delegation latency
- Cert agent `cmshz2lc25c622c4i58303501` / `+15717491060` — **do not change published config**

## Deploy scope

Prompt builders run in the **web** configuration/bootstrap path. Deploy web when merged. Python worker deploy only if session/bootstrap code changes (not required for this pass).
