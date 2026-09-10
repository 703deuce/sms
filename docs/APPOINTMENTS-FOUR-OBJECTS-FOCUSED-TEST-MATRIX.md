# Four Objects Focused Test Matrix (FOUR-01 – FOUR-26)

| ID | Test | Layer | Status |
|----|------|-------|--------|
| FOUR-01 | Nav: Meetings, Services, Classes, Workshops; no Booking Types | Static | PASS |
| FOUR-02 | Meeting create/save/reload | Browser | PROVIDER_BLOCKED |
| FOUR-03 | Meeting public booking smoke | Browser | PROVIDER_BLOCKED |
| FOUR-04 | Service create/save/reload | Browser | PROVIDER_BLOCKED |
| FOUR-05 | Service public booking smoke | Browser | PROVIDER_BLOCKED |
| FOUR-06 | Class create/save/reload | Static + Browser | Static PASS |
| FOUR-07 | Class occurrence creation | Static | PASS |
| FOUR-08 | Class recurrence (weekly generator) | Static | PASS |
| FOUR-09 | Class capacity enforcement (server) | Static | PASS |
| FOUR-10 | Class public registration | Browser | PROVIDER_BLOCKED |
| FOUR-11 | Class waitlist when enabled | Browser | PROVIDER_BLOCKED |
| FOUR-12 | Class admission/check-in when enabled | Browser | PROVIDER_BLOCKED |
| FOUR-13 | Workshop create/save/reload | Static + Browser | Static PASS |
| FOUR-14 | Workshop date/time persistence | Static | PASS |
| FOUR-15 | Workshop public uses Workshop labels | Static | PASS |
| FOUR-16 | Workshop public registration | Browser | PROVIDER_BLOCKED |
| FOUR-17 | Workshop capacity | Browser | PROVIDER_BLOCKED |
| FOUR-18 | Workshop ticket/check-in when enabled | Browser | PROVIDER_BLOCKED |
| FOUR-19 | Old generic Meeting deep link | Static | PASS |
| FOUR-20 | Old generic Service deep link | Static | PASS |
| FOUR-21 | Old generic Class deep link | Static | PASS |
| FOUR-22 | Old generic Workshop deep link | Static | PASS |
| FOUR-23 | Contextual create / draft preservation | Browser | PROVIDER_BLOCKED |
| FOUR-24 | No unique generic Booking Types functionality | Audit | PRECHECK PASS |
| FOUR-25 | Mobile responsive | Browser | PROVIDER_BLOCKED |
| FOUR-26 | Accessibility | Browser | PROVIDER_BLOCKED |

**Run static layer:** `node scripts/test-booking-four-objects-ia.mjs`

**Run browser layer:** start app with `DEV_AUTH_BYPASS=1`, execute admin create → save → reload → public book for each object.
