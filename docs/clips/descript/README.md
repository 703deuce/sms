# Descript reference specs (inventory + gap matrix)

Copied from the Transovo server (`/tmp/transovo-specs/`, 2026-10-27+) for version control and agent context.

| File | Purpose |
|------|---------|
| [`feature-map.md`](./feature-map.md) | **596** Descript features from **440** pages; **485** tagged Launch |
| [`gap-matrix.md`](./gap-matrix.md) | Launch coverage vs `script-editor.md`, **B6–B13** paste-ready sections, **C1/C3** additions, **§R** recording, milestones **M7–M18**, browser tests **#67–#167** |
| [`recording-cost.md`](./recording-cost.md) | LiveKit Cloud vs self-hosted vs Telnyx cost model (research memo) |
| [`livekit-api-brief.md`](./livekit-api-brief.md) | **Normative LiveKit API** for **M14–M16** (pinned SDK versions, tokens/grants, webhook raw body, record-1080p / publish-720p-clone, `replaceTrack`, RPC clock + rec-control, custom device toggles) |

**Normative merge:** `docs/clips/SCRIPT-EDITOR-BUILD.md` adopts gap-matrix §3 (B5 rows), §4 (B6–B13), §5–§6 (recording + D1b tests). Product spec `script-editor.md` §D1 rows **1–66** are unchanged; extended tests are **§D1b** (#67–#167) in the gap matrix.

**Owner decisions (2026-10-27):** Recording SFU = **LiveKit Cloud**. **API source of truth:** [`livekit-api-brief.md`](./livekit-api-brief.md) (2026-10-26 docs + SDK source). **Do not start M14–M16 code** until editor milestones **M5–M13** (or current train gate) are done; keys go in Coolify as `LIVEKIT_*` / `NEXT_PUBLIC_LIVEKIT_URL` before recording ships. Desktop-only recorder items = **M18** post-launch. Descript shortcut conflicts resolved per gap-matrix §4 C1.
