# Appointments Availability — Component Connection Matrix

Route: `/appointments/availability`  
Shell: `AvailabilityWorkspaceConnected` + `useAvailabilityWorkspace`  
Persistence: `PATCH /api/appointments/settings` (platform hours, overrides, booking rules, staff array)  
Slot preview: `GET /api/appointments/availability`  
Diagnostics: `GET /api/appointments/diagnostics/slots`

Status legend: **CONNECTED_AND_WORKING** · **READ_ONLY_BY_DESIGN** · **INTENTIONALLY_DISABLED_WITH_REASON**

| Section | Component | Control | User job | Read source | Write target | API | Runtime consequence | Status |
|---------|-----------|---------|----------|-------------|--------------|-----|---------------------|--------|
| Header | Save changes | Button | Persist workspace availability | `form` state | `AppointmentPlatformConfig` in `solutionSetup` | `PATCH /api/appointments/settings` | All channels use updated hours/rules | CONNECTED_AND_WORKING |
| Header | Saved indicator | Status | Confirm persistence | save response | — | — | — | CONNECTED_AND_WORKING |
| Nav | Section tabs | Tabs | Switch workspace section | URL `?section=` | — | — | — | CONNECTED_AND_WORKING |
| Overview | Schedule coverage | Summary + link | Jump to weekly hours | `form.weeklyHours` | — | settings GET | Base schedule for staff without custom hours | READ_ONLY_BY_DESIGN |
| Overview | Staff coverage | Summary + link | Find staff gaps | `platform.staff` | — | settings GET | — | READ_ONLY_BY_DESIGN |
| Overview | Upcoming overrides | List | See exceptions | `form.dateOverrides` | — | settings GET | Overrides in slot loop | READ_ONLY_BY_DESIGN |
| Overview | Availability preview | Selectors + chips | Test real slots | engine | — | `GET /api/appointments/availability` | Same as public booking | CONNECTED_AND_WORKING |
| Overview | Setup health | Status rows | Operational checklist | derived stats | — | — | — | READ_ONLY_BY_DESIGN |
| Overview | Assignment summary | Manage links | Navigate sections | derived | — | — | — | CONNECTED_AND_WORKING |
| Weekly hours | Day open toggle | Checkbox | Open/close day | `form.weeklyHours[day]` | settings PATCH | settings | Day skipped or windows used | CONNECTED_AND_WORKING |
| Weekly hours | Time inputs | `time` | Edit interval | `weeklyHours` | settings PATCH | settings | Candidate window bounds | CONNECTED_AND_WORKING |
| Weekly hours | Add interval | Button | Split shifts | `weeklyHours` | settings PATCH | settings | Multiple windows per day | CONNECTED_AND_WORKING |
| Weekly hours | Remove interval | Button | Remove window | `weeklyHours` | settings PATCH | settings | — | CONNECTED_AND_WORKING |
| Weekly hours | Copy Monday to weekdays | Button | Bulk apply | `weeklyHours.monday` | settings PATCH | settings | Tue–Fri mirror Monday | CONNECTED_AND_WORKING |
| Weekly hours | Timezone | Text | Canonical TZ | `form.timezone` | settings PATCH | settings | `wallTimeInZoneToUtc` | CONNECTED_AND_WORKING |
| Staff | Assignment table | Table rows | Review staff coverage | `platform.staff` + types | — | settings GET | — | READ_ONLY_BY_DESIGN |
| Staff | Row open drawer | Button | Edit assignments | staff row | `staff[]` | settings PATCH staff | Eligibility + staff windows | CONNECTED_AND_WORKING |
| Staff | Service checkboxes | Checkbox | Staff ↔ service | `appointmentTypeIds` | settings PATCH | settings | `resolveEligibleStaff` | CONNECTED_AND_WORKING |
| Staff | Location checkboxes | Checkbox | Staff ↔ location | `locationIds` | settings PATCH | settings | `filterStaffIdsForLocation` | CONNECTED_AND_WORKING |
| Staff | Custom weekly editor | Time controls | Staff hours | `staff.weeklyHours` | settings PATCH | settings | `windowsForStaffDay` precedence | CONNECTED_AND_WORKING |
| Staff | Use business default | Button | Clear custom hours | `{}` weeklyHours | settings PATCH | settings | Falls back to business/named | CONNECTED_AND_WORKING |
| Staff | Manage calendars link | Link | OAuth/setup | — | — | Integrations | External busy | READ_ONLY_BY_DESIGN |
| Services | Service table | Table | Review service rules | types API | — | `GET /api/appointments/types` | — | READ_ONLY_BY_DESIGN |
| Services | Service drawer | Panel | Inspect timing | type `config` | — | types GET | Buffers, fixed starts, resources | READ_ONLY_BY_DESIGN |
| Services | Open service | Link | Edit canonical staff/place | — | — | Service editor | Bidirectional staffIds | READ_ONLY_BY_DESIGN |
| Locations | Location rows | List | Place constraints | `platform.locations` | — | settings GET | Location hours when set | READ_ONLY_BY_DESIGN |
| Locations | Resource rows | List | Capacity constraints | `scheduling_resources` | — | resources API | `filterSlotsByResourceAvailability` | READ_ONLY_BY_DESIGN |
| Locations | Manage links | Link | Edit canonical data | — | — | Locations/Resources pages | — | READ_ONLY_BY_DESIGN |
| Overrides | Overrides table | Table | Review exceptions | `dateOverrides` | settings PATCH | settings | Day loop override branch | CONNECTED_AND_WORKING |
| Overrides | Add override modal | Form | Add closure/custom hours | form draft fields | `dateOverrides` | settings PATCH | Same | CONNECTED_AND_WORKING |
| Overrides | Blackout/holiday lists | Read-only lists | See related closures | `blackoutDates`, `holidays` | — | settings GET | Skip days in engine | READ_ONLY_BY_DESIGN |
| Booking rules | Minimum notice | Number | Lead time | `minimumBookingNoticeMinutes` | settings PATCH | settings | Notice filter in engine | CONNECTED_AND_WORKING |
| Booking rules | Booking horizon | Number | Max advance | `maximumBookingDaysAhead` | settings PATCH | settings | Day range cap | CONNECTED_AND_WORKING |
| Booking rules | Workspace limits | Numbers | Caps | `bookingLimits` | settings PATCH | settings | `checkBookingLimitsFromCounts` | CONNECTED_AND_WORKING |
| Booking rules | Start time rules | SchedulingRulesSection | Intervals/fixed/density | `schedulingLimits` | settings PATCH | settings | `fixed-start-times`, density hide | CONNECTED_AND_WORKING |
| Calendars | Staff calendar table | Table | See blocking connections | staff + integrations | — | calendars API | `getStaffExternalBusy` | READ_ONLY_BY_DESIGN |
| Calendars | Manage calendars | Link | Connect OAuth | — | — | `/integrations/calendars` | External busy | READ_ONLY_BY_DESIGN |

## Counts (this pass)

| Status | Count |
|--------|------:|
| CONNECTED_AND_WORKING | 22 |
| READ_ONLY_BY_DESIGN | 14 |
| INTENTIONALLY_DISABLED_WITH_REASON | 0 |
| BROKEN | 0 |
| NO_OP | 0 |
| PLACEHOLDER | 0 |

## Bidirectional relationships

| Relationship | Canonical store | Availability UI | Service/Staff UI |
|--------------|-----------------|-----------------|------------------|
| Staff ↔ Service | `staff.appointmentTypeIds` + `svcCfg.staffIds` | Staff drawer toggles `appointmentTypeIds` | Service Staff & place toggles `staffIds` |
| Staff ↔ Location | `staff.locationIds` + `location.staffIds` | Staff drawer toggles `locationIds` | Staff + Locations pages |
| Service resources | `svcCfg.resourceIds` | Read-only + link | Service editor |
| Platform hours | `platform.weeklyHours` | Weekly hours section | — |

**Note:** Changing `staffIds` on the service side does not automatically sync `appointmentTypeIds` on staff rows unless existing sync helpers run; staff drawer writes staff-side array (same as Staff page).
