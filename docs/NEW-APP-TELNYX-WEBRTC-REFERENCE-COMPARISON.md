# New-app inbound WebRTC vs Telnyx reference apps

Source references (cloned for audit):

- [webrtc-demo-js](https://github.com/team-telnyx/webrtc-demo-js) — browser Answer / notifications
- [telnyx-demo-contact-center](https://github.com/team-telnyx/telnyx-demo-contact-center) — PSTN webhook → SIP dial → bridge

## Browser (incoming Answer)

| Concern | Telnyx `webrtc-demo-js` | Transovo `new-app` (after alignment) |
|--------|-------------------------|--------------------------------------|
| Client lifetime | Single `TelnyxRTC` via Jotai atom; reconnect only when credentials change | `ensureTelnyxWebRtcClient()` — one client per tab; React remount does not create a second socket |
| Notifications | `CallNotificationHandler.tsx` — always `TelnyxRTC.telnyxStateCall(notification.call)` before UI | Same in `workspace-provider.tsx` notification handler |
| Answer target | `IncomingCall.tsx` — `call.answer(callOptions)` on the **live** `Call` from the latest notification | `inboundSdkCallRef` + `client.calls[id]` fallback; `await call.answer({ remoteElement })` |
| Remote audio | Demo relies on SDK defaults; we pass `remoteElement` on client + per-answer | Shared element for outbound; inbound answer passes `remoteElement` |
| Duplicate answer | SDK emits `telnyx.warning` code **33007** `DUPLICATE_INBOUND_ANSWER` when multiple clients or duplicate answer | `telnyx.warning` logged + traced; Answer disabled while `answer()` in flight |
| Server correlation | N/A (demo only) | `POST /api/phone/webrtc/trace` + `phoneClientLog` |

## Server (PSTN → agent SIP → bridge)

| Step | Telnyx contact center (conceptual) | Transovo |
|------|-----------------------------------|----------|
| Inbound PSTN | Webhook on Call Control app | `POST /api/telnyx/phone` |
| Ring browser | `POST /v2/calls` to agent SIP / WebRTC credential | `inbound-webrtc-bridge.ts` — `connection_id` = **Call Control** id, `link_to`, `bridge_on_answer` |
| Bridge | Bridge API when agent answers | `call.answered` webhook → `completeWebRtcAgentLegAnswer` / bridge helpers in `calls-service.ts` |
| UI “Answer” | N/A | `registerInboundAnswer` = **UI only** when `inboundBridge=dial_agent`; bridge waits for Telnyx `call.answered` |

## Gaps that explained “rings but never answered” (production)

1. **Second `TelnyxRTC` on remount** — duplicate registration; SDK ignores `answer()` (33007).
2. **Stale `Call` handle in React state** — demo always answers the call object refreshed via `telnyxStateCall`.
3. **No `telnyx.warning` handling** — duplicate answer looked like “Connecting…” with no server `call.answered`.

## Live A/B test (operator)

1. Disconnect Transovo softphone (close tab or log out).
2. Open [Telnyx WebRTC demo](https://webrtc.telnyx.com/) with the **same** credential JWT.
3. Place inbound call to the business number.

If the demo answers and bridges but Transovo does not, the defect is in our browser integration (this document), not Telnyx routing or the Call Control app.
