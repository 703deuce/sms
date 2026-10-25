# Clips build progress

**Production URL:** _(set after deploy)_  
**Branch:** `master` (no `clips` branch; deploys via existing Coolify new-app)  
**Rollback tag:** `pre-clips-cleanup`

## Milestones

| ID | Status | Notes |
|----|--------|-------|
| Cleanup | ✅ | Legacy phone/receptionist/dialer/MCTB/contacts/inbox removed from `new-app/`; Prisma legacy models retained |
| M0 | 🚧 | Shell + nav + flags |
| M1 | ⏳ | Data model + storage + upload |
| M2 | ⏳ | Settings form |
| M3 | ⏳ | Worker + queue + transcribe + status UI |

## Missing keys

_(none logged yet)_

## Known issues

- `SKIP_VOICE_V3_SYNC=1` recommended in Coolify build env until voice runtime fully removed from build pipeline.
