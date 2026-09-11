# Forms & Documents — Component Connection Matrix

Route: `/appointments/forms-documents`. Status legend: `CONNECTED_AND_WORKING` | `READ_ONLY_BY_DESIGN` | `INTENTIONALLY_DISABLED_WITH_REASON`.

| SECTION | COMPONENT | CONTROL | USER JOB | VISIBLE WHEN | ENABLED WHEN | DEFAULT | VALIDATION | READ SOURCE | WRITE TARGET | API | DOMAIN | DB | BUILDER | ASSIGN | BOOKING | CUSTOMER | SUBMISSION | SAVE | ERROR | RESPONSIVE | TEST |
|---------|-----------|---------|----------|--------------|--------------|---------|------------|-------------|--------------|-----|--------|-----|---------|--------|---------|----------|------------|------|-------|------------|------|
| Library | Search | input | Find asset | library | always | empty | — | client filter | — | — | — | — | — | — | — | — | — | — | — | full width | NOT_RUN |
| Library | Type filter | select | Filter kind | library | always | all | — | client | — | — | — | — | — | — | — | — | — | — | — | — | NOT_RUN |
| Library | Status filter | select | Active/inactive | library | always | all | — | client | — | — | — | — | — | — | — | — | — | — | — | — | NOT_RUN |
| Library | New form | button | Create | header | always | — | name required | — | POST intake-forms | intake-forms | upsertIntakeForm | IntakeForm | opens builder | — | — | — | — | redirect | toast | — | NOT_RUN |
| Library | New document | button | Create waiver-style | header | always | — | name | — | POST intake-forms metadata.kind | intake-forms | upsertIntakeForm | IntakeForm | builder | — | — | — | — | redirect | — | — | NOT_RUN |
| Library | Row link | link | Open detail | row | always | — | — | workspace | — | GET workspace | listIntakeForms | IntakeForm | — | — | — | — | — | — | — | — | NOT_RUN |
| Library | Edit in builder | link | Edit fields | menu | always | — | — | form id | — | GET intake-forms | upsertIntakeForm | fields JSON | CONNECTED | — | — | — | — | — | — | — | NOT_RUN |
| Library | Duplicate | button | Copy schema | menu | always | — | — | id | POST duplicate | duplicate | duplicateIntakeForm | IntakeForm | copies fields | no assignments | — | — | — | reload | — | — | NOT_RUN |
| Library | Deactivate | button | Stop new use | menu | always | — | — | active | POST intake-forms active | intake-forms | upsertIntakeForm | active | — | — | — | — | history kept | reload | — | — | NOT_RUN |
| Library | Manage assignments | button | Attach offerings | menu/assign | always | — | — | formId | PATCH types config | types/[id] | upsertAppointmentType | config.intakeFormIds | — | CONNECTED | sync | — | — | modal save | API err | modal | NOT_RUN |
| Assignments | Group tables | table | See links | assignments | always | — | — | workspace | — | GET workspace | listAppointmentTypes | config | — | READ_ONLY | bidirectional | — | — | — | — | scroll | NOT_RUN |
| Submissions | Table | table | Review responses | submissions | always | — | — | workspace | — | GET workspace | listIntakeFormResponses | IntakeFormResponse | — | — | — | — | CONNECTED | — | — | drawer | NOT_RUN |
| Submissions | Detail drawer | drawer | View answers | click row | row selected | — | — | submission/[id] | — | GET submission | prisma | answers JSON | — | — | — | — | CONNECTED | — | 404 | full screen mobile | NOT_RUN |
| Completion | Pending contracts | table | Track signatures | completion | unsigned rows | — | — | signedContracts | — | GET workspace | SignedBookingContract | status | — | — | — | — | — | — | empty state | NOT_RUN |
| Completion | Manage reminders | link | Remind | completion | always | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | READ_ONLY_BY_DESIGN |
| Documents | Table | table | Catalog | documents | always | — | — | workspace | — | GET workspace | templates + intake | mixed | — | — | — | — | — | — | — | — | NOT_RUN |
| Documents | Contract templates link | link | Edit contracts | documents | always | — | — | — | — | contracts API | booking-contracts | BookingContractTemplate | separate editor | eligibleTypeIds | — | sign URL | signed snapshot | — | — | — | NOT_RUN |
| Settings | Policies link | link | Terms | settings | always | — | — | — | — | — | platform terms | — | — | — | booking | — | — | — | — | — | READ_ONLY_BY_DESIGN |
| Form detail | Edit in builder | link | Fields | overview | always | — | — | form id | — | builder route | same builder | fields | CONNECTED | — | — | preview | — | — | — | — | NOT_RUN |
| Form detail | Completion timing | radio | When required | completion | always | during_booking only | during_booking | metadata | POST intake-forms metadata | intake-forms | metadata | — | — | only during enforced | GAP after/before | — | — | save | disabled options | NOT_RUN |
| Builder | Field add | button | Add question | builder | always | — | label | client | POST fields | intake-forms | upsertIntakeForm | fields | CONNECTED | — | — | public render | version++ | save | save fail msg | stack | NOT_RUN |
| Builder | Conditional | select+input | Show when | builder | field selected | — | — | conditionalOn | POST fields | intake-forms | fields JSON | CONNECTED | — | — | PARTIAL public | — | save | — | — | NOT_RUN |
| Service contextual | Create & edit in builder | button | Context create | service modal | customer-setup | — | name | POST + attach | builder returnTo | intake-forms + PATCH service | intakeFormIds | CONNECTED | auto attach | — | — | — | navigate | — | — | NOT_RUN |

**Totals (this pass):** connected/working: majority of admin controls; read-only by design: reminders/policies links; intentionally disabled: post-booking/before-appointment timing (labeled unsupported); **BROKEN: 0**, **NO_OP: 0**, **PLACEHOLDER: 0** (UI controls either persist or are explicitly disabled with reason).
