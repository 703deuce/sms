# DEV_AUTH_BYPASS_2 — fresh MCTB customer certification lane

## Purpose

`DEV_AUTH_BYPASS_2` authenticates browser automation as a **separate** certification user so we can run the **fresh-customer MCTB onboarding** test without disabling `DEV_AUTH_BYPASS=1` or touching `ws_1`.

**Normal Google login:** `DEV_AUTH_BYPASS=1` alone no longer auto-logs everyone into `ws_1`. Only `DEV_AUTH_BYPASS_AUTO=1` (cert automation) skips the login UI and injects the bypass user without a session cookie. Human testing: use `/login` or `GET /api/auth/dev-bypass-2` for the fresh-customer lane.

## What bypass 2 does

| Allowed | Not allowed |
|---------|-------------|
| Skip login / OTP | MCTB bootstrap before browser |
| Create **user** row if missing | Ingress provisioning |
| Issue session cookie | Onboarding field writes |
| Redirect to `/api/products/open?product=voice` | ws_1 membership |

## Environment

```env
DEV_AUTH_BYPASS=1                    # unchanged — ws_1 cert
DEV_AUTH_BYPASS_EMAIL=...            # unchanged

DEV_AUTH_BYPASS_2=1
DEV_AUTH_BYPASS_2_EMAIL=mctb-fresh-cert@transovo.test
# optional — default is MCTB_PROD_CERT_WORKSPACE_ID or ws_1
# DEV_AUTH_BYPASS_2_FORBIDDEN_WORKSPACE_IDS=ws_1
```

## Endpoint

```
GET /api/auth/dev-bypass-2?next=/api/products/open?product=voice&next=/mctb
```

Optional `email=` override (must differ from `DEV_AUTH_BYPASS_EMAIL`).

Response header `x-transovo-bypass-2-scaffold` documents auth-only scaffolding (user created?, session-only?, memberships).

## Code touchpoints

- `src/lib/auth/dev-auth-bypass.ts` — flags + forbidden workspace list
- `src/app/api/auth/dev-bypass-2/route.ts` — session establishment
- `src/lib/auth.ts` — `getActiveWorkspaceId()` prefers real session cookie over bypass-1 auto-workspace

## Harness

`npm run test:mctb-fresh-customer-onboarding` (see `docs/MCTB-FRESH-CUSTOMER-PRODUCTION-ONBOARDING.md`)

## Regression

`npx tsx scripts/test-dev-auth-bypass-2.ts`
