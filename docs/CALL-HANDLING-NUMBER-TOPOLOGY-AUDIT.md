# Call Handling — Number Topology Audit (PR #483)

**Status:** Read-only inspection. **Do not merge PR #483** until ownership model is generalized for multi-DID topologies.

**Scope:** Trace existing number architecture vs PR #483 assumptions. No MCTB or Voice V3 runtime changes proposed here.

**Related:** `docs/MCTB-AI-RECEPTIONIST-OWNERSHIP-TOGGLE-AUDIT-READONLY.md`, `docs/CALL-HANDLING-OWNERSHIP-SWITCH-IMPLEMENTATION-REPORT.md`, PR #483.

---

## Executive summary

The product **already models multiple number roles** in data (voice ingress vs SMS sender vs AI agent DID vs public business line). **Carrier forwarding is not software-controlled** — the customer’s CFNA target is a specific Transovo E164 (`missedCallTextConfig.phoneNumberId` / production forward target).

**PR #483 implements Case 1 only:** one canonical **MCTB voice ingress** `PhoneNumber` is resolved for the workspace; `connection_id` on **that** row is toggled between MCTB TeXML and Voice V3 Basic CC. It does **not** model separate MCTB voice ingress and AI voice DIDs, and it can **mis-identify** “effective handler” when two DIDs are both correctly routed at Telnyx but only one receives the business line’s forwards.

**Platform SMS sender** is a **separate outbound route** (`resolvePlatformTelnyxSmsRoute` / platform demo sender). It is **not** the voice ingress DID and is **not** mutated by PR #483’s switch (which only PATCHes voice `connection_id` on the ingress phone).

---

## 1. Number roles (supported today)

| Role | What it is | Primary persistence / resolution |
|------|------------|--------------------------------|
| **Public business line** | Customer’s number callers dial; CFNA set on carrier | `MctbOnboardingState.businessNumberE164`, `workspace.customFieldsConfig.mctb.businessLineE164`, forwarding verification metadata (`forwardedFrom` on test calls) |
| **Voice ingress / forwarding DID** | Transovo DID the business line should forward unanswered calls **to** | `MissedCallTextConfig.phoneNumberId` → E164 via `getProductionMctbForwardTargetE164()` / `getOnboardingForwardTargetE164ForWorkspace()` (`production-forward-target.ts`, `forward-target.ts`) |
| **MCTB SMS sender** | E164 used for **outbound** recovery SMS | `MissedCallTextConfig.smsPhoneNumberId` (optional; schema: “may differ from voice trigger DID”). Resolved by `resolveMctbSmsSender()` (`sms-sender.ts`) — **prefers `phoneNumberId`, then `smsPhoneNumberId`**. Routed in `resolveMctbOutboundSmsRoute()` |
| **Platform / demo SMS sender** | Transovo-owned sender for demo/cert traffic | `resolvePlatformTelnyxSmsRoute()`, `resolvePlatformDemoSmsSender()` — `sendWorkspaceId` = platform owner; **not** customer ingress |
| **AI Receptionist voice DID** | `PhoneNumber` assigned to published agent | `VoiceAgent.phoneNumberId` + `VoiceAgentPhoneNumber` join (`agent-phone.ts`). Wizard can pick any workspace number (`appointment-receptionist` phone step) or **reuse MCTB ingress** via `/api/mctb/inbound-handling` (`ingressE164`, `line.phoneNumberId`) |
| **Telnyx provider identity** | Provider-side number id for PATCH | `PhoneNumber.providerNumberId` |
| **Who answers (provider)** | Inbound voice app on a given DID | Telnyx `phone_numbers.connection_id` → MCTB TeXML app id **or** Voice V3 Basic Call Control app id |
| **Legacy policy (not ingress truth)** | UI/policy enum | `phoneNumber.settingsJson.mctbInbound.inboundHandlingMode` — **not** read by MCTB TeXML or V3 Basic webhooks |

