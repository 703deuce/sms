# MCTB onboarding — old → new step migration

| OLD STEP | OLD CAPABILITY | NEW STEP / LOCATION | BACKEND PRESERVED? | UI PRESERVED? | STATUS |
|----------|----------------|---------------------|--------------------|---------------|--------|
| business | Business name, website | Business line | YES | YES | MIGRATED |
| business | Business phone (connect only) | Business line | YES | YES | MIGRATED |
| business | Carrier selection | Business line | YES | YES | MIGRATED |
| consent | Press 1 / existing consent | Consent | YES | YES | MIGRATED |
| consent | Attestation | Consent | YES | YES | MIGRATED |
| demo | start_demo session | Recovery modal “See how it works” | YES | YES | MIGRATED |
| demo | Demo timeline polling | Demo modal | YES | YES | MIGRATED |
| trial_number | provision_trial_number | Connect calls (auto) + Recovery panel | YES | YES | MIGRATED |
| configure | messageTemplate save | Recovery | YES | YES | MIGRATED |
| tfv | POST /api/mctb/tfv | Recovery (messaging panel) | YES | YES | MIGRATED |
| pending | Poll TFV status | Recovery (amber status) | YES | YES | MIGRATED |
| connect | Carrier instructions | Connect calls | YES | YES | MIGRATED |
| connect | Ring timing | Connect calls | YES | YES | MIGRATED |
| connect | start_forwarding_test | Connect calls | YES | YES | MIGRATED |
| connect | Save forwarding fields | Connect calls | YES | YES | MIGRATED |
| live_test | /api/mctb/live-test | Review & test | YES | YES | MIGRATED |
| live_test | activateMctbTrial on pass | Review & test → Ready | YES | YES | MIGRATED |
| complete | Trial messaging | Ready | YES | YES | MIGRATED |
| — | Voicemail greeting (product) | Voicemail step + Setup Voicemail | YES | YES (default + deep link) | ADDED_UI |

**UNACCOUNTED_OLD_CAPABILITIES: 0**
