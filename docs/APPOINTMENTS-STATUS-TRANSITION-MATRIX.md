# Appointment status transitions (calendar-relevant)

| From | To | Action | Runtime |
|------|-----|--------|---------|
| * | canceled | Cancel drawer / PATCH | `cancelPlatformAppointment` |
| * | completed | Appointment detail | `updatePlatformAppointmentStatus` |
| * | no_show | Appointment detail | `updatePlatformAppointmentStatus` |
| * | new time | Reschedule | `reschedulePlatformAppointment` + slot validation |

Calendar drawer cancel uses cancel action only — not raw status field edits.