**Prisma:** `MissedCallTextConfig` (`phoneNumberId`, `smsPhoneNumberId`), `PhoneNumber`, `VoiceAgent`, `VoiceAgentPhoneNumber`, workspace onboarding in `customFieldsConfig` / `MctbOnboardingState`.

---

## 2. Case 1 — Shared-DID topology (same Transovo DID)

**Example:** MCTB voice ingress = AI voice DID = `571-555-2000` (one `PhoneNumber`).

```
Customer business line (703-555-1000)
        ↓ CFNA (customer carrier; verified in onboarding)
Transovo DID 571-555-2000  (missedCallTextConfig.phoneNumberId)
        ↓ Telnyx connection_id
   ┌────┴────┐
   MCTB TeXML app          OR          Voice V3 Basic CC
        ↓                                    ↓
/api/telnyx/voice/mctb-entry          /api/telnyx/voice/v3-basic
```

**PR #483 alignment:** **Matches this case.** `setActiveCallHandler` resolves workspace ingress via `resolveMctbPhoneNumberIdForWorkspace` → toggles `connection_id` on that row → persists `settingsJson.callHandling` on **that same** `PhoneNumber`.

**SMS:** Recovery SMS uses `resolveMctbOutboundSmsRoute` (sender may still equal ingress or a different `smsPhoneNumberId`; switch does not PATCH sender numbers).

---

## 3. Case 2 — Separate-DID topology (MCTB ingress ≠ AI voice DID)

**Example:**

- Business line: `703-555-1000`
- MCTB voice ingress: `571-555-2000` (`missedCallTextConfig.phoneNumberId`)
- AI Receptionist: `571-555-3000` (`voiceAgent.phoneNumberId`)

**Call paths:**

```
Business line → CFNA → 571-555-2000 → connection_id → MCTB TeXML (when MCTB owns ingress)

Business line → CFNA → 571-555-3000 → connection_id → V3 CC (only if customer forwarded to 3000)
```

**What the product actually stores as “where to forward”:**

- Onboarding / setup forward target = **`getProductionMctbForwardTargetE164(workspaceId)`** → **`runtime.phoneNumberId` E164** (MCTB ingress), not the AI DID unless they are the same row.

**Critical question (your example):**

If CFNA is `703 → 571-555-2000`, then PATCHing `connection_id` on **`571-555-3000` does nothing** to calls still landing on **`571-555-2000`**.

**Traced conclusion:** There is **no repository mechanism** found that changes the customer’s carrier CFNA when the user toggles Call Handling. Forwarding is **customer-configured**; Transovo only **verifies** (`forwarding-verification.ts`, `forwardingConnectedAt`, `forwardedFrom` vs `forwardTargetE164`).

Therefore **instant “switch to AI” with unchanged carrier forwarding** only works if the toggle repoints the **same DID the business line forwards to** (ingress), i.e. collapses to Case 1 behavior on the **ingress** `PhoneNumber`, even if the AI wizard also has a **second** product number on file.

If AI is truly inbound on a **different** DID and the business line still forwards to MCTB ingress, **software cannot redirect those calls to AI** without either:

- repointing **ingress** `connection_id` to V3 (while MCTB config remains on workspace — runtime separation preserved), **or**
- customer changing CFNA to the AI DID (not automated in this codebase).

**No** MCTB→V3 or V3→MCTB runtime bridge exists or is proposed.

---

## 4. Case 3 — Platform sender topology

**Outbound MCTB SMS** can use:

1. **Customer production sender** — workspace-owned `PhoneNumber` from `phoneNumberId` / `smsPhoneNumberId` (`resolveMctbOutboundSmsRoute`).
2. **Platform Telnyx A2P** — `resolvePlatformTelnyxSmsRoute` sends via **platform owner** workspace + platform sender `phoneNumberId` / `fromE164` (`outbound-sms-route.ts`, `platform-demo.ts`).

