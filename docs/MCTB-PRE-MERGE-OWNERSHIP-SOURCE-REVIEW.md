# MCTB pre-merge — `connection_id` ownership source review

**Branch:** `cursor/mctb-truthful-surface-audit-2304`  
**Purpose:** Human review appendix for PR #487 — confirms no second customer ownership switcher mutates Telnyx ingress outside `setActiveCallHandler`.

---

## Production callers of `setActiveCallHandler`

| Caller | When |
|--------|------|
| `PATCH /api/call-handling` | Customer **Call Handling** switcher (canonical) |
| `setInboundHandlingMode` in `src/lib/mctb/inbound-handling/switch-mode.ts` | Legacy `PATCH /api/mctb/inbound-handling`; wizard publish when `!hasExplicitCallHandlingSelection` |

No other product UI should PATCH inbound-handling for ownership after Voice Agent duplicate switcher removal.

---

## Inside `setActiveCallHandler` (ingress routing)

| Mode | Telnyx path |
|------|-------------|
| MCTB recovery | `routePhoneToMctbCallHandlingIngress` — patches `connection_id` on canonical voice ingress DID |
| After-hours / Voice Agent | `routePhoneToVoiceV3BasicCallControl` — patches `connection_id` for AI handler |

**Removed from ownership path:** direct `routePhoneToTexmlAssistant` / `routePhoneToTexmlApp` inside `setInboundHandlingMode`.

---

## Other `connection_id` writers (not a second switcher)

These still exist for setup, provisioning, and publish policy — they do **not** replace the customer Call Handling switcher:

- `provisionMctbPhoneTexmlIngressMode` → `routePhoneToTexmlApp` (setup / ingress provisioning)
- `switchDidToMctbTexmlIngress` (provisioning / repair)
- Voice agent publish with `getCallHandlingPublishPolicy` / `skipIngressRouting` when user already chose handler explicitly
- Number assignment, PBX/outbound, and other non–ownership flows

**After merge:** run live Call Handling matrix on deployed Telnyx (per PR #483) — cloud agents cannot certify PSTN.

---

## Explicit non-goals for merge PR #487

- Do not remove legacy `/api/mctb/inbound-handling` (compatibility delegate only).
- Do not implement sender mode, merge scope, or Voice V3 runtime changes.
- Leave `PaymentsEditor` dead code in place.
- Do not auto-merge; human clicks merge after reading `docs/MCTB-TRUTHFUL-SURFACE-AUDIT-REPORT.md`.

---

## Verification commands (all PASS on branch at audit time)

```bash
npx tsx scripts/test-call-handling-ownership.ts
npx tsx scripts/test-cross-surface-ownership-audit.ts
npx tsx scripts/test-mctb-simplified-launch.ts
npx tsx scripts/test-mctb-existing-customer-policy.ts
npx vitest run src/lib/voice/calls/customer-activity-feed.test.ts
```
