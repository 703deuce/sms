# Meeting Polls — existing system audit

| Area | Status | Notes |
|------|--------|-------|
| Meeting model (`voiceService` MEETING + `voiceAppointment`) | **WORKING** | Canonical scheduled object |
| `createPlatformAppointment` | **WORKING** | Finalization reuses this path |
| Attendee / contact resolution | **WORKING** | `resolveOrCreateContact`, `extraRecipients` |
| Calendar availability (`filterStaffAvailableForSlot`) | **WORKING** | Revalidated on finalize |
| Timezone utilities (`wallTimeInZoneToUtc`, `zonedDateParts`) | **WORKING** | Poll create + public display |
| Share tokens | **PARTIAL → WORKING** | `shareToken` + per-participant `inviteToken` |
| Email invites | **PARTIAL** | Meeting confirmations via canonical runtime; poll invite email not separate engine |
| Notification / reminders | **PARTIAL** | Non-responder remind records activity; no dedicated poll email template yet |
| Public share links | **WORKING** | `/book/{slug}/poll/vote/{inviteToken}` |
| Poll persistence | **WORKING** | `platform.meetingPolls` JSON (extended schema) |
| Legacy poll UI (kimi cards, local nav) | **LEGACY** | Replaced by `/appointments/meeting-polls` workspace |
| Simple `votes++` API | **LEGACY** | Replaced by per-participant yes/maybe/no |
| `bookWinningTime` client-only status | **BROKEN → FIXED** | Server `finalizeMeetingPoll` + idempotency |
| Team booking co-host intersection | **N/A** | Not wired for polls in v1 |
| Connected-calendar overlay on public vote | **PARTIAL** | Not on public page; organizer recheck on finalize |
| Video room per option | **N/A** | Correctly avoided; video on Meeting create only |
| Idempotent finalize | **WORKING** | `finalizeIdempotencyKey` + existing appointment guard |

**Schema additions:** Extended `MeetingPoll` in `scheduling-capabilities.ts` (participants, responses, settings, activity, tokens, timezone, finalize refs). No second meeting engine.

**Preserved:** `platform.meetingPolls` storage, `createPlatformAppointment`, availability engine, booking tokens pattern.
