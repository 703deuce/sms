# Transovo Power Dialer — Telnyx & Intelligent Connections Audit (Read-Only)

**Production reference:** `master` @ `7296e2068`  
**Method:** Code trace only (no builds, deploys, DB, or live calls).  
**Telnyx docs cross-check:** Premium AMD outcomes (`human_residence`, `human_business`, `machine`, `silence`, `fax_detected`, `not_sure`); iOS screening requires `premium_ios_call_screening_detection` and webhooks including `call.machine.premium.call_screening.detected` (per Telnyx Voice API AMD docs). **Inbound Call Screening** on Telnyx is a separate inbound-protection product — not outbound Apple screening detection.

---

## A. Executive summary

Transovo’s Power Dialer has a **real Telnyx Call Control + WebRTC** outbound path, **Premium AMD started server-side** after the PSTN leg is linked, and **webhook handling** for `call.machine.premium.detection.ended` and standard `call.machine.detection.ended`. That supports **voicemail vs human (residence/business) vs uncertain** classification for analytics, parallel “first human wins,” and optional beep-based voicemail drop.

What it **does not** have is a **complete intelligent-screening product**:

- **No** `premium_ios_call_screening_detection` on origination or AMD start.
- **No** handlers for `call.machine.premium.call_screening.detected`, `call.machine.premium.greeting.ended`, or `prompt_ended` / `beep_detected` on the premium greeting path.
- **“Screener”** in app logic is mostly a **string heuristic** (`result` contains `"screen"`) — not Telnyx’s documented `result=screening` webhook.
- **Screening settings** (`screening-runtime.ts`) compute actions but **only persist `screening_decision` events**; they do **not** hang up, wait for accept/reject, or block bridging.
- **Parallel + machine filtering** stores `amdFilter` on attempts but **no server code reads it** to suppress bridging on machines.
- **Number Health** is **internal call metrics + heuristics**; **Telnyx Number Reputation is not integrated** (UI/probe only).
- **Branded Calling / verified identity** is **not implemented**; STIR/SHAKEN is display-only from `capabilitiesJson` when present.

**Bottom line:** You have **solid progressive/parallel/predictive dialing, AMD-based voicemail handling, and internal number health** — but **not** reliable **Apple/Google AI screening** or **carrier reputation** as sellable “intelligent connections” without substantial Telnyx integration work.

---

## B. Feature inventory (selected — full scope of request)

