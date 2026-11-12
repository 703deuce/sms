# Appointments — Residual V1 Implementation Queue (Batch 8C)

**Generated:** 2026-09-10
**Type:** Mechanical reconciliation — implementation work only
**Total residual rows:** 2

## /appointments/availability

### 3-20 — Slot diagnostics
- **Gap type:** V1_CONTEXTUAL_FLOW_GAP
- **Section:** /appointments/availability
- **Missing:** Service → create staff contextual return
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** contextual audit; routeExists=true; backend=true

## /appointments/polls

### 15-7 — Meeting polls
- **Gap type:** V1_ADMIN_UI_GAP
- **Section:** /appointments/polls
- **Missing:** Per-booking-type permission editor
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** STILL_MISSING; routeExists=true; backend=true

## Proposed residual implementation batches (8D series)

| Batch | Domain | Approx rows |
|-------|--------|------------:|
| 8D-1 | Route convergence + wrong-placement (commerce hub → canonical pages) | 0 |
| 8D-2 | Public booking payment + class/event + AI public flows | 0 |
| 8D-3 | Portal depth (saved cards, membership self-service, household) | 0 |
| 8D-4 | Operations (calendar, detail, waitlist) | admin gaps on ops pages |
| 8D-5 | Automations canonical routes + voice reminder merge | wrong-placement automations |
| 8D-6 | Automations + contacts + integrations/settings admin | completed in 8D-6 wave |
| 8D-7 | Commerce/POS/operations admin residuals | 1 admin + 0 backend |
