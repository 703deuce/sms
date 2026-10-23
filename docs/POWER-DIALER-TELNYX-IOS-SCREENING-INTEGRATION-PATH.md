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

### Phase 2 — Server PSTN origination (branch `cursor/ios-screening-dial-origination-9779`)

Implemented: **documented** `POST /v2/calls` with `premium_ios_call_screening_detection` when `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1` and screening + premium AMD are enabled (power/preview single-line only; parallel/predictive keep WebRTC). Agent audio via server-dialed WebRTC SIP leg; **no `bridge_on_answer`**; manual bridge after confirmed human via `maybeBridgePowerDialerAgentToProspect`. `iosScreeningWireActive` is set only after Telnyx returns a prospect `call_control_id` (dial accepted — not detection, not human acceptance).

**Non-negotiable constraints:**

1. **One PSTN leg per attempt** — disable browser `newCall` to the prospect when the server originates PSTN; never double-dial.
2. **No premature bridging** — treat answer ≠ human; defer agent bridge until post-screening AMD / policy allows (especially Apple screening assistant).
3. **Five dialing modes unchanged** — power, parallel, parallel_amd, predictive, preview/manual paths keep current behavior; screening-enabled workspaces opt into server origination without regressing standard dialing.

**Implementation sketch:**

- Reuse `dialPstnLeg` in `telnyx-call-control.ts` (`link_to`, `bridge_on_answer`) from inbound bridge patterns.
- Set `iosScreeningWireActive` + `iosScreeningWireStatus: wire_active_dial_origination` when dial body includes iOS screening mode.
- Enable via `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1` after implementation (flag exists; behavior pending).

### Phase 2 — Controlled live test

1. iPhone with Apple Call Screening on; workspace screening + premium AMD entitled.
2. Confirm webhook sequence per Telnyx AMD iOS docs.
3. Confirm attempt metadata, no confirmed human until post-screening `human_*`, no double PSTN legs in Telnyx debugger.

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
