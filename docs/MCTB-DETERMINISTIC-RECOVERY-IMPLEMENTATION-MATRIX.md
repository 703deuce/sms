# MCTB deterministic recovery — implementation matrix (launch pass)

Legend: **Action** = KEEP | VERIFY | EXPOSE IN UI | COMPLETE | REUSE | FIX

| # | Requirement | Runtime | Persistence | API | UI | E2E | Action |
|---|-------------|---------|-------------|-----|----|-----|--------|
| 1 | Five first-message strategies | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 2 | Callback expectation | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 3 | Information request builder | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 4 | Dynamic information-request wording | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 5 | Business hours configuration | Yes | Yes | Yes | Yes | Manual | COMPLETE |
| 6 | During/after-hours messaging | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 7 | After-hours callback expectation | Yes | Yes | Yes | Yes | Script | COMPLETE |
| 8 | First-reply acknowledgment | Yes | Yes | N/A | N/A | Script | VERIFY |
| 9 | Acknowledgment UI | Yes | N/A | N/A | Yes | Manual | COMPLETE |
| 10 | Automation ends after ack | Yes | Yes | N/A | N/A | No | VERIFY |
| 11 | Business notification (email/in-app) | Yes | Yes | Yes | Partial | No | VERIFY |
| 12 | SMS notification to owner | Partial | Yes | Yes | Partial | No | REUSE notifications UI |
| 13 | Multiple recipients | Yes | Yes | Yes | Yes | No | KEEP |
| 14 | Duplicate-call suppression | Yes | Yes | Yes | N/A | No | VERIFY |
| 15 | Suppression UI | Yes | Default | N/A | N/A | No | KEEP |
| 16 | Repeat-call indicator | Yes | Yes | Yes | Yes | Manual | COMPLETE |
| 17 | Voicemail reinforces SMS | Yes | Yes | Yes | Partial | Manual | COMPLETE |
| 18 | Voicemail UI | Yes | Yes | Yes | Yes | Manual | COMPLETE |
| 19 | Send timing | Yes | Yes | Yes | Yes (recovery) | No | KEEP |
| 20 | Delivery/runtime health | Yes | Yes | Yes | Partial | No | VERIFY |
| 21 | Core analytics | Yes | Yes | Yes | Yes | No | KEEP |
| 22 | Template/timing metadata | Yes | Yes | Yes | N/A | No | KEEP |
| 23 | Handled/recovered state | Partial | Yes | Partial | No | No | GAP (report) |
| 24 | AI Recovery hidden | Yes | Yes | Yes | Yes | No | KEEP |
