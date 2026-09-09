# Page Blueprint — Forms & Documents

**Status:** FINAL — Batch 5  
**Route:** `/appointments/forms-documents`

```
PAGE: Forms & Documents
ROUTE: /appointments/forms-documents?tab=intake|contracts|terms
CLASSIFICATION: NEW/MERGE — unified hub for intake, contracts, terms
PRIMARY USER: Business owner / compliance-aware admin
PRIMARY USER JOB: Create reusable forms, contracts, and terms customers complete or accept
SOURCE FEATURE ROWS: Intake forms, booking contracts, terms acceptance
```

## EXISTING UI TO PRESERVE

`IntakeFormsPanel`, `ContractsAdminClient`, `TermsConsentPanel` field behavior — new shell only

## EXISTING COMPONENTS TO REUSE

Extract intake builder from `service-booking-admin-client`; `ContractsAdminClient`; terms settings PATCH

## PRIMARY ACTION

Tab-dependent: Create intake form | Create contract template | Create terms

## SECONDARY ACTIONS

Edit, Duplicate, Disable, Archive; Manage forms link from editors

## LOCAL NAV

Booking → Forms & Documents

## PAGE SECTIONS IN ORDER

1. Header — H1 Forms & Documents
2. Local tabs — Intake Forms | Contract Templates | Terms
3. Section list + builder/editor per tab

## TABLE/LIST FIELDS

**Intake:** name, field count, used by, status  
**Contracts:** name, used by, active, last updated  
**Terms:** name, version label, used by, updated

## DRAWERS / MODALS

Quick-create from Service/Class/Event editors (intake, contract, terms)

## EMPTY STATE

Per-section teaching copy (not one generic box)

## LOADING / ERROR / SUCCESS

Per-tab skeleton; save toasts; validation inline

## DEPENDENCIES

`/api/appointments/service-booking/intake-forms`, `/api/appointments/service-booking/contracts`, `/api/appointments/settings` (terms)

## CONTEXTUAL CREATE ACTIONS

Service editor intake/contract/terms sections with draft preservation

## PUBLIC COUNTERPART

Public booking intake step; contract signing flow; terms acceptance gate

## RESPONSIVE

Tabs scroll horizontal; builder stacks on mobile

## ACCESSIBILITY

Tab list semantics, labeled fields, required errors linked

## BACKEND PRESENT

`listIntakeForms`, `upsertIntakeForm`, contract templates API, terms on settings

## BACKEND GAPS

Per-service terms picker UI was stubbed — wire assignment in service editor

## BROWSER UAT

F1–F6 per Batch 5 spec

## OLD ROUTES TO MERGE/RETIRE

`/appointments/contracts`, `/appointments/booking/contracts` → redirect; Commerce intake/terms transitional
