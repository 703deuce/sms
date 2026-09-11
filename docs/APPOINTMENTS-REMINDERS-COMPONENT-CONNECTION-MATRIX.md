# Reminders — Component Connection Matrix (summary)

Route: `/appointments/reminders?section=`. Engine: `reminder-delivery.ts`, `booking-platform.ts`, `PATCH /api/appointments/settings`.

| SECTION | COMPONENT | STATUS | READ | WRITE | RUNTIME |
|---------|-----------|--------|------|-------|---------|
| Header | Save changes | CONNECTED | config state | PATCH settings | persists sequence |
| Sequence | Timing inputs | CONNECTED | minutesBefore | PATCH | scanner fire time |
| Sequence | Enable toggle | CONNECTED | step.enabled | PATCH | skip when disabled |
| Sequence | Add reminder | CONNECTED | — | additionalSteps | scanner includes |
| Sequence | Edit drawer | CONNECTED | step | PATCH | template/channel |
| Sequence | Delete custom | CONNECTED | additionalSteps | PATCH | removed from scan |
| Overview | Customer preview | CONNECTED | test API preview | — | renderAppointmentTemplate |
| Assignment | Table | READ_ONLY | types list | — | default only (honest) |
| Activity | Table | CONNECTED | workspace API | — | appointment timeline |
| Settings | Test send | CONNECTED | POST test | sendTestReminderSms | external SMS |
| Settings | Messaging link | READ_ONLY | — | — | merchant settings |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0** (assignment override labeled read-only by design until type-level storage exists).
