# MCTB Notifications — component connection matrix

| Component | Read | Write | Persistence | Downstream | Error | Status |
|-----------|------|-------|-------------|------------|-------|--------|
| Response mode | GET handoff config | POST config | mctbHandoffConfig | process-inbound-reply | save error | CONNECTED_AND_WORKING |
| Guided fields | fieldSchema | POST config | fieldSchemaJson | guided-collection | — | CONNECTED_AND_WORKING |
| Emergency toggles | config | POST config | DB columns | urgency.ts | — | CONNECTED_AND_WORKING |
| Booking behavior | config | POST config | bookingBehavior | booking hook stored | — | CONNECTED_AND_WORKING |
| Recipients | recipients[] | POST recipients | mctbNotificationRecipient | notifications.ts targets | — | CONNECTED_AND_WORKING |
| Routing matrix | routingMatrix | POST config | routingMatrixJson | deliverMctbHandoffNotifications | — | CONNECTED_AND_WORKING |
| Quiet hours | quietHours | POST config | quiet hours columns | quiet hour suppression | — | CONNECTED_AND_WORKING |
| Test notification | — | action test_notification | delivery audit rows | SMS/email/in-app | test error | CONNECTED_AND_WORKING |
| Preview samples | static | — | — | — | — | READ_ONLY_BY_DESIGN |
| Handoff flow rail | responseMode | — | — | explanatory | — | READ_ONLY_BY_DESIGN |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0**
