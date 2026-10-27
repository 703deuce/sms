# Clips build decisions

- **2026-10-27:** **Never block on the owner.** If something needs a decision, credential, or third-party account: choose a **best-practice default**, gate with **env / `FEATURE_*`**, document in **`docs/clips/BLOCKED.md`**, and **continue the milestone train**. Do not pause the agent waiting for replies.
- **2026-10-27:** **Product quality bar:** full Descript-class script editor, then clipper and Streamer polished to best-in-class; all three cohesive. No MVP corners on shipped surfaces.
- **2026-10-27:** **UI layout gate (M5+):** net-new pages/panels/dialogs must match **`docs/clips/descript/ui-layouts.md`** when a section exists (**BLK-002**). Until then: ship **logic, ops, APIs, tests** — no improvised layout. **M4 / M4.1** use **`script-editor.md` §A** only.
- **2026-10-27:** **Descript gap matrix** checked in under `docs/clips/descript/` (`feature-map.md`, `gap-matrix.md`, `recording-cost.md`). Milestones **M7–M17** (+ **M18** desktop recorder post-launch) replace the earlier M7–M13 slice in `SCRIPT-EDITOR-BUILD.md`. Extended browser tests are **§D1b #67–#167** (replaces obsolete D1 rows 67–98 in `script-editor.md`).
- **2026-10-27:** **Recording vendor = LiveKit Cloud** for Rooms (M15–M16). Local-first capture + B2 chunk upload (gap-matrix §R) is provider-agnostic. See `recording-cost.md` for economics; owner chose Cloud for launch ops/SLA.
- **2026-10-27:** **LiveKit implementation brief** — `docs/clips/descript/livekit-api-brief.md` (pinned SDK versions). **M14–M16** follow that doc. Recording ships behind **`isLiveKitConfigured()`** / **`FEATURE_SCRIPT_RECORDING`**; missing keys → **BLK-001**, not a dev stop.
- **2026-10-27:** **Shortcut conflicts** in Descript docs (⌘G, Slip Y vs S, ⇧⌘S): use **gap-matrix §4 C1** resolutions (⌘G = find next; split on `S` only; timeline toggle ⌃⌥T + ⇧⌘S unchanged).
- **2026-10-27:** **M18 (post-launch):** menu-bar/tray recorder, macOS system audio, global hotkeys, teleprompter hidden from screen capture — desktop companion only (gap-matrix §R1.2).
- **2026-10-25:** Build on `master` into the existing Coolify `new-app` deployment (`transovo.ai`), not a `clips` branch or `clips-staging` app. Rollback tag: `pre-clips-cleanup`.
- **2026-10-25:** Legacy phone/receptionist/dialer UI removed from `new-app/`; Prisma models kept with schema comment `legacy, unused` — no destructive DB migration.
- **2026-10-25:** Coolify build sets `SKIP_VOICE_V3_SYNC=1` so Voice V3 sync is skipped for the clips-only app.
- **2026-10-25:** Layout modes include **Speaker follow**, **Split screen**, **Fill**, and **Fit** (product override vs. plan’s three layout labels).
- **2026-10-25:** MinIO/SeaweedFS **not** used for clips. **Supabase Storage** bucket `clips` on project `sms2`; `STORAGE_DRIVER` defaults to `supabase`. Legacy `S3_*` only when `STORAGE_DRIVER=s3`.
- **2026-10-25:** Browser uploads use **TUS** to `…/storage/v1/upload/resumable` with server-issued signed upload token; service role never in the browser.
