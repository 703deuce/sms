# Voice V3 transfer — certification readiness (2026-09-20)

**Branch:** `cursor/voice-v3-transfer-system-2304`  
**Status:** Implementation ready for deploy + PSTN certification. **Not complete** until live DIRECT / WARM / WATERFALL (+ exhausted) calls pass on +15717491060.

---

## 1. `test-voice-v3-wizard-cert-matrix.ts` / `callbackRequiredCollectFieldIds`

### Verdict: **pre-existing failure — not introduced by the transfer branch**

| Check | Result |
|-------|--------|
| `origin/master` | Same failure: `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped customer-editable controls: callbackRequiredCollectFieldIds` |
| Transfer branch | Identical failure |
| `callbackRequiredCollectFieldIds` in `wizard-control-inventory.ts` on master | Yes |
| Row in `wizard-v3-field-manifest.ts` on master | **No** |

**Cause:** Callback required-field editor was added to Call Handling (`call-handling-step.tsx`) and inventory, but no manifest row was added when manifest completeness was tightened.

**Transfer branch action:** **None.** Do not fix callback manifest or callback behavior on the transfer PR. Track separately (callback / wizard-manifest workstream).

**Also affected:** `scripts/test-voice-v3-wizard-backend-propagation.ts` (calls `assertWizardManifestComplete()` at start).

**Transfer-specific tests (pass):** `npm run test:voice-v3-transfer-system`, `npx tsx scripts/test-voice-v3-wizard-compiler.ts`.

---

## 2. Call Handling UI (Appointment Receptionist — browser proof still required)

**Route:** Call handling → **Emergency & human transfer** (`EmergencyTransferEditor` + `transfer-wizard-state.ts`).

When **Transfer calls** capability is enabled (normal Appointment Receptionist, not MCTB-only):

- Enable/disable emergency & human transfer (`voiceV2HumanTransferEnabled`)
- Single vs waterfall routing (`transferRouting`)
- Multi-destination CRUD (`transferDestinations`)
- Waterfall reorder + per-step Direct/Warm + ring timeout (`transferPlanSteps`)
- Default ring timeout (`transferRingSeconds`) with per-contact override
- Transfer fallback (`transferFallback`)
- Inline validation via `transferWizardValidationIssues` + `validateVoiceV3TransferPolicyForPublish`
- Legacy `transferDestinationName` / `transferDestinationPhone` migrated on load and kept in sync on save

MCTB-only blocks retained: urgency rules, sales/solicitation (not transfer).

### Manual browser checklist (owner)

Use saved draft → reload → publish → inspect compiled agent / logs:

1. Enable **Transfer calls** capability (Goals).
2. Call handling: set destination phone, ring seconds, warm, fallback.
3. Configure waterfall with three contacts (On-call WARM 20s, Manager DIRECT 20s, Owner DIRECT 30s), reorder, edit, delete, restore, publish — verify compiled `config.transfer` matches UI (see user certification script in task brief).
4. Activate/publish; confirm blocking message if warm enabled without outbound trunk.
5. Compare published Voice V3 config: `transfer.enabled`, `transfer.routing`, `transfer.routes[0].targets`, no dial targets in Astra prompts.

### PSTN certification scenarios vs UI

| Scenario | Minimum wizard data |
|----------|---------------------|
| **DIRECT** | Legacy single destination + `warmTransfer: false` |
| **WARM** | Legacy single destination + `warmTransfer: true` + outbound trunk configured |
| **WATERFALL (2+ targets)** | Call Handling UI: waterfall + ≥2 contacts + order/modes/timeouts |
| **WATERFALL exhausted** | Same + targets that will not answer; verify `transferFallback` behavior and Amy copy |

---

## 3. LiveKit / Telnyx configuration for warm transfer (read-first)

### Code paths (no carrier changes from this doc)

