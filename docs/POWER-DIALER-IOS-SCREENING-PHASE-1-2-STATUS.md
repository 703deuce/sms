# Power Dialer — Apple iOS Screening: Phase 1 & Phase 2 Status

Copy-friendly summary for merge planning and live test.

---

## Phase 1 — ready to merge (unchanged)

| Item | Value |
|------|--------|
| **Branch** | `cursor/intelligent-connections-9779` |
| **PR** | [#744](https://github.com/703deuce/sms/pull/744) |
| **Tip commit** | `7817396db` |

**Ship when ready:** Premium AMD, parallel machine filter, screening policy/CRM/analytics, honest Apple UI (no false “detection active” on WebRTC-only).

**Not claimed:** Apple iOS screening detection on browser-originated PSTN (awaits Phase 2 or live dial-origination).

---

## Phase 2 — implemented (separate branch)

| Item | Value |
|------|--------|
| **Branch** | `cursor/ios-screening-dial-origination-9779` |
| **PR** | [#745](https://github.com/703deuce/sms/pull/745) |
| **Implementation commit** | `4358dbde1` |

### What was built

| Requirement | Implementation |
|-------------|----------------|
| Telnyx `POST /v2/calls` + `premium_ios_call_screening_detection` | `new-app/lib/server/phone/power-dialer/power-dialer-server-pstn-dial.ts` — prospect leg, `bridge_on_answer: false` |
| No browser + server double-dial | WebRTC `newCall` to prospect **skipped** when `mode === 'server_pstn_ios'`; server dials prospect + agent SIP |
| No premature bridge | No `bridge_on_answer`; `maybeBridgePowerDialerAgentToProspect` in `power-dialer-leg-bridge.ts` only after **confirmed human** and not while `screeningPending` |
| Five dial modes | **All modes** → server iOS PSTN origination when flag + screening + Premium AMD; parallel/predictive share one agent WebRTC leg per session |
| Reuse webhooks / screening FSM | Existing AMD + screening handlers; bridge hooked from `amd-webhook-handler` |
| `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION` | Wired via `ios-origination-policy.ts` |
| **`iosScreeningWireActive`** | Set **only** when Telnyx returns prospect `call_control_id` (dial accepted) |
| **`iosScreeningDetected`** | Provider screener (`screeningPending` / `screener`) with wire active — not dial accept, not human |
| UI | “Detection armed” vs “screener detected” copy; settings note about env flag |

### Three events (distinct)

1. **Wire active** — `iosScreeningWireActive` + `iosScreeningDialAcceptedAt` after successful Dial API  
2. **Screener detected** — `iosScreeningDetected` / screening webhooks  
3. **Human to rep** — bridge + `human_connected` / confirmed-human AMD (not screening assistant)

### Enable Phase 2 in an environment

```bash
POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1
```

Plus workspace: call screening enabled + premium AMD entitlement. Single-line **power** or **preview** campaigns only (multi-line modes keep WebRTC).

### Focused tests (all passed in implementation VM)

```bash
cd new-app && npx tsx scripts/test-power-dialer-ios-screening-dial.ts
npx tsx scripts/test-power-dialer-intelligent-connections.ts
npx tsx scripts/test-power-dialer-b1.ts
npx tsx scripts/test-power-dialer-batch8.ts
npx tsx scripts/test-power-dialer-phase5.ts
```

### Remaining before production Apple SLA

**Controlled live Telnyx test** on staging with `POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION=1`, iPhone with Apple Call Screening, and Telnyx account premium/iOS AMD enabled. Cloud agent did not place real PSTN calls.

### Suggested merge order

1. Merge **Phase 1** (#744) → deploy  
2. Enable flag on staging → live smoke  
3. Merge **Phase 2** (#745) after smoke or in parallel after Phase 1 is on master  

### Out of scope (both phases)

Number Reputation, Branded Calling, new pricing plans.

### Related docs

- `docs/POWER-DIALER-TELNYX-IOS-SCREENING-INTEGRATION-PATH.md` — Telnyx evidence + architecture  
- `docs/POWER-DIALER-INTELLIGENT-CONNECTIONS-COMPLETION-REPORT.md` — Phase 1 completion report  

---

*Last updated: 2026-10-23 (Phase 2 commit `4358dbde1`).*