| Feature | Status | Implementation | Provider / API | Customer UI | To complete (if Partial/Missing) |
|--------|--------|----------------|----------------|-------------|----------------------------------|
| **Standard AMD webhooks** | **Complete** | `processHumanCallWebhookEvent` → `applyAmdToPowerDialerAttempt` — `new-app/lib/server/phone/calls-service.ts` | Telnyx `call.machine.detection.ended` | Analytics AMD buckets | — |
| **Premium AMD start** | **Partial** | `startPowerDialerAmdOnCallControlLeg` sets `detection_mode: "Premium"` on `/actions/answering_machine_detection_start` — `power-dialer-amd.ts`; invoked from `linkHumanCallToTelnyxControl` for `source === "power_dialer"` — `calls-service.ts` (~531–542) | Telnyx Call Control AMD start | Settings → Dialing (entitlement toggle); not gated on start | Gate Premium start on entitlement/billing; handle premium `greeting.ended` |
| **Premium AMD webhooks** | **Partial** | Same handler for `call.machine.premium.detection.ended` — `calls-service.ts` (~779–796) | Telnyx | Analytics “Screening” / AMD stats | Map all documented premium results; store raw + pass-through |
| **iOS Call Screening (Telnyx)** | **Missing** | No `premium_ios_call_screening_detection`; no `call.machine.premium.call_screening.detected` handler (repo-wide grep) | Telnyx documented mode + webhooks | Settings “experimental” copy only | Origination/AMD mode + webhook handlers + rep prompt/TTS flow |
| **Google Pixel / Call Screen** | **Missing** | No references | **Unverified** if Telnyx exposes distinct class | — | Provider capability research + integration |
| **Map `human_residence` / `human_business`** | **Complete** | `mapTelnyxAmdResult` — `answer-detection.ts` | Telnyx Premium AMD | Analytics | — |
| **Map `machine` / beep / silence / fax** | **Complete** | Same + `beep-auto-drop.ts` for `machine_end_*` on **standard** AMD strings | Telnyx | Voicemail drop settings | Premium `greeting.ended` not wired |
| **Explicit `screener` classification** | **Partial** | Only if AMD `result` contains `"screen"` — `answer-detection.ts` (~18) | Not Telnyx iOS webhook | Analytics screening counts | Wire `call_screening.detected` → `screener` |
| **Screening runtime actions** | **Partial** | `resolveScreeningDecision` — `screening-runtime.ts`; recorded in `applyAmdToPowerDialerAttempt` | App logic | Settings → Call Screening | Execute hangup/notify/wait; rep UI signal |
| **Screener intro (name/reason)** | **Partial** | `maybePlayScreenerIntro` — `screener-intro-playback.ts`; triggered only when `classification === "screener"` && `connect_rep` | Telnyx speak/playback | Settings screener intro | Depends on real screener detection |
| **Block screener as “human connection”** | **Partial** | `isHumanConversation` excludes `screener` — `disposition-effects.ts` | App | Analytics KPIs | Without screener class, `human_*` may count as human |
| **Parallel AMD bridge** | **Partial** | `onParallelHumanAnswered` only when classification `human` — `answer-detection.ts` + `parallel-orchestrator.ts` | App + AMD | Dialer session | Machines may still ring agent on single-line power (WebRTC path **Unverified** without live trace) |
| **Parallel + machine filter** | **Missing** (runtime) | `amdFilter` stored on attempt metadata only — `session-runtime.ts` (~631); **never read** elsewhere | — | Campaign editor checkbox | Read classification before bridge; hangup losers |
| **Preview dialing** | **Complete** | `previewHeld` gating — `session-orchestration.ts` | App | Campaign + session | — |
| **Power (progressive)** | **Complete** | Default mode; session queue — `session-runtime.ts`, `dial-modes.ts` | WebRTC + Telnyx | Dialer | — |
| **Parallel / Predictive** | **Complete** (core) | Entitlements + `parallel-orchestrator.ts`, `predictive-pacing.ts`, `resolveLinesForSession` | App | Settings → Dialing; campaign editor | Machine filter + screening gaps |
| **Premium AMD entitlement** | **Partial** | Gates **campaign mode** `parallel_amd` only — `dial-modes.ts` (~155–160); **does not** gate `startPowerDialerAmdOnCallControlLeg` (`premium: true` always) | App | Settings | Align entitlement with Telnyx billing |
| **Number Health scores** | **Complete** (internal) | `assessNumberHealth`, `computeWindowMetrics` — `number-health-signals.ts`; `listPowerDialerNumberHealth` | **Internal** attempt/call data | `/app/power-dialer/number-health` | — |
| **Telnyx Number Reputation** | **Missing** | Placeholder string + `probe-telnyx-number-reputation.ts`; no runtime fetch | Telnyx add-on (Hiya-sourced per Telnyx docs) | `/number-health/premium` (explainers) | API client, entitlement, refresh job, UI |
| **Hiya / First Orion / TNS direct** | **Missing** | Free-tools **links only** — `number-health/free-tools/page.tsx` | External portals | Number Health | Optional; usually via Telnyx reputation |
| **Spam Likely labels (carrier)** | **Missing** | Not stored | — | — | Telnyx Number Reputation or manual |
| **Reputation history / alerts** | **Partial** | 7d vs 30d trends in number health; no external reputation deltas | Internal | Number detail metrics | External snapshot history |
| **Branded Calling** | **Missing** | No Telnyx Branded Calling APIs in repo | Telnyx product | — | Full product integration |
| **CNAM / STIR visibility** | **Partial** | `stirShakenAttestation` from `phoneNumber.capabilitiesJson` — `number-health-service.ts` | Telnyx number metadata if populated | Number Health table | CNAM management not in PD |
| **Best-time-to-call / pickup scoring** | **Missing** | No algorithms (grep) | — | — | Custom analytics/ML |
| **Lead-source performance** | **Partial** | `getCampaignConversionSummary` by campaign `leadSource` field — `analytics-conversion.ts` | App | Analytics (campaign conversions) | Not time-of-day optimization |
| **Screening in Call History / CRM** | **Partial** | `answerClassification` on `powerDialerAttempt`; analytics screening tab; CRM timeline shows disposition/status **not** classification — `contact-timeline.ts` | DB | Call history / Analytics | Surface classification on history + contact |
| **Detection audit trail** | **Complete** | `powerDialerDetectionEvent` — `answer-detection.ts` | App | **Unverified** in UI | Optional admin view |
| **Voicemail drop / beep auto-drop** | **Complete** | `beep-auto-drop.ts`, `voicemail-drop-*` | Telnyx playback | Settings + dialer | Standard vs premium greeting events |
| **Live voicemail (manual)** | **Complete** | API from dialer — `power-dialer-session.tsx` (`/live-voicemail`) | Telnyx | Dialer control | Distinct from Apple screening |
| **Abandonment safeguards** | **Complete** | `abandonment-policy.ts`, parallel gating | App | — | — |
| **AI receptionist callbacks** | **Complete** (bridge) | `ai-callback-bridge.ts` | Voice product | Callbacks → AI tab | Not screening detection |

