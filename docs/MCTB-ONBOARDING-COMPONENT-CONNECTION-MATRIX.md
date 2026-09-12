# MCTB onboarding — component connection matrix

| STEP | COMPONENT | READ SOURCE | WRITE ACTION | PERSISTENCE | DOWNSTREAM | ERROR | STATUS |
|------|-----------|-------------|--------------|-------------|------------|-------|--------|
| Shell | Save & exit | — | `router.push` setup | — | — | — | CONNECTED_AND_WORKING |
| All | Load | GET `/api/mctb/onboarding` | — | `mctbOnboarding` | — | Banner | CONNECTED_AND_WORKING |
| Business line | Business fields | State + workspace | POST onboarding | workspace + state | Setup Overview | Inline | CONNECTED_AND_WORKING |
| Connect | Forwarding panel | GET carriers + forward E.164 | POST fields + `start_forwarding_test` | state | Phone & Forwarding | Inline | CONNECTED_AND_WORKING |
| Connect | Auto provision | trialNumber | `provision_trial_number` | trial number row | Recovery sender | Inline | CONNECTED_AND_WORKING |
| Consent | Mode cards | setup consentMeta | POST consentMode | mctb.consentMode + state | Consent setup | Inline | CONNECTED_AND_WORKING |
| Consent | Existing gate | `/api/mctb/setup` | blocked client + server | — | — | Disabled copy | CONNECTED_AND_WORKING |
| Recovery | Message composer | state + MCTB config | POST messageTemplate | MCTB config | Recovery setup | Inline | CONNECTED_AND_WORKING |
| Recovery | TFV submit | tfv status | POST `/api/mctb/tfv` | TFV provider | Messaging send | Inline | CONNECTED_AND_WORKING |
| Recovery | Demo modal | demo payload | `start_demo` | demo session | Try-it runtime | Modal | CONNECTED_AND_WORKING |
| Voicemail | Default greeting | — | `mark_voicemail_configured` | state timestamp | Voicemail TeXML | — | CONNECTED_AND_WORKING |
| Voicemail | Full studio | — | Link Setup Voicemail | `/api/phone/voicemail` | Voicemail page | — | INTENTIONALLY_DISABLED_WITH_REASON (onboarding uses default; studio in Setup) |
| Review | Summary rows | GET aggregate | `step` navigation | — | — | — | CONNECTED_AND_WORKING |
| Review | Live test | `/api/mctb/live-test` | POST start + poll | liveTestSession | Test & Diagnostics | Timeline | CONNECTED_AND_WORKING |
| Review | Finish | liveTest.passed | `activate_trial` / `step: ready` | trialActivatedAt | MCTB home | Inline | CONNECTED_AND_WORKING |
| Ready | Go to MCTB | — | navigate | — | — | — | CONNECTED_AND_WORKING |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0**
