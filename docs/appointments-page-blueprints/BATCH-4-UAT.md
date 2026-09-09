# Batch 4 UAT — Packages + Memberships + Products & Offers

**Branch:** `cursor/packages-memberships-batch4-709b`  
**Date:** 2026-09-09

## Surfaces

| # | Surface | Route | Status |
|---|---------|-------|--------|
| 1 | Packages list | `/appointments/packages` | UAT_PENDING |
| 2 | Package editor | `/appointments/packages/new`, `[id]` | UAT_PENDING |
| 3 | Memberships list | `/appointments/memberships` | UAT_PENDING |
| 4 | Membership editor | `/appointments/memberships/new`, `[id]` | UAT_PENDING |
| 5 | Products & Offers hub | `/appointments/products-offers` | UAT_PENDING |

## Lightweight entry points

| Surface | Route |
|---------|-------|
| Gift Cards | `/appointments/gift-cards` |
| Products | `/appointments/products` |
| Discounts | `/appointments/discounts` |
| Coupons legacy | `/appointments/coupons` → redirects |

## Provider-blocked

- Stripe live subscription (M2, M5, M9, M10)
- Public package purchase with payment (P2 partial)

## Backend gaps

- Package list customer counts: N+1 detail fetch (optimize later)
- Gift/product/discount: minimum list + create only (no deep editors this batch)
- Credit history UI: ledger API exists; per-customer drill-down deferred

## Cross-regression

- `/appointments/commerce` — transitional banner, mega-page preserved
- Service/Class editor package links → `/appointments/packages`
- POS unchanged at `/appointments/pos`