**Answer:** **Platform SMS sender is not the voice forwarding DID.** Voice ingress remains `missedCallTextConfig.phoneNumberId` (and TeXML routing on that DID). Platform sender is used only for **SMS send path** in demo/cert/platform modes.

Default **customer provision** (`provisionMctbCustomerVoice` → `activateJohnOnPhoneNumber`) sets **`phone_number_id` and `sms_phone_number_id` to the same `phone.id`** — but schema and `outbound-sms-route` explicitly allow **`smsPhoneNumberId !== phoneNumberId`**.

**PR #483:** Only calls `routePhoneToMctbCallHandlingIngress` / `routePhoneToVoiceV3BasicCallControl` on the **ingress** phone resolved for call handling. **Does not** change platform sender or alternate `smsPhoneNumberId` rows.

---

## 5. Case 4 — Customer A2P / toll-free / local

| Arrangement | Supported in data? | Notes |
|-------------|-------------------|--------|
| Ingress = sender = AI DID (one row) | Yes | Common provision path; PR #483 target case |
| Ingress = sender, AI on other DID | Yes | `voiceAgent.phoneNumberId` ≠ `missedCallTextConfig.phoneNumberId`; forward target still MCTB ingress E164 unless customer changes CFNA |
| Ingress ≠ sender (split SMS) | Yes | `smsPhoneNumberId`; `resolveMctbSmsSender` + `outbound-sms-route` |
| Ingress on toll-free / local with A2P/TFV | Yes | `isPhoneAuthorizedForOutboundSms`, compliance regimes per number class |

