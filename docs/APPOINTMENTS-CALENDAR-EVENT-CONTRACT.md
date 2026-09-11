# Calendar event projection contract

Normalized shape: `CalendarApiAppointment` (`map-calendar.ts`), produced by `listWorkspaceCalendarEvents`.

| Field | Source |
|-------|--------|
| `id` | Appointment id, or `class:{occurrenceId}`, `video:{id}`, `meeting:{id}` |
| `domainType` | service / meeting / class / workshop / video / notetaker |
| `startsAt` / `endsAt` | Canonical row timestamps |
| `inviteeName` | Contact or metadata |
| `serviceName` | Service or series name |
| `staffIds` | metadata.staffId, teamStaffIds, primaryStaffId |
| `staffLabel` | Resolved staff names |
| `locationId` / `locationLabel` | metadata + platform locations |
| `resourceLabels` | metadata.resourceLabels or service lines |
| `paymentLabel` / `balanceDueCents` | metadata payment fields |
| `registrationSummary` | Class enrollment count / capacity |
| `attentionFlags` | payment_due, unconfirmed |

Not a separate DB table — projection only.
