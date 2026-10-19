# Transovo Phone — Telnyx inbound audit (official API vs implementation)

**Date:** 2026-03-23  
**Scope:** `new-app` PSTN → browser WebRTC inbound. Outbound softphone preserved.  
**Companion:** `docs/NEW-APP-INBOUND-WEBRTC-CALL-FLOW.md`

## 1. Documented Telnyx model (summary)

Two **Call Control** legs:

1. **Caller leg** — PSTN inbound on Call Control app (`TELNYX_CONNECTION_ID`).
2. **Browser leg** — Created by `POST /v2/calls` with same Call Control `connection_id`, `to` = `sip:<webrtc_sip_username>@sip.telnyx.com;secure=srtp`.

Three **distinct** answer/bridge steps:

| Step | Actor | API / SDK |
|------|--------|-----------|
| Ring browser (PSTN still ringing) | Backend | `POST /v2/calls` with `link_to` = caller leg, `bridge_on_answer: true` — **no early answer on PSTN** |
| Ring + answer browser | Browser | `telnyx.notification` → `call.answer()` |
| Connect media | Telnyx | `bridge_on_answer` bridges caller ↔ agent; fallback manual `bridge` in `completeWebRtcAgentLegAnswer` |

Bridge when the browser leg is answered, not when Dial returns 200.

