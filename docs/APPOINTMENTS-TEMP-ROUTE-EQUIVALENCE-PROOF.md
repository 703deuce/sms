# Appointments — Temp Route Equivalence Proof (Post 8G-0C)

**Generated:** 2026-09-10  
**Purpose:** Prove temp/legacy routes no longer own unique required V1 before 8G-1 retirement.

## Gate result

| Metric | Value |
|--------|------:|
| Temp routes with unique required V1 | **0** |
| Commerce unique required V1 | **0** |
| Policies unique required V1 | **0** |
| Service-booking report unique required V1 | **0** |
| Legacy routing unique required V1 | **0** |
| **READY_FOR_ROUTE_CONVERGENCE** | **YES** |

## Equivalence matrix

| Legacy route | Unique V1 before | Unique V1 now | Canonical destination | Proof |
|--------------|------------------:|--------------:|----------------------|-------|
| `/appointments/policies` | 1 (`workspace-policy`) | 0 | `/settings/business` — Default booking policies | `WorkspaceBookingPoliciesEditor` + `DefaultBookingPoliciesCard`; same `/api/appointments/settings` PATCH |
| `/appointments/reports/service-booking` | 1 (`16-6`) | 0 | `/appointments/analytics/reports` | `ServiceBookingReportCard` calls `loadAcuityStyleReports` via reports API |
| `/appointments/routing` | 1 (`15-2`) | 0 | `/appointments/routing-forms` | `LegacyRoutingRulesPanel` + `resolveAppointmentRouting` on public book |
| `/appointments/commerce` | 12 | 0 | `/appointments/packages` (+ siblings) | 8F-1 canonical commerce admin clients |

## Data compatibility

| Feature | Legacy data | Canonical data | Same? | Write path |
|---------|-------------|----------------|-------|------------|
| Workspace policies | `configJson` on `solutionSetup` | Same fields via settings API | YES | `/api/appointments/settings` PATCH |
| Service booking report | `voiceAppointment` + `appointmentMerchantPayment` queries | Same `loadAcuityStyleReports` | YES | Read-only report |
| Legacy routing rules | `config.routingRules[]` | Same array via settings PATCH | YES | `/api/appointments/settings` PATCH from Routing forms panel |

## Routes ready for retirement (8G-1)

21 non-canonical routes classified **READY_FOR_RETIREMENT** — see `docs/APPOINTMENTS-FINAL-ROUTE-RETIREMENT-MAP.md`.

Legacy route files remain until 8G-1 applies redirects and removes duplicate shells.
