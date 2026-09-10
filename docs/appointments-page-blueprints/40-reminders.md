# Blueprint 40 — Reminders (`/appointments/reminders`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-4 ABSORPTION GAPS

| Feature ID | Feature | Final Section | UI Pattern | Backend | Status |
|---|---|---|---|---|---|
| REM-01 | SMS reminders | Sequence editor | Channel + template | `reminder-delivery.ts` | ABSORBED |
| REM-02 | Email reminders | Sequence editor | Channel + subject/body | `reminder-engine.ts` | ABSORBED |
| REM-03 | ICS attachment | Email step | Toggle | `ics-builder.ts` | ABSORBED |
| REM-04 | Test send | Header tools | Test card | reminders/test API | ABSORBED |
| REM-05 | Email tracking | Delivery defaults | Helper text | tracking URLs in engine | RUNTIME_UI_EFFECT |
| REM-06 | Voice channel | Voice section + step picker | Embedded panel | `appointment-voice-reminders/` | ABSORBED |
| REM-07 | Voice retry | Voice section | Advanced helper | retry job runtime | RUNTIME_UI_EFFECT |
| REM-08 | SMS consent | Delivery defaults | Info + link | `sms-consent-disclosure.ts` | ABSORBED |
| REM-09 | Voice page migration | Absorb `/voice-reminders` | Canonical in Reminders | voice-reminders API | ABSORBED |
