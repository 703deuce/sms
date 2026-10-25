# Clips build decisions

- **2026-10-25:** Build on `master` into the existing Coolify `new-app` deployment (`transovo.ai`), not a `clips` branch or `clips-staging` app. Rollback tag: `pre-clips-cleanup`.
- **2026-10-25:** Legacy phone/receptionist/dialer UI removed from `new-app/`; Prisma models kept with schema comment `legacy, unused` — no destructive DB migration.
- **2026-10-25:** Coolify build sets `SKIP_VOICE_V3_SYNC=1` so Voice V3 sync is skipped for the clips-only app.
- **2026-10-25:** Layout modes include **Speaker follow**, **Split screen**, **Fill**, and **Fit** (product override vs. plan’s three layout labels).
- **2026-10-25:** MinIO/SeaweedFS **not** used for clips. **Supabase Storage** bucket `clips` on project `sms2`; `STORAGE_DRIVER` defaults to `supabase`. Legacy `S3_*` only when `STORAGE_DRIVER=s3`.
- **2026-10-25:** Browser uploads use **TUS** to `…/storage/v1/upload/resumable` with server-issued signed upload token; service role never in the browser.
