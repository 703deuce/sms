# Descript reference specs (inventory + gap matrix)

Copied from the Transovo server (`/tmp/transovo-specs/`, 2026-10-27+) for version control and agent context.

| File | Purpose |
|------|---------|
| [`feature-map.md`](./feature-map.md) | **596** Descript features from **440** pages; **485** tagged Launch |
| [`gap-matrix.md`](./gap-matrix.md) | Launch coverage vs `script-editor.md`, **B6–B13** paste-ready sections, **C1/C3** additions, **§R** recording, milestones **M7–M18**, browser tests **#67–#167** |
| [`recording-cost.md`](./recording-cost.md) | LiveKit Cloud vs self-hosted vs Telnyx cost model (research memo) |
| [`ui-layouts.md`](./ui-layouts.md) | **27 surfaces** (§1–§27): px layouts at 1440×900 / 1280×800; refs on server `/opt/transovo-refs/descript/` |
| [`ui-checklist.md`](./ui-checklist.md) | Browser tester checklist (pairs with `ui-layouts.md` § numbers) |
| [`livekit-api-brief.md`](./livekit-api-brief.md) | **Normative LiveKit API** for **M14–M16** (pinned SDK versions, tokens/grants, webhook raw body, record-1080p / publish-720p-clone, `replaceTrack`, RPC clock + rec-control, custom device toggles) |

**Normative merge:** `docs/clips/SCRIPT-EDITOR-BUILD.md` adopts gap-matrix §3 (B5 rows), §4 (B6–B13), §5–§6 (recording + D1b tests). Product spec `script-editor.md` §D1 rows **1–66** are unchanged; extended tests are **§D1b** (#67–#167) in the gap matrix.

**Owner decisions (2026-10-27):** Recording SFU = **LiveKit Cloud only** (`LIVEKIT_*`, `sms-6w01zoya.livekit.cloud`). See [`livekit-api-brief.md`](./livekit-api-brief.md) + `DECISIONS.md`. M5+ layouts = **BLK-002**. Desktop recorder = **M18**. Shortcuts = gap-matrix §4 C1.