Call Handling should control **voice ingress** only; SMS sender fields must remain independent (PR #483 mostly respects this; see readiness quirk below).

---

## 6. PR #483 — single-DID assumptions (checklist)

| Location | Assumption |
|----------|------------|
| `set-active-call-handler.ts` | Always resolves **one** phone via `resolveMctbPhoneNumberIdForWorkspace` (defaults to `missedCallTextConfig.phoneNumberId`). All Telnyx mutations on **that** row. |
| `loadCallHandlingOwnershipState` | Same single phone; `effectiveHandler` = `connection_id` on **that** phone only. |
| `effective-handler.ts` | One `providerNumberId` inspected. |
| `readiness.ts` `assessMctbCallHandlingReadiness` | Requires `configPhoneId === phone.id` where `phone` is ingress resolution; uses `phoneNumberId \|\| smsPhoneNumberId` as config id (**can blur ingress vs sender** for readiness). |
| `readiness.ts` `assessAiReceptionistCallHandlingReadiness` | Runs against **ingress** `phone.id`, not necessarily `voiceAgent.phoneNumberId`. |
| `setActiveCallHandler` → AI branch | Routes **ingress** `phone` to V3; `syncVoiceAgentPhoneAssignment` assigns agent to **ingress** id. |
| `phone-settings.ts` | `callHandling` block stored on **ingress** `PhoneNumber.settingsJson` only. |
| `publish-gate.ts` | Per **one** `phoneNumberId` (agent’s DID on publish — may differ from ingress). |
| `initial-selection.ts` | Same phone-scoped settings. |
| API `/api/call-handling` | Optional `phoneNumberId` still resolves through MCTB ingress resolver. |
| UI `shouldShowCallHandlingSwitcher` | `hasMctb && hasVoice` = **product entitlements only**; does **not** check same DID. |
| `parkedAiReceptionistAgentId` | Parked on ingress phone settings; agent may have been on another DID. |

**Legacy API note:** `GET /api/mctb/inbound-handling` returns `sameNumberReused: true` **hardcoded** — not evidence of runtime topology.

---

## 7. UI condition (`hasMctb && hasVoice`)

- **`hasMctb` / `hasVoice`:** workspace product entitlements in app shell (voice entitlement covers appointment receptionist / voice products).
- **Does not require** `missedCallTextConfig.phoneNumberId === voiceAgent.phoneNumberId`.
- Switcher can appear when products coexist on **different** DIDs; behavior is still **ingress-only** toggle → **unsafe or ineffective** for separate-DID + single forward target unless generalized.

---

## 8. Effective handler detection (separate-DID gap)

**PR #483:** `effectiveHandler` = inspect **one** DID’s `connection_id` (MCTB TeXML app vs V3 CC app).

**When two DIDs exist:**

- `571-2000` → MCTB TeXML (active)
- `571-3000` → V3 CC (active)

Telnyx can show **both** routes “healthy.” Only the DID matching **`getProductionMctbForwardTargetE164`** (ingress) receives **business-line CFNA** in the designed MCTB forward model.

**What identifies who handles business calls:**

1. **Carrier forward target E164** (customer config; verified against `forwardTargetE164` + `forwardedFrom`)
2. **`connection_id` on that ingress DID**

Not: connection_id on a non-ingress AI product DID.

**Drift:** PR #483 `drift` compares selected handler to effective on **ingress only** — it cannot detect “AI DID active but business still forwards to MCTB ingress.”

---

## 9. SMS sender vs call ownership (must not conflate)

| Concern | Controlled by Call Handling switch? | Evidence |
|---------|-------------------------------------|----------|
| Voice ingress `connection_id` | Yes (PR #483) | Telnyx PATCH on ingress `PhoneNumber` |
| `missedCallTextConfig.phoneNumberId` | No | Not updated in call-handling module |
| `missedCallTextConfig.smsPhoneNumberId` | No | Outbound path separate |
| Platform sender | No | `resolvePlatformTelnyxSmsRoute` |
| MCTB TeXML / V3 runtimes | No | Unchanged |

**Caveat:** `assessMctbCallHandlingReadiness` treats `phoneNumberId || smsPhoneNumberId` as “the” MCTB config phone for equality check — if only `smsPhoneNumberId` is set to ingress and `phoneNumberId` is null, behavior differs; production forward target uses **`phoneNumberId` first** (`getProductionMctbForwardTargetE164`).

---

## 10. Architecture inspection (A / B / C) — evidence only

### A — One canonical voice-ingress DID (recommended product story)

**Evidence FOR:**

- Forward instructions use **`getProductionMctbForwardTargetE164`** = `missedCallTextConfig.phoneNumberId`.
- MCTB wizard + appointment wizard **reuse** MCTB line (`phone-step.tsx` → inbound-handling `ingressE164` / `line.phoneNumberId`).
- Original readonly audit “typical same-number model.”

**PR #483 fits A** if AI is assigned to **that same ingress** (or switch only ever mutates ingress).

### B — Product-specific voice DIDs without shared ingress

**Evidence:**

- AI wizard lists all `/api/phone/numbers`; agent `phoneNumberId` can differ from MCTB config.
- `publishVoiceAgent` routes **agent’s** `phoneNumberId` to V3 CC.

**No traced mechanism** to swap carrier CFNA between MCTB and AI DIDs on toggle.

**Instant switch feasibility:** **Not** with PR #483 as-is if forward target remains MCTB ingress and AI owns another DID — unless toggle repoints **ingress** (not AI product DID) to V3.

### C — Product numbers vs forwarding ingress

**Evidence:**

- **Forwarding ingress** = `missedCallTextConfig.phoneNumberId` (E164 shown in setup/onboarding).
- **Product numbers** = separate `PhoneNumber` rows; AI association on agent row.
- Distinction exists in IA (business line vs business line vs text-back sender in MCTB rules); implementation matches **ingress** as forward target.

Call Handling ownership should likely anchor on **forwarding route / business line context**, with explicit **`voiceIngressPhoneNumberId`** and optional **`aiReceptionistVoicePhoneNumberId`**.

---

## 11. Recommended ownership model (design only — do not implement yet)

**Prefer business-line / forwarding-route scope**, not a single ambiguous `PhoneNumber`:

```text
WorkspaceCallHandling (conceptual)
  businessLineE164              // from onboarding
  voiceIngressPhoneNumberId     // CFNA target; missedCallTextConfig.phoneNumberId
  mctbSmsSenderPhoneNumberId    // smsPhoneNumberId or platform route ref
  aiReceptionistAgentId
  aiVoicePhoneNumberId          // voiceAgent.phoneNumberId (may === ingress)
  activeCallHandler             // customer selection
  activeOnIngressConnection     // provider truth on voiceIngressPhoneNumberId only
```

**Switch semantics:**

- **Always** mutate Telnyx on **`voiceIngressPhoneNumberId`** (the DID the business line forwards to).
- When switching to AI: route **ingress** to V3 CC; bind published agent to **ingress** for assignment consistency (or document that PSTN binds by To E164 regardless).
- When switching to MCTB: route **ingress** to MCTB TeXML; **do not** tear down AI config on other DIDs.
- If `aiVoicePhoneNumberId !== voiceIngressPhoneNumberId` and customer forwards only to ingress, **do not** PATCH the non-ingress AI DID for call handling (or show UI that AI product number is not the live forward target).

**Persistence:** `callHandling` on ingress phone may remain valid **if** `voiceIngressPhoneNumberId` is explicit in API/state; alternatively workspace-level JSON keyed by business line.

---

## 12. Changes needed to PR #483 (before merge)

| Verdict | **Needs ownership model adjustment** — not topology-safe for separate DIDs. |

| Area | Required change |
|------|-----------------|
| Resolution | Resolve **voice ingress**, **AI voice DID**, and **SMS sender** independently; never assume one id. |
| `setActiveCallHandler` | Apply Telnyx switch to **ingress**; resolve AI readiness from `voiceAgent.phoneNumberId` when different; optional: repoint agent to ingress on AI activate. |
| Effective state | Effective = `connection_id` on **ingress** + match to `activeCallHandler`; optionally surface “AI product DID not forward target.” |
| Readiness | MCTB ready = ingress + config; AI ready = published agent; **decouple** `smsPhoneNumberId` from ingress equality unless that row is ingress. |
| Publish gate | When explicit MCTB handler, skip routing on **ingress** even if publish touches a different agent DID. |
| API response | Expose role map: `voiceIngress`, `mctbSmsSender`, `aiVoiceDid`, `forwardTargetE164`, `sameIngressAsAi`. |
| UI | Entitlements + topology guard (e.g. warn if AI DID ≠ ingress and forward verified to ingress only). |
| Separate DIDs | If product requires true dual-DID without shared ingress, **report to product** that instant toggle **cannot** work without carrier forward change — do not fake success. |

**Protected systems:** Corrections above are **orchestration/API/UI only** — still **zero** changes required inside MCTB TeXML runtime or Voice V3 PSTN runtime.

---

## 13. Instant switching feasibility matrix

| Topology | Carrier forward | Toggle changes | Next business call hits |
|----------|-----------------|----------------|------------------------|
| Same DID | → ingress | ingress `connection_id` | Selected handler — **works** (PR #483) |
| Split DIDs | → MCTB ingress only | AI DID only | **Still MCTB** — toggle ineffective |
| Split DIDs | → MCTB ingress only | **Ingress** → V3 | **AI on ingress** — works if agent/runtime accept To E164 binding |
| Split DIDs | → AI DID only | Ingress → MCTB | **Still AI** until customer changes CFNA |
| Platform SMS sender | → ingress | Voice switch | Voice changes; **SMS sender unchanged** (correct) |

---

## 14. What to do next (process)

1. **Product decision:** Is **canonical ingress DID** mandatory for V1 Call Handling (Architecture A), or must we support **true split voice DIDs** (B) with customer manual forward change?
2. **Generalize PR #483** per §12 — still no runtime merge.
3. **Re-run** source tests + staging PSTN matrix on **same-DID** and **split-DID** fixtures.
4. **Do not merge** #483 until topology report is accepted and implementation updated.

---

*Audit performed by static trace of repository on branch `cursor/call-handling-ownership-switch-2304`. No code or provider changes.*
