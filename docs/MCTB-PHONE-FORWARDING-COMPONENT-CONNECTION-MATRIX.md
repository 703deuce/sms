# MCTB Phone & Forwarding — component connection matrix

| COMPONENT | READ SOURCE | WRITE ACTION | PERSISTENCE | DOWNSTREAM EFFECT | ERROR STATE | STATUS |
|-----------|-------------|--------------|-------------|-------------------|-------------|--------|
| Business line input | `GET /api/mctb/setup` `businessLineE164`; onboarding `businessNumberE164` | `POST /api/mctb/setup` + onboarding POST | Workspace `mctb.businessLineE164`, onboarding `businessNumberE164` | Forwarding verification compares ANI to business line | Inline validation; setup/onboarding error banner | CONNECTED_AND_WORKING |
| Forwarding destination select | `GET /api/mctb/setup` `phoneNumbers`, `runtime.phoneNumberId`, `productionForwardTargetE164` | `POST /api/mctb/setup` `phoneNumberId` | MCTB runtime config phone binding | Changes ingress / SMS sender for recovery | Save API error | CONNECTED_AND_WORKING |
| Manage numbers link | — | Navigation | — | Opens numbers workspace | — | READ_ONLY_BY_DESIGN |
| Carrier compact grid | Onboarding `state.forwardingCarrier`; `MCTB_CARRIER_GUIDES` | Onboarding POST `forwardingCarrier` | Onboarding state | Instructions drawer content | Confirm on change if verified | CONNECTED_AND_WORKING |
| View instructions drawer | Carrier guide + `formatCarrierStep` | Opens modal only | — | — | Disabled without forward target | CONNECTED_AND_WORKING |
| Copy destination / dial code | Forward E.164; `buildDialCodeCopyText` | Clipboard | — | — | Silent clipboard fail | CONNECTED_AND_WORKING |
| I finished setup | — | Closes drawer; scroll to verify | Does not mark verified | Focus verify section | — | READ_ONLY_BY_DESIGN |
| Ring presets / custom | Onboarding `forwardingRingSeconds` | Onboarding POST | Onboarding state 10–30s | Status strip, flow preview, verify copy | Save validation 10–30 | CONNECTED_AND_WORKING |
| Voicemail timing warning | `shouldShowVoicemailTimingWarning` (carrier capabilities) | — | — | Informational only | Hidden when not derivable | CONNECTED_AND_WORKING |
| Save changes | Dirty snapshot vs baseline | Setup + onboarding POST | As above | May affect verification state per backend | Banner + disabled when clean | CONNECTED_AND_WORKING |
| Run forwarding test | `forwardingVerification` poll | `start_forwarding_test` | Clears prior verification timestamps on start | Poll every 3s until verified | `testError` from API | CONNECTED_AND_WORKING |
| Connection status strip | Derived `resolveConnectionUiStatus` | — | — | All surfaces use same derivation | unknown when missing line/target | CONNECTED_AND_WORKING |
| Right rail summary | Same as page state | — | — | — | — | CONNECTED_AND_WORKING |
| Call flow preview | `forwardRingSeconds` | — | — | Illustrative only | — | READ_ONLY_BY_DESIGN |
| Need help actions | Routes above | Drawer / test / setup test | — | — | Dead links avoided | CONNECTED_AND_WORKING |
| Paused banner | Setup `schedule` | — | — | — | — | CONNECTED_AND_WORKING |

**BROKEN = 0 · NO_OP = 0 · PLACEHOLDER = 0**
