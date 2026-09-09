# Page Blueprint — Package Editor

**Status:** FINAL — Batch 4  
**Route:** `/appointments/packages/new`, `/appointments/packages/[id]`

```
PAGE: Package editor
ROUTE: /appointments/packages/new | /appointments/packages/[id]
CLASSIFICATION: SPLIT — focused settings editor
PRIMARY USER: Business owner
PRIMARY USER JOB: Create a package customers can buy and use
SOURCE FEATURE ROWS: Packages — credit rules, validity, lifecycle, customers
```

## PRIMARY ACTION

Save

## SECONDARY ACTIONS

Preview store, Copy link, Duplicate, Enable/Disable, Sell/assign package

## LOCAL NAV

Packages list back link

## PAGE SECTIONS IN ORDER

1. General — name, description, price, active
2. Included services & classes — credit rules with booking type picker
3. Validity — expiration days, starts on purchase
4. Usage rules — cancel/late cancel/no-show credit restore (plain language)
5. Customers — balances, adjust credits modal, credit history

## DRAWERS / MODALS

Adjust credits (add/remove, reason, note, preview balance)  
Sell/assign package (contact search, confirm)

## EMPTY STATE

N/A (create flow)

## LOADING / ERROR / SUCCESS

Skeleton; inline validation; draft preserved in sessionStorage; save busy state

## DEPENDENCIES

Packages API, types API (services/classes), contacts API, `adjustPackageCredits`, `getPackageLedgerHistory`

## CONTEXTUAL CREATE ACTIONS

[ Create service ] [ Create class ] when no booking types

## PUBLIC COUNTERPART

Store checkout for package slug

## RESPONSIVE

Single-column sections on mobile

## ACCESSIBILITY

Labels, modal focus trap, destructive confirm on forfeit settings

## BACKEND PRESENT

`upsertPackageProduct`, `creditRules`, `expirationDays`, `purchasePackageForContact`, `adjustPackageCredits`, ledger

## BACKEND GAPS

Lifecycle policy stored in `metadata.lifecyclePolicy` (extend upsert). Per-rule credit consumption at booking — runtime exists; UI explains only.

## BROWSER UAT

P1–P8 package lifecycle matrix

## OLD ROUTES

Commerce packages tab JSON create → this editor
