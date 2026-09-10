# Appointments — Final Route Retirement Map (Batch 8G-0)

**Generated:** 2026-09-10  
**Purpose:** Prepared for 8G-1 — do NOT apply redirects until implementation + temp-route gates pass.

| Old route | Canonical destination | Redirect type | Query/param preservation | Retirement status | Unique V1 IDs (now) |
|-----------|----------------------|---------------|--------------------------|-------------------|---------------------|
| `/appointments/booking/branding` | /appointments/booking hub | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/booking/contracts` | Duplicate of /appointments/booking/forms | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/booking/share` | /appointments/booking hub | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/categories` | /appointments/types | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/classes` | /appointments/types/classes | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/client-restrictions` | /contacts/[id] Booking Access | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/commerce` | /appointments/packages (default); section-aware map for deep links | section-aware-301 | section=packages→/appointments/packages; section=memberships→/appointments/memberships; section=gifts→/appointments/gift-cards; section=coupons→/appointments/discounts; section=addons→/appointments/types; section=products→/appointments/pos; section=resources→/appointments/booking/rooms-equipment; section=classes→/appointments/types/classes; section=intake→/appointments/booking/forms; section=theme→/appointments/booking; section=reports→/appointments/analytics/reports; section=webhooks→/integrations/developer; section=invoices→/payments/invoices; section=dynamicPricing→/appointments/types/services | READY_FOR_RETIREMENT | — |
| `/appointments/commerce/contact-merge` | /contacts merge modal | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/contracts` | /appointments/booking/forms | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/coupons` | /appointments/discounts | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/no-show-recovery` | /appointments/automations/no-show | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/policies` | /appointments/types → Policies (per-type) + /appointments/booking for workspace defaults | 301 | none | STILL_HAS_UNIQUE_V1 | workspace-policy |
| `/appointments/recall-campaigns` | /appointments/automations/recall | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/reports/service-booking` | /appointments/analytics/reports | 301 | from/to query if present | STILL_HAS_UNIQUE_V1 | 16-6 |
| `/appointments/resources` | /appointments/booking/rooms-equipment | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/restrictions` | Duplicate client-restrictions | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/routing` | /appointments/routing-forms (15-1) — legacy rules need migration or compat editor | compat-wrapper-or-301 | none | COMPATIBILITY_REQUIRED | 15-2 |
| `/appointments/scheduled` | /appointments | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/segments` | /contacts/segments + /appointments/recalls | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/service-booking` | Alias hub entry — canonical pages exist | 301 | none | READY_FOR_RETIREMENT | — |
| `/appointments/voice-reminders` | /appointments/reminders | 301 | none | READY_FOR_RETIREMENT | — |

## Section-aware commerce redirects (8G-1)

| section= query | Destination |
|----------------|-------------|
| `packages` | `/appointments/packages` |
| `memberships` | `/appointments/memberships` |
| `gifts` | `/appointments/gift-cards` |
| `coupons` | `/appointments/discounts` |
| `products` | `/appointments/pos` |
| `addons` | `/appointments/types` |
| `resources` | `/appointments/booking/rooms-equipment` |
| `classes` | `/appointments/types/classes` |
| `intake` | `/appointments/booking/forms` |
| `theme` | `/appointments/booking` |
| `reports` | `/appointments/analytics/reports` |
| `webhooks` | `/integrations/developer` |
| `invoices` | `/payments/invoices` |
| `dynamicPricing` | `/appointments/types/services` |

## Compatibility notes

- **`/appointments/commerce`:** Root → /appointments/packages; deep links with section= need mapping table
- **`/appointments/payments`:** V2_DEFERRED — retain route, remove from V1 nav
- **`/appointments/policies`:** Per-type policy text exists on TypeAdvancedSections; workspace-global editor still only here
- **`/appointments/reports/service-booking`:** /appointments/analytics/reports has ScheduleReportCard + analytics CSV — not loadAcuityStyleReports panel
- **`/appointments/routing`:** Distinct from routing-forms (15-1); public book API still reads settings.routingRules
