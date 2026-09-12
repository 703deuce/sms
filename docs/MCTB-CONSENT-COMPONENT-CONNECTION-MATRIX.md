# MCTB Consent — component connection matrix

| Component | Visible state source | Read source | Write action | Validation | Persistence | Runtime effect | Error state | Status |
|-----------|---------------------|-------------|--------------|------------|-------------|----------------|-------------|--------|
| Status strip | draft mode, health, sender label | GET `/api/mctb/setup` | — | — | — | — | load error banner | CONNECTED_AND_WORKING |
| Press 1 mode card | `draftMode` | GET setup `consentMode` | local draft → POST setup | always allowed | `consentMode: press_1` | TeXML `press_1` handler, gather | save error | CONNECTED_AND_WORKING |
| Existing consent card | `draftMode`, `existingConsentEligible` | `consentMeta` + `compliance.messagingReady` | modal attestation → POST | disabled if !eligible; server 400 | `consentMode` + attestation record | TeXML `voicemail` handler, capture eligibility | ineligible amber + link | CONNECTED_AND_WORKING |
| Save changes | dirty vs baseline | baseline from GET | POST `/api/mctb/setup` | phoneNumberId required | same as mode cards | consent sync + provision | inline alert | CONNECTED_AND_WORKING |
| Caller experience flow | `draftMode` | model constants | — | — | — | explanatory | — | READ_ONLY_BY_DESIGN |
| Disclosure preview | prompt slice | GET `/api/mctb/consent-prompt` | — (locked on Setup) | Press 1 only | prompt store elsewhere | playback matches runtime | missing audio disabled | CONNECTED_AND_WORKING |
| No-consent info | Press 1 draft | — | — | Press 1 only | — | matches voicemail fallback | — | READ_ONLY_BY_DESIGN |
| Consent evidence | mode + attestation meta | GET setup `consentMeta` | — | — | log via capture | — | — | CONNECTED_AND_WORKING |
| View consent log | — | — | navigation | — | — | — | — | CONNECTED_AND_WORKING |
| Manage messaging number | eligibility | `messagingReady` | — | — | — | — | — | CONNECTED_AND_WORKING |
| Related settings links | recovery/template | GET setup runtime | navigation | — | — | — | — | CONNECTED_AND_WORKING |
| Existing consent modal | local checkbox | — | confirms draft only | primary disabled until checked | attestation on save POST | — | — | CONNECTED_AND_WORKING |
| Switch to Press 1 modal | — | — | confirms draft | — | POST on save | handler mode | — | CONNECTED_AND_WORKING |

**BROKEN: 0 · NO_OP: 0 · PLACEHOLDER: 0**