Official refs: [Dial](https://developers.telnyx.com/api-reference/call-commands/dial), [Bridge](https://developers.telnyx.com/api-reference/call-commands/bridge-calls), [WebRTC quickstart](https://developers.telnyx.com/development/webrtc/js-sdk/quickstart/index), [SIP URI calling](https://support.telnyx.com/en/articles/2925713-sip-uri-calling).

## 2. Transovo implementation map

| Step | File / symbol |
|------|----------------|
| Webhook ingress | `new-app/app/api/telnyx/phone/route.ts` |
| Auth + dedup | `new-app/lib/server/telnyx/webhook-auth.ts`, `telnyxWebhookDedup` |
| Inbound route | `inbound-runtime.ts` → `processInboundCallInitiated` |
| Answer + Dial browser | `inbound-webrtc-bridge.ts` → `bridgeInboundCallToWebRtc` |
| Webhook correlation | `calls-service.ts` → `processHumanCallWebhookEvent` |
| Bridge on agent answer | `completeWebRtcAgentLegAnswer` |
| WebRTC token | `webrtc-token.ts`, `GET /api/phone/webrtc-token` |
| Client | `workspace-provider.tsx` (`TelnyxRTC`, notifications, Answer) |
| Incoming UI | `active-call-bar.tsx` → `IncomingCallBar` |
| Session metadata | `inbound-session.ts` (`inboundBridgeStatus`, leg IDs) |

## 3. Requirement checklist (A–I)

### A. Architecture trace

| Item | Status | Notes |
|------|--------|-------|
| `call.initiated` → handler | **OK** | Only `direction === incoming` creates `HumanCall` |
| Ring browser path | **OK** | `ring_browser` + `PHONE_INBOUND_BRIDGE_WEBRTC` |
| End-to-end design | **OK** | Matches Telnyx CC + WebRTC contact-center pattern |

### B. Telnyx configuration

| Item | Status | Notes |
|------|--------|-------|
| DID on Call Control app | **Verify live** | `scripts/audit-new-app-phone-voice-provisioning.mjs` |
| Dial `connection_id` = Call Control app | **Fixed #702** | Was credential connection → 422 |
| Credential connection separate | **OK** | Logged as `webrtcCredentialConnectionId` |
| SIP username matches browser | **Verify live** | From `TELNYX_TELEPHONY_CREDENTIAL_ID` |
| SIP URI routing to WebRTC | **Verify live** | `verify-new-app-inbound-dial-params.mjs` loads credential connection inbound settings when API key present |
| Webhook URL | **Verify live** | Audit script prints `webhook_event_url` |

### C. PSTN inbound events

| Item | Status | Notes |
|------|--------|-------|
| Parse + auth webhooks | **OK** | Ed25519 `TELNYX_PUBLIC_KEY` |
| Dedup | **OK** | `telnyxWebhookDedup` |
| Caller `call_control_id` stored | **OK** | `HumanCall.telnyxCallControlId`, `callerCallControlId` metadata |
| Fast ACK | **OK** | Handler returns JSON after processing; heavy work is Telnyx API calls (inherent) |

### D. Dial browser

| Item | Status | Notes |
|------|--------|-------|
| `POST /v2/calls` | **OK** | `inbound-webrtc-bridge.ts` |
| Correct `connection_id` | **Fixed #702** | |
| `from` = business line | **OK** | Must be permitted on connection — verify in portal |
| `to` = SIP URI + SRTP | **OK** | `buildWebRtcAgentSipUri` |
| Capture agent `call_control_id` | **OK** | `telnyxCallLegId` + metadata |
| Dial failure cleanup | **Fixed** | PSTN `hangup` on bridge_failed |

### E. WebRTC registration

| Item | Status | Notes |
|------|--------|-------|
| Single client boot | **OK** | `WorkspaceProvider` useEffect |
| Listeners before connect | **OK** | |
| `telnyx.ready` | **OK** | Sets `webrtcStatus: ready` + presence heartbeat |
| Token ≠ registered | **Fixed** | Removed `markWebRtcRegistered` on token mint |
| Presence for routing | **OK** | Not used to block inbound (removed gate earlier) |

### F. Incoming ring + Answer

| Item | Status | Notes |
|------|--------|-------|
| `callUpdate` + `ringing` | **OK** | Also accepts `new` |
| Preserve Call object | **OK** | `incomingCall.webrtcCall` ref; UI shown immediately |
| Answer on same object | **OK** | `answerIncoming` |
| Remote audio | **OK** | `remoteElement` on client + `answer({ remoteElement })` |
| Ringtone | **Gap** | Browser bar only; no explicit ringtone file (SDK can use `ringtoneFile`) — optional |

### G. Bridging

| Item | Status | Notes |
|------|--------|-------|
| Separate leg IDs | **OK** | metadata `callerCallControlId` / `browserCallControlId` |
| Bridge after browser answers | **OK** | On agent leg `call.answered` + `webrtc_agent_leg` client_state |
| No bridge on Dial 200 alone | **OK** | |
| Duplicate bridge guard | **Fixed** | Skip if `inboundBridge === bridged` |
| Recording timing | **Fixed** | Defer `registerInboundAnswer` recording until bridged path uses `call.bridged` handler |

### H. Logging / timeline

| Event | Log kind |
|-------|----------|
| PSTN webhook | `telnyx-webhook` / `inbound_initiated` |
| Dial | `inbound-webrtc-bridge` / `dialed_agent_leg` or `bridge_failed` + `telnyxBody` |
| Browser ring | `phone` client `inbound_ringing_ui` |
| Bridge | `agent_leg_answered_bridge` |
| DB audit | `HumanCallEvent` rows per webhook |

### I. Outcome

| Deliverable | Status |
|-------------|--------|
| Documented vs actual | This file |
| Defect fixes | PR #702 + commits on same branch |
| Outbound preserved | No change to `newCall()` outbound path |
| Automated checks | `node scripts/test-new-app-inbound-telnyx-contract.mjs` |
| Real PSTN proof | **Required** — not possible in cloud agent VM |

## 4. Confirmed historical defects (fixed on branch)

1. **Dial `connection_id`** — credential connection instead of Call Control app (422).
2. **Token mint counted as registered** — presence now `telnyx.ready` + heartbeat only.
3. **PSTN silence on dial failure** — hangup caller on `bridge_failed`.
4. **Duplicate bridge** — idempotent `completeWebRtcAgentLegAnswer`.
5. **Incoming UI delayed** — show ring UI before `fetchCalls` correlation.
6. **Redundant PSTN answer on UI answer** — removed from `registerInboundAnswer`.

## 5. Still requires live PSTN test (cannot declare success without)

1. Deploy PR #702+ to production.
2. Phone tab **Connected** (`telnyx.ready`).
3. Call **+1 (866) 346-4256**.
4. Confirm: `dialed_agent_leg` → browser incoming bar → Answer → `bridged` → two-way audio.

If step 3 works but no browser ring: investigate **SIP URI routing** on credential connection (Telnyx portal / support article 2925713).

## 6. Automated verification (no deploy)

```bash
node scripts/test-new-app-inbound-telnyx-contract.mjs
TELNYX_API_KEY=... TELNYX_CONNECTION_ID=... TELNYX_TELEPHONY_CREDENTIAL_ID=... \
  node scripts/verify-new-app-inbound-dial-params.mjs
TELNYX_API_KEY=... TELNYX_CONNECTION_ID=... TELNYX_TELEPHONY_CREDENTIAL_ID=... \
  node scripts/audit-new-app-phone-voice-provisioning.mjs
cd new-app && npm run typecheck
```
