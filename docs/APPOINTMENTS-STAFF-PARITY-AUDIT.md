# Staff competitive parity

| Capability | Result | Notes |
|------------|--------|-------|
| Multiple providers | **PASS** | Platform staff array |
| Staff profile | **PASS** | Name, title, contact, bio |
| Photo | **PARTIAL** | URL / avatarUrl |
| Public display name | **PASS** | `publicDisplayName` on public book API |
| Title / role label | **PASS** | `title` |
| Bio | **PASS** | Public API + preview |
| Active / inactive | **PASS** | `active` + deactivate flow |
| Public visibility | **PASS** | `customerSelectable` |
| Customer provider choice | **PASS** | Routing + public list |
| Service assignment | **PASS** | Sync to Service `staffIds` |
| Location assignment | **PASS** | Bidirectional `location.staffIds` |
| Availability linkage | **PASS** | Summary + deep link |
| Calendar connection status | **PASS** | Read-only from integrations |
| Direct staff booking | **N/A** | |
| Staff ordering | **GAP** | |
| Meeting host | **PASS** | Via Service staff pools |
| Class instructor | **PASS** | Class editor staff |
| Workshop host | **PASS** | Workshop editor |
| Routing participation | **PASS** | Summary |
| Team booking participation | **PASS** | Summary |
| Staff login / invite | **PARTIAL** | Team settings link |
| Permissions linkage | **PARTIAL** | Team settings |
| Appointment history | **PASS** | Metadata staffId / teamStaffIds |
| Deactivation | **PASS** | Blocks with future appt warning |
| Future-booking safety | **PASS** | 409 unless force |
| Mobile admin | **PARTIAL** | Responsive tables |
