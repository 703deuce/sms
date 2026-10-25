# Clips build decisions

- **2026-10-25:** Build on `master` into the existing Coolify `new-app` deployment (`transovo.ai`), not a `clips` branch or `clips-staging` app. Rollback tag: `pre-clips-cleanup`.
- **2026-10-25:** Legacy phone/receptionist/dialer UI removed from `new-app/`; Prisma models kept with schema comment `legacy, unused` — no destructive DB migration.
- **2026-10-25:** Coolify build sets `SKIP_VOICE_V3_SYNC=1` so Voice V3 sync is skipped for the clips-only app.
- **2026-10-25:** Layout modes include **Speaker follow**, **Split screen**, **Fill**, and **Fit** (product override vs. plan’s three layout labels).
- **2026-10-25:** MinIO on-server pull failed (registry auth). Object storage must be wired via Coolify env (`S3_*`) before upload/worker E2E works in production.
