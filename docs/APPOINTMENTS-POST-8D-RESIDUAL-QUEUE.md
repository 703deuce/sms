# Appointments — Post-8D Residual Implementation Queue (Batch 8E)

**Generated:** 2026-09-10
**Waves reconciled:** 8D-1 through 8D-7
**Total residual rows:** 18

## /appointments/availability

### 3-20 — Slot diagnostics
- **Gap type:** V1_CONTEXTUAL_FLOW_GAP
- **Canonical page:** /appointments/availability
- **Missing:** Service → create staff contextual return
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** contextual audit; routeExists=true; backend=true

## /appointments/discounts

### 8-18 — Coupons / discounts
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/discounts
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/discounts; routeExists=false; backend=false

## /appointments/gift-cards

### 8-16 — Gift balance redemption at checkout
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/gift-cards
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/gift-cards; routeExists=true; backend=false

## /appointments/memberships

### 8-11 — Membership failed-payment suspension
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/memberships
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-12 — Membership payment recovery / entitlement restore
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/memberships
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-13 — Membership-only booking types / classes
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/memberships
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

### 8-14 — Recurring membership credit replenishment
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/memberships
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/memberships; routeExists=true; backend=false

## /appointments/new

### 6-2 — Create appointment (staff)
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/new
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/new; routeExists=true; backend=true

## /appointments/packages

### 8-1 — Packages & memberships hub
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=null

### 8-3 — Package purchase
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-5 — Package lifecycle (restore on cancel)
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-6 — Package credit forfeiture (late cancel / no-show)
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-7 — Mixed-content package entitlements
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=false

### 8-33 — Policy fees (late cancel / no-show)
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/packages
- **Missing:** Backend exists; admin/contextual UI not exposed on final page
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/packages; routeExists=true; backend=true

## /appointments/polls

### 15-7 — Meeting polls
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/polls
- **Missing:** Per-booking-type permission editor
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** STILL_MISSING; routeExists=true; backend=true

## /appointments/pos

### 7-1 — Manage appointment link
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/pos
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** /appointments/pos; routeExists=true; backend=false

## /appointments/types/events

### 18-7 — Audit timeline on appointment
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** /appointments/types/events
- **Missing:** Admin UI partial
- **Backend:** YES / PARTIAL
- **Priority:** P2
- **Evidence:** /appointments/types/events; routeExists=true; backend=false

## PARITY_TEMP

### 3-21 — Dynamic pricing by slot
- **Gap type:** V1_ADMIN_UI_GAP
- **Canonical page:** PARITY_TEMP
- **Missing:** Admin UI partial
- **Backend:** YES / LIKELY
- **Priority:** P2
- **Evidence:** PARITY_TEMP; routeExists=null; backend=false

## Proposed next implementation batches (post-8D)

| Batch | Domain | Feature IDs | Gap type | Rows |
|-------|--------|-------------|----------|-----:|
| **8F-1** | Commerce admin depth (packages, memberships, gift cards, discounts, POS) | 7-1, 8-1, 8-3, 8-5, 8-6, 8-7, 8-11, 8-12, 8-13, 8-14, 8-16, 8-18, 8-33 | V1_ADMIN_UI_GAP | 13 |
| **8F-2** | Operations admin (staff create, events audit, dynamic pricing) | 3-21, 6-2, 18-7 | V1_ADMIN_UI_GAP | 3 |
| **8F-3** | Booking permissions + polls | 15-7 | V1_ADMIN_UI_GAP | 1 |
| **8F-4** | Contextual flow completion | 3-20 | V1_CONTEXTUAL_FLOW_GAP | 1 |
| **8G-1** | Route convergence + legacy retirement | temp routes with unique V1 | temp uniqueness | 4 routes / 15 functions |
