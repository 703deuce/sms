# New-app voice number switch (SaaS)

## Two layers (do not conflate)

| Layer | What it means |
|--------|----------------|
| **Carrier ingress** | One Telnyx `connection_id` per DID at a time (LiveKit FQDN, MCTB TeXML app, or Phone Call Control). |
| **Product bindings** | Transovo workspace policy: business hours, ring staff first, AI coverage, MCTB recovery — can reference the same DID. |

**Shared call handling (default):** Assigning a number to AI Receptionist uses `ingressStrategy: shared_voice`. LiveKit Voice V3 ingress is provisioned for the carrier path, but `workspaceCallRouting.policyJson` is **merged** (hours, ring strategy, overflow) — not wiped. Phone + Ava remain one integrated system.

**Exclusive ingress:** Use `ingressStrategy: exclusive` when the customer intentionally moves the DID to a single-product carrier path (e.g. MCTB-only TeXML).

## Switch sequence (implemented)

`POST /api/numbers/[id]/switch-product`

1. Read live Telnyx `connection_id` and logical bindings (`GET …/bindings`).
2. Require `confirmSwitch` when bindings conflict.
3. **Park** prior telephony + optional workspace policy snapshot under `settingsJson.telephonyPark.snapshots[]` (for switch-back).
4. **Prepare** destination (LiveKit trunk + dispatch before Telnyx move for Receptionist).
5. **Patch** Telnyx `connection_id`, **verify**, **rollback** to prior connection if verify fails.
6. **Commit** active telephony record (`state: active`, `lastVerifiedAt`) and product links.

Failed switches must not leave a DID on a new connection without verify; rollback attempts restore the previous `connection_id` when known.

## Production proof checklist

1. Pick a real Telnyx DID in staging/production.
2. `POST switch-product` with `targetProduct: receptionist`, `ingressStrategy: shared_voice`, `confirmSwitch: true`.
3. Confirm Telnyx number shows LiveKit FQDN connection; LiveKit trunk lists DID; dispatch rule targets `transovo-voice-v3`.
4. PSTN call → Voice V3 agent answers per published config.
5. Repeat switch to `mctb` or `phone` only with explicit confirm; confirm parked snapshot exists on the number row.
