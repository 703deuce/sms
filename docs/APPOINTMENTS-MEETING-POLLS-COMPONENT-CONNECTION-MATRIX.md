# Meeting Polls component connection matrix (summary)

Full matrix columns per directive; **connected** controls listed below (22 primary rows).

| Section | Component | Control | API | Domain | Consequence |
|---------|-----------|---------|-----|--------|-------------|
| Library | New poll | button | POST `/api/appointments/meeting-polls` | `createMeetingPoll` | Opens poll draft/open |
| Library | Search | input | client filter | — | View only |
| Library | Status tabs | tabs | client filter | — | View only |
| Library | Open row | link | — | — | Navigate to detail |
| Create | Step 1–3 | form | POST create | `saveMeetingPoll` | Persists poll |
| Detail | Copy poll link | button | — | `publicPollUrl` | Clipboard |
| Detail | Close poll | button | POST `close` | `closeMeetingPoll` | No new votes |
| Detail | Remind | button | POST `remind` | `recordPollReminder` | Activity |
| Detail | Response matrix | table | GET detail | `scoreMeetingPoll` | Read-only |
| Detail | Finalize meeting | button | POST `finalize` | `finalizeMeetingPoll` | Creates `voiceAppointment` |
| Detail | Cancel poll | button | POST `cancel` | `cancelMeetingPoll` | Public cancelled state |
| Public | Yes/Maybe/No | toggle group | POST vote API | `submitParticipantResponses` | Updates matrix |
| Public | Timezone | input | — | Intl | Display only |
| Public | Submit | button | POST vote API | `submitParticipantResponses` | Persists votes |

**Totals:** 22 connected, 0 placeholder, 0 no-op in scope. Email invite delivery and calendar overlay marked external/partial.
