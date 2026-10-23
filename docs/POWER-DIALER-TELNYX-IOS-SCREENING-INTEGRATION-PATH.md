# Power Dialer — Telnyx Apple iOS Call Screening integration path

**Status:** Architecture decision (2026-10-23)  
**Branch:** `cursor/intelligent-connections-9779`

## Question

Can Transovo activate Telnyx **Apple iOS Call Screening** (`call.machine.premium.call_screening.detected`) using the current **WebRTC `newCall` + post-answer `answering_machine_detection_start`** flow?

## Telnyx documentation (public)

### Where `premium_ios_call_screening_detection` is documented

1. **Voice API — Dial (`POST /v2/calls`)**  
   - Field: `answering_machine_detection`  
   - Enum includes: `premium_ios_call_screening_detection`  
   - Config: `answering_machine_detection_config.prompt_end_timeout_millis` (1_000–120_000 ms)  
   - Expected webhook when tone detected: `call.machine.premium.call_screening.detected` with `result=screening`  
   - Sources: [Answering Machine Detection](https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection), [Dial API](https://developers.telnyx.com/api-reference/call-commands/dial)

2. **Voice API — Transfer call**  
   - Same `answering_machine_detection` enum on transfer; expected webhooks include `call.machine.premium.call_screening.detected` when `premium_ios_call_screening_detection` was requested.  
   - Source: [Transfer call](https://developers.telnyx.com/api-reference/call-commands/transfer-call)

3. **TeXML Dial verb**  
   - `machineDetection="Enable"` + `detectionMode="PremiumCallScreening"` (TeXML naming; parallel product concept to iOS screening)  
   - Source: [TeXML Dial](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/dial)

4. **AMD guide wording**  
   - “The `answering_machine_detection` value when **creating an outbound call or transferring an inbound call**…” — lists `premium_ios_call_screening_detection`.  
   - Does **not** list post-answer AMD-start as an activation point for iOS screening.

### Where post-answer AMD-start is documented

- Transovo uses `POST /calls/{call_control_id}/actions/answering_machine_detection_start` with `detection_mode: "Premium"` (undocumented in the public OpenAPI snapshot we inspected; operation exists in Call Control product).
- **No public Telnyx doc** was found that maps `detection_mode: PremiumCallScreening` or `premium_ios_call_screening_detection` to **`answering_machine_detection_start`**.
- Mapping **TeXML `PremiumCallScreening`** → **Call Control AMD-start `detection_mode`** was an implementation assumption — **not documentation-backed**.

### Screening webhook prerequisite

Telnyx states `call.machine.premium.call_screening.detected` is sent when  
`answering_machine_detection=premium_ios_call_screening_detection` (dial/transfer), not when generic Premium AMD-start alone is used.

Source: [Call machine premium call screening detected](https://developers.telnyx.com/api-reference/callbacks/call-machine-premium-call-screening-detected)

## Conclusion

| Path | iOS screening documented? | Transovo today |
|------|---------------------------|----------------|
| `POST /v2/calls` with `premium_ios_call_screening_detection` | **Yes** | Not used for Power Dialer outbound (WebRTC originates callee leg) |
| Transfer with `premium_ios_call_screening_detection` | **Yes** | Not used |
| Post-answer `answering_machine_detection_start` + `PremiumCallScreening` | **Not documented** | Was implemented — **removed as activation claim** |
| Post-answer AMD-start + `Premium` only | Premium human/machine only | **Supported path** for machine filter + premium classification |

**Apple iOS Call Screening is not production-ready on the WebRTC-only outbound path** until Telnyx confirms AMD-start support or we move PSTN origination to `POST /v2/calls`.

## Smallest viable change (recommended phases)

### Phase 1 — Ship now (this branch, policy update)

- Keep **Premium AMD** on AMD-start for machine filtering, premium classification, screening **policy** execution when a screener event is ever received.
- **Do not** send `PremiumCallScreening` on AMD-start or label attempts as iOS-active without provider events.
- Persist `iosScreeningRequested` vs `iosScreeningWireActive` on attempts so UI/analytics do not over-promise.
- **Merge-ready for:** parallel machine filter, premium AMD, screening runtime, CRM/history — **not** for Apple screening SLA.

### Phase 2 — Controlled live test (Telnyx + product)

1. Ask Telnyx support: does `answering_machine_detection_start` support iOS screening on legs created by WebRTC Credential Connection?
2. If **yes**: document exact `detection_mode` / body; enable wire-active flag; one iPhone screening smoke.
3. If **no**: implement **server PSTN origination** for screening-enabled workspaces only:
   - Reuse `dialPstnLeg` in `telnyx-call-control.ts` (`link_to`, `bridge_on_answer`) pattern from inbound bridge.
   - `POST /v2/calls` with `answering_machine_detection: "premium_ios_call_screening_detection"` + shared `client_state` / attempt correlation.
   - Agent audio via existing WebRTC leg (avoid double-dialing callee — likely **replace** browser `newCall` to PSTN with server-originated PSTN + WebRTC agent leg, similar to inbound-webrtc-bridge inverted).

### Phase 3 — Optional product fallback

- If Phase 2 is deferred: keep Call Screening settings for intro/policy but show admin copy “Apple screening detection requires Telnyx dial-origination (scheduled).”

## Live test checklist (when Phase 2 enabled)

1. Workspace: `callScreeningEnabled`, `premiumAmdEnabled`, screener intro configured.  
2. Dial iPhone with Apple Call Screening on.  
3. Confirm webhooks in order (per Telnyx AMD iOS section):  
   `call.machine.premium.detection.ended` (initial) → `prompt_ended` or `call.machine.premium.call_screening.detected` → post-screening `call.machine.premium.detection.ended`.  
4. Confirm Transovo attempt: `answerClassification` transitions, `iosScreeningWireActive`, no confirmed human until post-screening `human_*`.

## Account dependencies

- Premium AMD enabled on Telnyx account (billable).  
- iOS screening feature availability (confirm with Telnyx — may be account/region gated).  
- Call Control connection id (`TELNYX_CALL_CONTROL_APP_ID` / connection used for PD).
