# Staff — existing system audit

| Area | Status | Notes |
|------|--------|-------|
| `BookableStaffMember` in platform config | **WORKING** | Canonical staff record (`platform.staff`) |
| Service eligibility | **WORKING** | `appointmentTypeIds` + Service `staffIds` pool |
| Location eligibility | **WORKING** | `locationIds` + `location.staffIds` |
| Availability hours | **WORKING** | `weeklyHours`, overrides — owned by Availability |
| Calendar busy blocking | **WORKING** | `calendarConnectionId` → Integrations |
| Public staff picker | **WORKING** | `customerSelectable`, active filter on `/api/public/book` |
| Routing | **WORKING** | Service `staffAssignment` + `staffIds`; not duplicated on Staff |
| Team Booking | **WORKING** | Service config; summary link only on Staff |
| Meetings / Classes / Workshops hosts | **WORKING** | Service editors use same `platform.staff` |
| `voiceStaffMember` Prisma table | **LEGACY / PARALLEL** | Voice API; appointments use platform JSON |
| User invite / login | **PARTIAL** | Link to `/settings/team`; no per-staff OAuth on Staff page |
| Profile photo upload | **PARTIAL** | `avatarUrl` field; URL entry (no dedicated upload API) |
| Staff ordering | **GAP** | No manual sort field yet |
| Direct staff booking URL | **N/A** | Not a separate product surface |
| Payroll / commission | **N/A** | Out of scope |

**Schema additions:** Optional profile fields on `BookableStaffMember` (`publicDisplayName`, `title`, `email`, `phone`, `bio`, `avatarUrl`, `createdAt`).

**Preserved:** PATCH `/api/appointments/settings` staff array; contextual `addStaffMember` from Service editors.
