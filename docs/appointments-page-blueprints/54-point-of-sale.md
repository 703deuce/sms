# Blueprint 54 — Point of Sale (`/appointments/pos`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-5 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 8-23 | POS cart session | Cart | `pos-cart.ts` | ALREADY_PRESENT |
| 8-24 | Mixed checkout | Catalog + cart | `pos-cart.ts` + fulfill hooks | ABSORBED_CANONICAL_UI |
| 8-21 | Account credit at checkout | Payment summary | `client-wallet.ts` | ABSORBED_CANONICAL_UI |
| — | Coupon / discount picker | Promo code | `coupons.ts` | ABSORBED_CANONICAL_UI |
| — | Tax display | Cart summary | — | BACKEND_GAP |
| — | Recent sales | POS history | `listRecentPosSessions` | ABSORBED_CANONICAL_UI |

## AUDIT CORRECTIONS (NOT IN POS)

| Feature ID | Correct destination |
|---|---|
| 2-30 | Appointments operations / Booking Type policies |
| 2-36 | Appointment Detail / Analytics |
| 4-11 | Runtime — Booking Type rooms |
| 2-5, 2-6, 2-41 | Booking Types / Forms |
