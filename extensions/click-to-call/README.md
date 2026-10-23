# Transovo Power Dialer — Click-to-Call extension (M83)

Manifest V3 browser extension (not published to Chrome Web Store or Firefox Add-ons).

## Build / package

```bash
./extensions/click-to-call/scripts/package-extension.sh
```

Produces `dist/transovo-click-to-call.zip` for manual load in Chrome (Extensions → Developer mode → Load unpacked) or sideload.

## Configure

1. Create a Power Dialer API key with `dial:write` (and `contacts:read` if using contact IDs).
2. Open the extension popup and set API base URL, key, and your **active** `sessionId`.
3. Optionally set `contactId` for numbers already in Transovo; phone-only clicks require an existing contact.

## API

Uses `POST /api/v1/power-dialer/click-to-call` with Bearer auth.

## Tests

```bash
node extensions/click-to-call/scripts/test-phone-detect.mjs
```
