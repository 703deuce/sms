# Power Dialer — Zapier-compatible API (M82)

Authentication: **Bearer** Power Dialer API key with scopes `webhooks:manage`, `contacts:read`, `contacts:write`, etc.

## REST hooks (instant triggers)

- **Subscribe:** `POST /api/v1/zapier/hooks` — body `{ "hookUrl": "https://hooks.zapier.com/...", "event": "disposition.saved" }`
- **Unsubscribe:** `DELETE /api/v1/zapier/hooks?id={endpointId}`

Events use the same catalog as customer webhooks (`call.ended`, `disposition.saved`, …). Payloads are HMAC-signed (`X-Transovo-Signature`, `X-Transovo-Timestamp`).

## Polling triggers

- `GET /api/v1/zapier/polling/contacts` — recent contacts (real workspace data)
- `GET /api/v1/zapier/polling/dispositions` — recent disposition saves

## Actions

- `POST /api/v1/zapier/actions/contacts` — create contact (`phone` required)

Official Zapier app store submission is out of scope; these endpoints match Zapier’s REST hook + polling patterns.
