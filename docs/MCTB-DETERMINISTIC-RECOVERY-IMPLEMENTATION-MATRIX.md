# MCTB deterministic recovery — implementation matrix (launch pass)

Legend: **Action** = KEEP | VERIFY | EXPOSE IN UI | COMPLETE | REUSE | FIX

| # | Requirement | Runtime | Persistence | API | UI | E2E | Action |
|---|-------------|---------|-------------|-----|----|-----|--------|
| 1 | Five first-message strategies | Yes | Yes | Yes | Partial | No | COMPLETE UI |
| 2 | Callback expectation | Yes | Yes | Yes | Partial | No | EXPOSE IN UI |
| 3 | Information request builder | Yes | Yes | Yes | Partial | No | EXPOSE IN UI |
| 4 | Dynamic information-request wording | Yes | Yes | Yes | Partial | No | EXPOSE IN UI |
| 5 | Business hours configuration | Partial | Yes | Yes | No | No | EXPOSE IN UI |
| 6 | During/after-hours messaging | Partial | Yes | Yes | Partial | No | COMPLETE |
| 7 | After-hours callback expectation | Yes | Yes | Yes | Partial | No | EXPOSE IN UI |
| 8 | First-reply acknowledgment | Yes | Yes | N/A | No | No | VERIFY |
| 9 | Acknowledgment UI | Yes | N/A | N/A | No | No | EXPOSE IN UI |
| 10 | Automation ends after ack | Yes | Yes | N/A | N/A | No | VERIFY |
| 11 | Business notification (email/in-app) | Yes | Yes | Yes | Partial | No | VERIFY |
| 12 | SMS notification to owner | Partial | Yes | Yes | Partial | No | REUSE notifications UI |
| 13 | Multiple recipients | Yes | Yes | Yes | Yes | No | KEEP |
| 14 | Duplicate-call suppression | Yes | Yes | Yes | N/A | No | VERIFY |
| 15 | Suppression UI | Yes | Default | N/A | N/A | No | KEEP |
| 16 | Repeat-call indicator | Yes | Yes | Yes | No | No | EXPOSE IN UI |
| 17 | Voicemail reinforces SMS | Partial | Partial | Partial | No | No | COMPLETE |
| 18 | Voicemail UI | Yes | Yes | Yes | Partial | No | EXPOSE IN UI |
| 19 | Send timing | Yes | Yes | Yes | Yes (recovery) | No | KEEP |
| 20 | Delivery/runtime health | Yes | Yes | Yes | Partial | No | VERIFY |
| 21 | Core analytics | Yes | Yes | Yes | Yes | No | KEEP |
| 22 | Template/timing metadata | Yes | Yes | Yes | N/A | No | KEEP |
| 23 | Handled/recovered state | Partial | Yes | Partial | No | No | GAP (report) |
| 24 | AI Recovery hidden | Yes | Yes | Yes | Yes | No | KEEP |
