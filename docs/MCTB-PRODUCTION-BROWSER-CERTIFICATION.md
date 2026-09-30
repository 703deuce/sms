# MCTB Production Browser Certification

**Base URL:** (production — see run env MCTB_PROD_CERT_BASE_URL)  
**Workspace:** ws_1  
**Production SHA (start):** e7d2d8e91b1f95df266b72cdbe8a56e531afa8de  
**Started:** 2026-09-30T02:20:12.498Z

| Page | Tab | Control | Browser action | UI result | Backend result | Refresh result | Effective runtime | Status | Defect/Fix |
|------|-----|---------|----------------|-----------|----------------|----------------|-------------------|--------|------------|
| Overview | — | route load | goto /mctb | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Missed-call recovery hub | — | route load | goto /mctb/missed-call-recovery | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Recovery hub consent tab | — | route load | goto /mctb/missed-call-recovery?tab=consent | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Recovery hub exclusions tab | — | route load | goto /mctb/missed-call-recovery?tab=exclusions | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Recovery hub rules tab | — | route load | goto /mctb/missed-call-recovery?tab=rules | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| MCTB onboarding | — | route load | goto /onboarding/mctb | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Missed Calls | — | route load | goto /mctb/missed-calls | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Conversations | — | route load | goto /mctb/conversations | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Voicemail | — | route load | goto /mctb/voicemail | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Analytics | — | route load | goto /mctb/analytics | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE | Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings. |
| Setup overview | — | route load | goto /mctb/setup | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Phone | — | route load | goto /mctb/setup/phone | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Missed-call rules | — | route load | goto /mctb/setup/missed-call-rules | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Text back | — | route load | goto /mctb/setup/text-back | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Consent | — | route load | goto /mctb/setup/consent | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Recovery | — | route load | goto /mctb/setup/recovery | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Voicemail | — | route load | goto /mctb/setup/voicemail | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup Test | — | route load | goto /mctb/setup/test | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Consent log | — | route load | goto /mctb/compliance/consent | HTTP 200 | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup → Recovery | — | Pause 1 hour | n/a | control not visible | — | — | — | FAIL — UI |  |
| Recovery hub | exclusions | Add exclusion | add +15550119999 | http 400 | certTestPresent=false | row missing | exclusion count=0 | FAIL — PERSISTENCE |  |
| Setup → Text back | — | Platform template radio | n/a | workspace/custom sender mode | — | — | — | PASS — UI + PERSISTENCE | skipped — not platform multi-template |
| Missed Calls | — | Search | type "555" | typed | — | — | — | PASS — UI + PERSISTENCE |  |
| Missed Calls | — | Open detail | click first row | detail open | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup → Consent | — | Press-1 → Existing Consent + Save | select existing, attest, save | save OK | before=press_1 after persisted=existing_consent effective=existing_consent texml=voicemail | existing selected | voicemail | PASS — UI + PERSISTENCE + EFFECTIVE CONFIG |  |
| Setup → Consent | — | Existing Consent → Press-1 + Save (restore) | select press-1, save | save OK | effective=press_1 texml=press_1 | press-1 selected | press_1 | PASS — UI + PERSISTENCE + EFFECTIVE CONFIG |  |
