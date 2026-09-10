# Page Blueprint — Packages (Batch 8B-2)

**Route:** `/appointments/packages`  
**Primary user job:** Create and manage bundles of sessions customers can buy and use.

## Structure

1. Package list (table)
2. Package editor sections: General · Included services & classes · Price & purchase · Validity · Credit rules · Customers & credits
3. Sell / assign drawer
4. Adjust credits + credit history modals

## Backends

- `packages.ts` — definitions, purchase
- `package-lifecycle.ts` — adjust credits, ledger history
- `PackageCreditRule` in product `creditRules`
- `metadata.lifecyclePolicy` for cancel/no-show credit behavior

## Status

ABSORBED_CANONICAL_UI for core admin. PUBLIC_WAVE_PENDING / PORTAL_WAVE_PENDING for customer surfaces.

## Absorbed from

- `/appointments/commerce` packages section
