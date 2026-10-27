# Clips build decisions

- **2026-10-27:** **Never block on the owner.** If something needs a decision, credential, or third-party account: choose a **best-practice default**, gate with **env / `FEATURE_*`**, document in **`docs/clips/BLOCKED.md`**, and **continue the milestone train**. Do not pause the agent waiting for replies.
- **2026-10-27:** **Product quality bar:** full Descript-class script editor, then clipper and Streamer polished to best-in-class; all three cohesive. No MVP corners on shipped surfaces.
- **2026-10-27:** **UI layout gate (M5+):** net-new pages/panels/dialogs must match **`docs/clips/descript/ui-layouts.md`** when a section exists (**BLK-002**). Until then: ship **logic, ops, APIs, tests** — no improvised layout. **M4 / M4.1** use **`script-editor.md` §A** only.
- **2026-10-27:** **Descript gap matrix** checked in under `docs/clips/descript/` (`feature-map.md`, `gap-matrix.md`, `recording-cost.md`). Milestones **M7–M17** (+ **M18** desktop recorder post-launch) replace the earlier M7–M13 slice in `SCRIPT-EDITOR-BUILD.md`. Extended browser tests are **§D1b #67–#167** (replaces obsolete D1 rows 67–98 in `script-editor.md`).
- **2026-10-27:** **Recording vendor = LiveKit Cloud** for Rooms (M15–M16). Local-first capture + B2 chunk upload (gap-matrix §R) is provider-agnostic. See `recording-cost.md` for economics; owner chose Cloud for launch ops/SLA.
- **2026-10-27:** **LiveKit for recording = Cloud only** — `LIVEKIT_URL` (`wss://sms-6w01zoya.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (already in Coolify). **No** `LIVEKIT_SELF_HOSTED_*`, **no** `voice.transovo.ai`, **no** target switch for recording. `recording-room-service.ts` reads cloud vars only. Browser WSS from server mint routes (not `NEXT_PUBLIC_*`). Primary capture = **MediaRecorder → B2**. Server-side Cloud jobs → **`transovo_voice/clips_recording/`** on voice worker (SIP vars untouched).
- **2026-10-27:** **Shortcut conflicts** in Descript docs (⌘G, Slip Y vs S, ⇧⌘S): use **gap-matrix §4 C1** resolutions (⌘G = find next; split on `S` only; timeline toggle ⌃⌥T + ⇧⌘S unchanged).
- **2026-10-27:** **M18 (post-launch):** menu-bar/tray recorder, macOS system audio, global hotkeys, teleprompter hidden from screen capture — desktop companion only (gap-matrix §R1.2).
- **2026-10-25:** Build on `master` into the existing Coolify `new-app` deployment (`transovo.ai`), not a `clips` branch or `clips-staging` app. Rollback tag: `pre-clips-cleanup`.
- **2026-10-25:** Legacy phone/receptionist/dialer UI removed from `new-app/`; Prisma models kept with schema comment `legacy, unused` — no destructive DB migration.
- **2026-10-25:** Coolify build sets `SKIP_VOICE_V3_SYNC=1` so Voice V3 sync is skipped for the clips-only app.
- **2026-10-25:** Layout modes include **Speaker follow**, **Split screen**, **Fill**, and **Fit** (product override vs. plan’s three layout labels).
- **2026-10-27:** Clips media primary store = **Backblaze B2** (`STORAGE_DRIVER=s3`, bucket `transovo-clips`). `STORAGE_DRIVER` defaults to **`s3`** in web + worker. Supabase bucket `clips` = **read-fallback only** for legacy keys; DB/auth stay on Supabase.
- **2026-10-25:** MinIO/SeaweedFS **not** used for clips.
- **2026-10-25:** Browser uploads use **TUS** to `…/storage/v1/upload/resumable` with server-issued signed upload token; service role never in the browser.
