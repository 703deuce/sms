# ms-producer: editable Motion Studio projects (producer side)

Portable project packages, the editable-elements runtime (contract v1), a deterministic no-AI renderer, live-preview bridge,
validation, engine-native fonts, multi-worker portability, usage reporting and separate creative/deterministic job modes.
Everything runs against a **local simulator** of the Transovo endpoints. Nothing here calls the real Transovo API or deploys anything.

| doc | for |
|---|---|
| `docs/CONTRACT.md` | the editable-elements contract v1 (documents, tiers, resolution, runtime API, validation codes, render keys) |
| `docs/TRANSOVO_INTEGRATION.md` | ChatGPT / Transovo side: endpoints, exact requests/responses, data structures, editor embedding, scheduling |
| `docs/api-examples.md` | 26 recorded request/response pairs from the simulator (redacted) |
| `docs/WORKER_INTEGRATION.md` | Grokbot worker: lifecycle, CLI, modes, steps, capabilities, usage |
| `docs/ENGINE_SUPPORT.md` | which engines are tested (and which are not claimed) |
| `docs/PROPOSAL_skill_delivery_additions.md` | proposed additive changes to the production skill/delivery contract (needs Rick's approval; nothing applied) |

Layout: `producer/` (lib, runtime, py, bin), `schemas/` (14 JSON Schemas), `sim/` (Transovo simulator + reference editor host),
`fixtures/` (Keith S01/S05, Phil S04/sh04 importers), `tests/` (suite), `tools/` (font scan/publish, schema gen, sim reset, API capture).

Run: `bash tools/reset_sim.sh` then `node tests/run_all.mjs` (about 25 min; it writes `out/tests/suite/results.json`, contact sheets and MP4s).
