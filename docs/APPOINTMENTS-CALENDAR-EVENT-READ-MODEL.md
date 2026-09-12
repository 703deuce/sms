# Calendar event read model (list projection)

**Source:** `listWorkspaceCalendarEvents` → `CalendarApiAppointment` (`map-calendar.ts`)

## Purpose

Load **only** what the grid needs for the visible date range. Full appointment loads on drawer open.

## Fields (list)

| Field | Use |
|-------|-----|
| `id` | Event key (appointment id, or `class:`, `video:` prefixes) |
| `eventKind` | appointment \| class_occurrence \| standalone_video \| standalone_notetaker |
| `domainType` | service \| meeting \| class \| workshop \| block \| external_busy \| video \| notetaker |
| `startsAt`, `endsAt`, `timezone` | Layout + labels |
| `status` | Chip + styling |
| `inviteeName`, `inviteePhone` | Event title / search |
| `serviceName` | Subtitle |
| `contactId` | Deep links |
| `staffIds`, `staffLabel` | Filter + display |
| `locationId`, `locationLabel` | Filter + display |
| `resourceLabels` | Display |
| `balanceDueCents`, `paymentLabel` | Attention |
| `pendingFormsCount`, `attentionFlags` | Icons |
| `registrationSummary` | Class capacity (`12 / 15`) |
| `seriesId`, `occurrenceId` | Recurring (future drag scope) |
| `meeting` | Video/notetaker badges (enriched batch) |
| `metadata` | Team ids, source, sync flags (sparse) |

## Query

`GET /api/calendar/events?from=&to=&staffIds=&locationId=&resourceId=&status=&domainType=&q=`

## N+1 policy

- **Allowed:** one batch `meeting-indicators` for visible appointment ids  
- **Not allowed:** per-event contact/payment/forms fetch in list path  
- **Drawer:** single `GET /api/appointments/[id]` on open  