---

## C. Telnyx-specific findings (direct answers)

### Premium AMD

| Question | Finding |
|----------|---------|
| Standard vs Premium? | **Both webhook types handled**; AMD **start** uses **`detection_mode: "Premium"`** only (`power-dialer-amd.ts`). Standard results still processed if Telnyx sends `call.machine.detection.ended`. |
| `answering_machine_detection: premium` on outbound create? | **Not on WebRTC `newCall`.** AMD is **`answering_machine_detection_start`** on linked Call Control ID after answer (`calls-service.ts`). |
| Which modes use AMD? | **AMD start runs for all power-dialer outbound** once control ID is linked — **not mode-specific**. **Parallel bridge optimization** uses AMD **human** classification (`answer-detection.ts`). **`parallel_amd`** is an entitlement-gated **campaign mode**; **machine filter flag is not enforced**. |
| `call.machine.premium.detection.ended`? | **Yes** — `calls-service.ts` |
| `call.machine.premium.greeting.ended`? | **No handler** in repo |
| `call.machine.premium.call_screening.detected`? | **No handler** |
| Stored classifications? | `powerDialerAttempt.answerClassification` + `powerDialerDetectionEvent.result` via `mapTelnyxAmdResult` — values: `human`, `voicemail`, `screener`, `uncertain` (+ unused types `ivr`/`fax` in types, rarely set) |
| iOS / Live Voicemail / Google screen? | **Not explicitly integrated.** Telnyx documents iOS via **`premium_ios_call_screening_detection`** and **`call.machine.premium.call_screening.detected`** — **absent in code**. |
| Screener vs human vs VM? | **VM/human** from Telnyx premium/standard strings; **screener** only via substring `"screen"` in `result` — **not** documented Telnyx screening webhook |
| Prevent screener = human connection? | **Only if** `answerClassification === "screener"`; **`human_residence` during screening may still count as human** until/unless Telnyx reclassifies |
| Agent / parallel legs on screening? | **No screening-specific cancel**; parallel losers cancelled on **`human`** AMD only |
| History / analytics / CRM? | **Analytics** yes (`analytics-service.ts`); **Call history** disposition-focused; **CRM timeline** does not show AMD/screener on attempts |

### Number Reputation

- **Not integrated.** Scores are **internally computed** from dial/answer/disposition patterns (`number-health-signals.ts`).
- `telnyxReputationStatus` is a **fixed explanatory string**, not live API data (`number-health-service.ts` ~125–127).
- **Hiya:** documented as Telnyx Number Reputation source; **no API integration** (probe script only).
- **No** automated external refresh, **no** Spam Likely label ingestion, **no** remediation workflow beyond copy/links.

### Branded Calling

- **Not implemented.** Outbound path is **WebRTC + Telnyx Call Control** for PSTN (`calls-service.ts`, `power-dialer-amd.ts`).
- **STIR/SHAKEN** shown only if stored on number capabilities — not a Branded Calling program.
- **Unverified:** whether current Telnyx account/products support Branded Calling on this architecture (requires account/Telnyx sales confirmation).