| Layer | Behavior |
|-------|----------|
| Compile-time trunk | `getStoredLiveKitOutboundTrunkId()` → `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` → `LIVEKIT_OUTBOUND_TRUNK_ID` → `LIVEKIT_SIP_OUTBOUND_TRUNK` |
| Published plan | `config.transfer.telephony.outboundSipTrunkId` on authorized execution payload |
| Warm leg | `WarmTransferTask(sip_trunk_id=…, sip_number=outboundCallerIdE164)` |
| Caller ID (V3 transfer compile) | `outboundCallerIdE164` from wizard `outboundSmsE164` or `phoneNumberE164` (normalized E.164) |
| Legacy Python resolve | `resolveTransferForPython` uses **business line** `call.toE164` as `sipCallerIdE164` + `resolvePlatformOutboundTrunkId` |

**Cert DID:** +15717491060 (inbound / business line per phase-54 docs). Warm outbound caller ID should be the **authorized Telnyx DID on the shared outbound trunk** — typically the same business number or another DID listed on that trunk’s caller-ID allowlist.

### Cloud agent environment snapshot (not production Coolify — verify there)

| Item | Observed |
|------|----------|
| `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` | Not set |
| `LIVEKIT_OUTBOUND_TRUNK_ID` | **Set** → trunk resolves (**suffix `…k5wokm`**) |
| `LIVEKIT_SIP_OUTBOUND_TRUNK` | Not set |
| `getStoredLiveKitOutboundTrunkId()` | Returns non-null |

### Production checklist (you verify on Coolify)

**transovo-web**

- [ ] `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` **or** `LIVEKIT_OUTBOUND_TRUNK_ID` / `LIVEKIT_SIP_OUTBOUND_TRUNK` set to platform outbound trunk `ST_…`
- [ ] Telnyx outbound credentials present if trunk must be created/updated (`TELNYX_SIP_OUTBOUND_USERNAME` / `PASSWORD` per `docs/deployment-transovo-web-voice-split.md`)

**transovo-voice**

- [ ] Bootstrap returns `sipOutboundTrunkId` (preferred) **or** `LIVEKIT_SIP_OUTBOUND_TRUNK` fallback matches web
- [ ] `LIVEKIT_SIP_NUMBER` or bootstrap `sipCallerIdE164` aligned with cert DID if warm leg must present +15717491060

**LiveKit Cloud (read-only audit scripts)**

- [ ] Outbound trunk exists (`transovo-telnyx-outbound` or doc name)
- [ ] Cert DID (+15717491060) on **outbound** trunk caller-ID list (inbound trunk `ST_vewjyLgDxVda` in phase-54 is separate)

**Telnyx**

- [ ] Outbound trunk auth to Telnyx; no new trunk without explicit approval

**Do not** create or modify trunks from the transfer branch without reading current state via your existing inspect/repair scripts (`scripts/inspect-571-telnyx-livekit.ts`, provisioning libs).

---

## 4. Deploy before PSTN

1. Merge/deploy **transovo-web** + **transovo-voice** from `cursor/voice-v3-transfer-system-2304` (or merged master).
2. Confirm voice worker on LiveKit 1.8.x with `WarmTransferTask`.
3. Republish cert workspace agent after trunk + caller ID confirmed.

---

## 5. PSTN certification order (do not mark ✅ until done)

Capture **`VOICE_V3_TRANSFER_*`** and **`VOICE_V3_TRANSFER_BILLING_USAGE`** on every call.

1. **DIRECT** — emergency/human transfer → authorized destination answers → caller leaves Amy path.
2. **WARM** — employee rings → brief handoff (privacy-limited) → accept → bridge → Amy exits.
3. **WATERFALL** — first target no-answer → timeout → second answers → stop.
4. **WATERFALL exhausted** — all fail → configured fallback → Amy does not claim false connection.

**Out of scope until transfer ✅:** End Call certification, Calendly provider, Google Calendar, Website Import → Wizard Prefill.

---

## 6. Microsoft scheduling

Frozen for this workstream — no changes in transfer branch.
