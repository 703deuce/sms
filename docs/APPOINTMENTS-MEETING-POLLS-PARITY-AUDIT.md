# Meeting Polls competitive parity

| Capability | Result | Notes |
|------------|--------|-------|
| Multiple time options | **PASS** | Create + archive |
| Guest voting | **PASS** | Public vote route, no account |
| Yes / Maybe / No | **PASS** | Per-option responses |
| Participant invites | **PARTIAL** | Tokens + participants; email send not fully wired |
| Share link | **PASS** | `shareToken` public URL |
| Timezone conversion | **PASS** | IANA + `wallTimeInZoneToUtc` |
| Response deadline | **PASS** | Stored; auto-close setting |
| Response editing | **PASS** | While open when allowed |
| Non-responder reminders | **PARTIAL** | Activity logged; email blast N/A |
| Response matrix | **PASS** | Admin detail section |
| Best-time ranking | **PASS** | Documented scoring |
| Organizer calendar check | **PASS** | On finalize |
| Internal participant calendar | **N/A** | Votes only on public |
| Connected-calendar overlay | **GAP** | Not on public UI |
| Poll privacy controls | **PARTIAL** | Settings flags; limited enforcement |
| Finalize into canonical Meeting | **PASS** | `createPlatformAppointment` |
| Finalization conflict recheck | **PASS** | `filterStaffAvailableForSlot` |
| Meeting invites | **PASS** | Canonical confirmation path |
| Video method connection | **PASS** | On Meeting create only |
| Co-host availability | **N/A** | |
| Poll activity history | **PASS** | `activity[]` |
| Duplicate poll | **PASS** | API action |
| Closed / cancelled / expired | **PASS** | Status + derive |
| Mobile voting | **PASS** | Single column, 44px targets |