---

## D. Upgrade opportunity ranking (existing PD customers)

| Rank | Capability | Customer benefit | Effort | Provider cost / prereq | Sellable? |
|------|------------|------------------|--------|-------------------------|-----------|
| **1** | **iOS screening-aware Premium AMD** (`premium_ios_call_screening_detection` + webhooks + rep prompt flow) | High — fixes false “human connects” on screened calls | **High** (voice + UX + compliance) | Telnyx Premium AMD + iOS screening feature; per-minute AMD charges | **Yes** — “Intelligent Connections” tier |
| **2** | **Enforce parallel machine filter + screening actions** (use existing flags/runtime) | High — immediate value from code already half-built | **Medium** | None beyond AMD | **Yes** — bundle with advanced modes |
| **3** | **Telnyx Number Reputation** (entitlement already stubbed) | High for outbound teams | **Medium** | ~$100/mo/business (public Telnyx note in probe script); enterprise verification | **Yes** — “Reputation & Identity” |
| **4** | **Surface screening/AMD on Call History + CRM** | Medium — trust and coaching | **Low** | None | Add-on or included |
| **5** | **Branded Calling** | Medium–high (brand trust) | **High** | Telnyx Branded Calling fees + verification | **Yes** — separate SKU |
| **6** | **Best-time-to-call / contactability ML** | Medium | **High** | Custom | Future tier |
| **7** | **Google/Pixel explicit detection** | Medium | **Unverified** | Depends on Telnyx/carrier | Research first |

---

## E. Recommended next implementation scope (do not build yet)

1. **Telnyx iOS screening vertical slice:** Enable `premium_ios_call_screening_detection` (or equivalent on AMD start), implement **`call.machine.premium.call_screening.detected`**, **`call.machine.premium.greeting.ended` (`prompt_ended`)**, post-screening second `premium.detection.ended`, and **rep-facing prompt/TTS** before counting a connect.
2. **Wire existing screening runtime to actions:** Honor `hangup` / `notify_rep` / `voicemail_path` on the live leg; **do not bridge parallel winners** on `voicemail`/`screener` when `amdFilterMachines` is on.
3. **Telnyx Number Reputation MVP:** Behind `premiumReputationEntitlement`, poll/store scores, show **confirmed external** vs **estimated internal** in Number Health, optional alert on deterioration.
4. **Defer** Branded Calling and pickup-scoring until (1)–(3) are product-defined with Telnyx account confirmation.

**Provider charges to verify with Telnyx:** Premium AMD per minute, iOS screening mode availability, Number Reputation monthly fee, Branded Calling program eligibility.

---

## Critical distinction

**Having AMD (even Premium) is not proof of Apple screening assistant recognition.** Today Transovo maps **`human_residence` / `human_business` / `machine` / …** from **`premium.detection.ended`** only. **Apple screening** in Telnyx’s model is a **separate detection mode and webhook** (`call.machine.premium.call_screening.detected`, `result=screening`). That path is **not implemented** in `7296e2068`.

---

## Key source files (quick index)

| Area | Path |
|------|------|
| AMD start | `new-app/lib/server/phone/power-dialer/power-dialer-amd.ts` |
| AMD webhooks + link | `new-app/lib/server/phone/calls-service.ts` |
| Classification + screening events | `new-app/lib/server/phone/power-dialer/answer-detection.ts` |
| Screening policy (not enforced on leg) | `new-app/lib/server/phone/power-dialer/screening-runtime.ts` |
| Screener TTS intro | `new-app/lib/server/phone/power-dialer/screener-intro-playback.ts` |
| Dial modes / entitlements | `new-app/lib/server/phone/power-dialer/dial-modes.ts` |
| Parallel bridge | `new-app/lib/server/phone/power-dialer/parallel-orchestrator.ts` |
| Number health (internal) | `new-app/lib/server/phone/power-dialer/number-health-service.ts`, `number-health-signals.ts` |
| Reputation probe (read-only script) | `new-app/scripts/probe-telnyx-number-reputation.ts` |
| AMD fixture tests | `new-app/scripts/fixtures/power-dialer-amd-webhooks.json` |

---

*Audit complete — read-only; no code, deploy, or live tests performed.*
