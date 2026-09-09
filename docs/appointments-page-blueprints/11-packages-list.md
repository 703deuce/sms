# Page Blueprint — Packages List

**Status:** FINAL — Batch 4  
**Route:** `/appointments/packages`

```
PAGE: Packages
ROUTE: /appointments/packages
CLASSIFICATION: SPLIT — focused list
PRIMARY USER: Business owner / front desk admin
PRIMARY USER JOB: Show me the packages I sell
SOURCE FEATURE ROWS: APPOINTMENTS-MASTER-FEATURE-INVENTORY — Packages
```

## PRIMARY ACTION

Create package → `/appointments/packages/new`

## SECONDARY ACTIONS

Copy store link, Open Products & Offers hub, Row: Edit, Sell/assign, View customers, Duplicate, Enable/Disable

## LOCAL NAV

Products & Offers hub (optional back) · Packages (current)

## PAGE SECTIONS IN ORDER

1. Back link — Products & Offers or Booking
2. Header — H1 Packages + supporting copy
3. Actions — Copy store link (secondary), Create package (primary)
4. Table or empty state

## TABLE/LIST FIELDS

| Column | Source |
|--------|--------|
| Package name | `name` → editor |
| Price | `priceCents` |
| Included credits | `creditRules` summary |
| Validity | `expirationDays` |
| Customers | active `PackageBalance` count |
| Status | `active` |

## DRAWERS / MODALS

None on list — assign/sell from editor or POS

## EMPTY STATE

Headline: *Sell multiple sessions together*  
Body: Packages let customers prepay for a set number of services or classes.  
CTA: Create your first package

## LOADING / ERROR / SUCCESS

Skeleton table; retry banner; row actions refresh list

## DEPENDENCIES

`GET /api/appointments/service-booking/packages`, settings (workspace slug for store link)

## CONTEXTUAL CREATE ACTIONS

Service/Class editor → Create package (preserves draft, returns)

## PUBLIC COUNTERPART

`/book/[slug]/store` packages section

## RESPONSIVE

Responsive table / stacked cards on narrow viewports

## ACCESSIBILITY

Semantic table, row action labels, keyboard menus

## BACKEND PRESENT

`listPackageProducts`, `upsertPackageProduct`, `purchasePackageForContact`

## BACKEND GAPS

No delete — disable only. Customer count requires balance query (add stats in list load).

## BROWSER UAT

P1 create package appears in list

## OLD ROUTES TO MERGE/RETIRE

`/appointments/commerce` packages tab → this list. Commerce remains transitional hub.
