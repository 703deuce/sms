# Page Blueprint — Meetings List

**Status:** FINAL — Batch 2A  
**Route:** `/appointments/types/meetings`  
**Parent:** Booking Types landing (`01-booking-types-landing.md`)  
**Batch boundary:** Meetings only — not Services/Classes/Workshops

---

```
PAGE: Meetings
ROUTE: /appointments/types/meetings
CLASSIFICATION: SPLIT — focused list (replaces transitional segment table)
PRIMARY USER JOB: Show me the meeting types customers can schedule
```

## Header

- **H1:** Meetings
- **Supporting:** Create simple meeting types for calls, consultations, demos, interviews, and virtual or in-person meetings.
- **Primary CTA:** Create meeting → `/appointments/types/meetings/new`

## List columns

| Column | Source |
|--------|--------|
| Meeting name | `name` — link to editor |
| Duration | `durationMinutes` |
| Host / assignment | `staffAssignment` + `staffIds` (plain language) |
| Meeting method | `config.location` |
| Status | `config.enabled` / `active` |
| Actions | Edit, Copy link, Duplicate, Enable/Disable |

No fake analytics. Restrained counts only if real (`N active`).

## Empty state

Headline intent: *Schedule calls without the back-and-forth*  
Body: Meetings are ideal for consultations, demos, interviews, and other appointments where customers simply choose a time.  
CTA: Create your first meeting

## Backend

- `GET /api/appointments/types` filtered client-side: `bookingTypeKind === MEETING`
- No new list API
- **Delete:** not supported — use Disable (`config.enabled: false`)
- **Duplicate:** client POST with copied config (no duplicate API)

## Art direction

- Overview pilot (`appt-overview-pilot`) — same as Booking Types landing
- Semantic table per Guide #7

## UAT

See `03-meeting-editor.md` Tests 1, 7, 8, 9 (list portions)
