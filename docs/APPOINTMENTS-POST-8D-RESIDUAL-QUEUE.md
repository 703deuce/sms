# Appointments — Post-8D Residual Implementation Queue (Batch 8E)

**Generated:** 2026-09-10
**Waves reconciled:** 8D-1 through 8D-7
**Total residual rows:** 2

## /appointments/availability

### 3-20 — Slot diagnostics
- **Gap type:** V1_CONTEXTUAL_FLOW_GAP
- **Canonical page:** /appointments/availability
- **Missing:** Service → create staff contextual return
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** contextual audit; routeExists=true; backend=true

## /appointments/polls

### 15-7 — Meeting polls
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/polls
- **Missing:** Per-booking-type permission editor
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** STILL_MISSING; routeExists=true; backend=true

## Proposed next implementation batches (post-8D)

| Batch | Domain | Feature IDs | Gap type | Rows |
|-------|--------|-------------|----------|-----:|
| **8F-3** | Booking permissions + polls | 15-7 | V1_ADMIN_UI_GAP | 1 |
| **8F-4** | Contextual flow completion | 3-20 | V1_CONTEXTUAL_FLOW_GAP | 1 |
| **8G-1** | Route convergence + legacy retirement | temp routes with unique V1 | temp uniqueness | 4 routes / 15 functions |
