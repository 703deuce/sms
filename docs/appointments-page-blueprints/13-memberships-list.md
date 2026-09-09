# Page Blueprint — Memberships List

**Status:** FINAL — Batch 4  
**Route:** `/appointments/memberships`

```
PAGE: Memberships
ROUTE: /appointments/memberships
CLASSIFICATION: SPLIT — focused list
PRIMARY USER: Business owner
PRIMARY USER JOB: Show me the memberships I offer
SOURCE FEATURE ROWS: Memberships / subscriptions
```

## PRIMARY ACTION

Create membership → `/appointments/memberships/new`

## SECONDARY ACTIONS

Row: Edit, View members, Sell/subscribe, Duplicate, Enable/Disable

## LOCAL NAV

Products & Offers hub back link

## PAGE SECTIONS IN ORDER

1. Back link
2. Header — H1 Memberships + copy
3. Create membership (primary)
4. Table or empty state

## TABLE/LIST FIELDS

| Column | Source |
|--------|--------|
| Name | `name` |
| Price | `priceCents` |
| Billing | `billingInterval` |
| Benefits summary | `benefits` derived |
| Members | active subscription count |
| Status | `active` |

## EMPTY STATE

*Create recurring memberships* + CTA

## LOADING / ERROR / SUCCESS

Standard Transovo patterns

## DEPENDENCIES

`GET /api/appointments/service-booking/memberships`

## PUBLIC COUNTERPART

Store membership purchase if enabled

## BACKEND PRESENT

`listMembershipProducts`, `upsertMembershipProduct`, `startMembershipSubscription`

## BACKEND GAPS

Stripe live subscribe UAT may be PROVIDER_BLOCKED

## BROWSER UAT

M1 create membership in list

## OLD ROUTES

`/appointments/commerce` memberships tab
