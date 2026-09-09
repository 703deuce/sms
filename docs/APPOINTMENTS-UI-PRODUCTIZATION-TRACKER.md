# Appointments UI Productization Tracker

**Authority:** Transovo UX standards pack + user productization directive (48 features).  
**Rule:** Backend/API existence ≠ feature complete. Each row needs discoverable UI, full journey, and browser evidence.

## Worksheet template (required before each feature)

| Field | |
|-------|---|
| Feature | |
| Primary user | |
| Primary user goal | |
| Canonical home | |
| Existing backend/runtime | |
| Existing UI | |
| Missing UI | |
| Business-owner workflow | |
| Staff workflow | |
| Customer workflow | |
| Important states | |
| Inheritance/override rules | |
| Dependencies | |
| Browser UAT | |
| Files/components to reuse | |

## Priority waves

| Wave | Features | Focus |
|------|----------|--------|
| **A (now)** | 1–4, 8–13, 20, 33, 46 | Availability rules, locations nav, resources, share/QR, invoices |
| **B** | 5–7, 15–18, 45 | Type editor depth, multi-service, intake, terms |
| **C** | 19, 24–32, 35–44 | Contracts, commerce, POS, classes, portal, manage |
| **D** | 48 | Provider-blocked channel UI (honest states) |

## Status ledger

| # | Feature | Canonical home | UI status | Notes |
|---|---------|----------------|-----------|-------|
| 1 | Fixed start times | Availability → Schedules | PARTIAL → **IN PROGRESS** | List editor replacing raw comma field |
| 2 | Custom start interval | Availability → Advanced | PARTIAL → **IN PROGRESS** | Preset + custom + example copy |
| 3 | Visible availability density | Availability → Advanced | PARTIAL → **IN PROGRESS** | Business-language toggle + % select |
| 4 | Minimize gaps | Availability → Advanced | PARTIAL → **IN PROGRESS** | Radio + helper text |
| 5 | Service phases | Booking Types → Duration | PARTIAL | Type editor exists; DELETE + timeline pending |
| 6 | Multi-service booking | Public scheduler | PARTIAL | Summary wired; per-line staff pending |
| 7 | Multi-staff per line | Public + appointment detail | PARTIAL | |
| 8 | Locations management | Availability → Locations | PARTIAL → **IN PROGRESS** | Nav discoverability |
| 9 | Location hours | Location editor | PARTIAL | Single window/day; overrides pending |
| 10 | Location timezone | Location editor | GOOD | |
| 11 | Location staff | Location editor | PARTIAL | Checkbox list exists |
| 12 | Location resources | Location editor | PARTIAL | Checkbox list exists |
| 13 | Resource quantity | Booking → Resources | PARTIAL | Editor added in commerce tab |
| 14 | Resource pools | Booking → Resources | THIN | |
| 15 | Add-ons | Booking Types / Commerce | PARTIAL | |
| 16 | Intake forms | Booking config | PARTIAL | Builder exists; public assign pending |
| 17 | Intake file upload | Public checkout | PARTIAL | Routes exist |
| 18 | Terms & conditions | Booking type policies | THIN | |
| 19 | Contracts + e-sign | Booking Types + detail | **NONE** | API only — wave C |
| 20 | Booking QR | Booking → Share | GOOD | GET image fix deployed |
| 21 | Custom domain | Booking Pages → Appearance | THIN | Backend field; UI pending wave A |
| 22 | Custom CSS | Booking Pages → Advanced | THIN | |
| 23 | Custom terminology | Booking Pages → Language | THIN | |
| 24–32 | Commerce / POS | Payments / Booking commerce | PARTIAL | POS needs contact picker |
| 33 | Invoices | Payments → Invoices | THIN → **IN PROGRESS** | Dedicated page + public pay |
| 34 | Refunds | Payments → Transaction detail | PARTIAL | Refund modal exists |
| 35–41 | Classes / waitlist / tickets | Appointments / Classes | PARTIAL | |
| 42–44 | Portal / manage / recurring | Public | PARTIAL | Manage link core exists |
| 45 | Calendar colors | Calendar settings + type editor | THIN | |
| 46 | Booking brand hub | Booking Pages unified | PARTIAL | Cross-links in progress |
| 47 | Commerce cross-links | Contextual | PARTIAL | |
| 48 | Provider-blocked channels | Integrations | THIN | Honest disconnected states |

**UI status:** NONE | THIN | PARTIAL | GOOD | IN PROGRESS
