# Appointments Batch 8F-1 — Commerce Admin Depth Summary

**Generated:** 2026-09-10  
**Branch:** `cursor/batch8f1-commerce-admin-depth-709b`

## Start state (post-8D)

| Metric | Count |
|--------|------:|
| V1_ADMIN_UI_GAP | 17 |
| V1_CONTEXTUAL_FLOW_GAP | 1 |
| Commerce-unique on `/appointments/commerce` | **12** |
| Temp routes with unique V1 (all four) | **4** routes / **15** functions total |
| 8F-1 assigned rows | 13 (excluding mis-grouped 7-1) |

### 12 vs 15 discrepancy (mechanical)

- **12** = `TEMP_ROUTE_CLASSIFICATION["/appointments/commerce"].unique` — functions whose only remaining commerce-hub UI was on `/appointments/commerce`.
- **15** = sum of unique counts on all four `STILL_HAS_UNIQUE_V1` temp routes: commerce (12) + policies (1) + reports/service-booking (1) + routing (1).

### 8F-1 feature IDs (implemented)

`8-1`, `8-3`, `8-5`, `8-6`, `8-7`, `8-11`, `8-12`, `8-13`, `8-14`, `8-16`, `8-18`, `8-33`

### Mis-grouped row corrected

| ID | Was in 8F-1 queue | Correct batch | Reason |
|----|-------------------|---------------|--------|
| **7-1** Manage appointment link | 8F-1 | **8F-2** | Appointment detail / manage-link — not commerce |

## Commerce absorption

| Commerce section | Feature IDs | Canonical destination | Status |
|------------------|-------------|----------------------|--------|
| Packages | 8-1, 8-3, 8-5, 8-6, 8-7 | `/appointments/packages` | Absorbed |
| Memberships | 8-11, 8-12, 8-13, 8-14 | `/appointments/memberships` | Absorbed |
| Gift cards | 8-16 | `/appointments/gift-cards` | Absorbed |
| Coupons | 8-18 | `/appointments/discounts` | Absorbed |
| Policy fees | 8-33 | Booking type → Policies (`TypeAdvancedSections`) | Absorbed |
| POS mixed cart | (runtime) | `/appointments/pos` | Extended (coupon + gift tender) |

**Commerce unique V1 after:** 0 (route retained; not retired per batch rules)

## Implementation highlights

- **PackagesAdminClient** — list, editor, mixed-content credit rules, lifecycle/forfeiture policy, purchases, sell-to-customer
- **MembershipsAdminClient** — billing, recurring credits, member-only types, members list, failed-payment admin actions
- **GiftCardsAdminClient** — issue, masked lookup, issued balances, redemption note
- **DiscountsAdminClient** — full coupon editor on `/appointments/discounts`
- **POS** — coupon preview/apply, gift code at checkout, coupon catalog lines
- **Runtime** — `resolvePackageLifecyclePolicyForAppointment` reads per-package policy from metadata

## Verification

```bash
npx tsx scripts/test-batch8f1-commerce-admin.ts
RECONCILE_BATCH=8E node scripts/reconcile-appointments-batch8c.mjs
```

**Route retirement:** NOT performed (8G-1).
