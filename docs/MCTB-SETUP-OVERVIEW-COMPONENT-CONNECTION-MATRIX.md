# MCTB Setup Overview — component connection matrix

| UI region | Classification | Source |
|-----------|----------------|--------|
| Global status strip — recovery | CONNECTED_AND_WORKING | `GET /api/mctb/setup` → `schedule`, `runtime.enabled` |
| Global status strip — business line | CONNECTED_AND_WORKING | `setup.businessLineE164` |
| Global status strip — sender | CONNECTED_AND_WORKING | `phoneNumbers` + `compliance.messagingReady` |
| Global status strip — forwarding | CONNECTED_AND_WORKING | `GET /api/mctb/onboarding` `forwardingConnectedAt` / `forwardingVerification` |
| Global status strip — last test | CONNECTED_AND_WORKING | `onboarding.state.liveTestPassedAt`, `GET /api/mctb/live-test` |
| Pause / resume control | CONNECTED_AND_WORKING | `POST /api/mctb/setup` (`enabled`, `pauseUntil`) |
| Attention rows | CONNECTED_AND_WORKING | Derived from setup + onboarding + voicemail greeting |
| Summary — Phone & Forwarding | CONNECTED_AND_WORKING | `businessLineE164`, `productionForwardTargetE164`, forwarding flags |
| Summary — Recovery | CONNECTED_AND_WORKING | Trigger flags + pause + `cooldownMinutes` |
| Summary — Consent | CONNECTED_AND_WORKING | `consentMode` |
| Summary — Text-back | CONNECTED_AND_WORKING | `runtime.messageTemplate` length |
| Summary — Voicemail | CONNECTED_AND_WORKING | `GET /api/phone/voicemail` greeting fields |
| Summary — Notifications | CONNECTED_AND_WORKING | `GET /api/mctb/handoff` recipients |
| Summary — Exclusions | CONNECTED_AND_WORKING | `GET /api/mctb/exclusions` count |
| Summary — Test | CONNECTED_AND_WORKING | Onboarding live test + live-test API |
| Recent system activity | READ_ONLY_BY_DESIGN | `onboarding.state.funnelEvents` (known keys only) |
| Quick actions | CONNECTED_AND_WORKING | Links to canonical section routes |
| Horizontal section nav | CONNECTED_AND_WORKING | `MCTB_SETUP_SECTIONS` + pathname resolver |

**BROKEN:** 0  
**PLACEHOLDER:** 0  
**NO_OP:** 0  
