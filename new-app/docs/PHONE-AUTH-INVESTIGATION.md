# Phone API authentication — investigation (new-app)

## What the first audit implied

The phrase “dev auth bypass on production smoke paths” was **misleading**. The smoke scripts did not use `DEV_AUTH_BYPASS` or a special test header. They issued ordinary `fetch()` calls to `https://transovo.ai/api/phone/*` with **no session cookie and no API key**.

## What production did

| Check | Result (pre-fix deploy) |
|-------|-------------------------|
| `GET /api/phone/settings` with `Sec-Fetch-Site: cross-site` | **HTTP 200** + workspace settings JSON |
| `PATCH /api/phone/settings` with same headers | **HTTP 200** |

## Root cause

1. **`resolveWorkspaceId()`** (`lib/server/workspace.ts`) — when `DEV_WORKSPACE_ID` / `TRANSOVO_WORKSPACE_ID` are unset, returns the **first workspace row** in the database (or creates one). There is no user/session binding on Phone APIs yet.

2. **`assertDevApiAccess()`** — only ran on some **mutations**; many **GET** handlers had no guard. When `TRANSOVO_DEV_API_KEY` was unset, mutations from non-browser clients were also allowed.

3. **Legacy `DEV_AUTH_BYPASS`** lives under `src/lib/auth/` for the **old** app shell — not the mechanism used by these smoke tests.

## Fix (this branch)

- `assertPhoneApiAccess()` — in **production**, deny requests that are not same-site browser and do not send `x-transovo-dev-key` when configured.
- `middleware.ts` — applies to all `/api/phone/*` (Telnyx webhooks remain on `/api/telnyx/*` with signature verification).

## Regression

```bash
cd new-app && npm run test:phone:auth-regression
```

Expect **401** on production **after** deploy. Until deploy, the test **fails intentionally** to document the open API.

## Operational note

Automated cert against production should use **`x-transovo-dev-key`** (when `TRANSOVO_DEV_API_KEY` is set) or run against **localhost** with an isolated `PHONE_CERT_DATABASE_URL` — not unauthenticated production.
