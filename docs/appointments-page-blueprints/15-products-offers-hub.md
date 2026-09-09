# Page Blueprint — Products & Offers Hub

**Status:** FINAL — Batch 4  
**Route:** `/appointments/products-offers`

```
PAGE: Products & Offers
ROUTE: /appointments/products-offers
CLASSIFICATION: SPLIT — lightweight landing / discovery hub
PRIMARY USER: Business owner
PRIMARY USER JOB: See what else I can sell or use to promote sales (gift cards, products, discounts, POS)
SOURCE FEATURE ROWS: Gift cards, Products, Coupons, POS — not Packages/Memberships (own lists)
```

## PRIMARY ACTION

None global — card-level actions per section

## SECONDARY ACTIONS

Quick links to Packages, Memberships lists

## PAGE SECTIONS IN ORDER

1. Header — Products & Offers
2. Quick links — Packages · Memberships (peer products)
3. Card — Gift Cards → `/appointments/gift-cards`
4. Card — Products → `/appointments/products`
5. Card — Discounts → `/appointments/discounts`
6. Card — Point of Sale → `/appointments/pos`
7. Transitional note — legacy Commerce link for unmigrated admin tools

## EMPTY STATE

N/A — cards always show; counts optional when zero

## DEPENDENCIES

Summary counts from gift/products/coupons APIs (optional)

## BACKEND PRESENT

All list APIs exist; POS page exists (`PosCartAdminClient`)

## BACKEND GAPS

Programs/Rewards hidden. No inline management on hub.

## BROWSER UAT

H1–H6 discovery and entry points

## OLD ROUTES TO MERGE/RETIRE

`/appointments/commerce` demoted — banner + redirect hints. `/appointments/coupons` → discounts focused list.
