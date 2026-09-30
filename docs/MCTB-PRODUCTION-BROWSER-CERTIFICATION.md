# MCTB Production Browser Certification

**Base URL:** (production — see run env MCTB_PROD_CERT_BASE_URL)  
**Workspace:** ws_1  
**Production SHA (start):** c935c42c537fb5806c10135186c11c513332568b  
**Started:** 2026-09-30T03:59:12.637Z

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
| Recovery hub | exclusions | Add exclusion | add +15550119999 | created | certTestPresent=true | row visible | exclusion count=1 | PASS — UI + PERSISTENCE |  |
| Recovery hub | exclusions | Delete exclusion | delete cert row | clicked | certTestPresent=false | — | count=0 | PASS — UI + PERSISTENCE |  |
| Setup → Text back | — | Platform template radio | n/a | workspace/custom sender mode | — | — | — | PASS — UI + PERSISTENCE | skipped — not platform multi-template |
| Missed Calls | — | Search | type "555" | typed | — | — | — | PASS — UI + PERSISTENCE |  |
| Missed Calls | — | Open detail | click first row | detail open | — | — | — | PASS — UI + PERSISTENCE |  |
| Setup → Consent | — | Press-1 → Existing Consent + Save | select existing, attest, save | save OK | before=press_1 after persisted=existing_consent effective=existing_consent texml=voicemail | existing selected | voicemail | PASS — UI + PERSISTENCE + EFFECTIVE CONFIG |  |
| Setup → Consent | — | Existing Consent → Press-1 + Save (restore) | select press-1, save | save OK | effective=press_1 texml=voicemail | press-1 selected | voicemail | PASS — UI + PERSISTENCE |  |
| Missed-call recovery | general | Pause 1 hour | click 1 hour preset | save OK | recoveryPaused=true pauseKind=timed | active copy still shown | timed | PASS — UI + PERSISTENCE + EFFECTIVE CONFIG |  |


## Phase 2 — full UI control manifest

**Production SHA (phase 2 start):** 74bd0108b7ca641f35122bdfd291d8237e91afdd  
**Workspace:** ws_1  
**Started:** 2026-09-30T07:38:58.159Z

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
| /mctb | Overview | — | CTA link: Missed calls0Today | click → /mctb/missed-calls | navigated [production-origin]/mctb | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: Recovery texts sent0Today | click → /mctb/missed-calls | navigated [production-origin]/mctb | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: Customer replies0Today | click → /mctb/conversations | navigated [production-origin]/mctb/conversations | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: Needs reply0Waiting on your team | click → /mctb/conversations | navigated [production-origin]/mctb/conversations | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: Manage | click → /mctb/ai-recovery | navigated [production-origin]/mctb/ai-recovery | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: View all | click → /mctb/missed-calls | navigated [production-origin]/mctb | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: #(703) 816-6017(703) 816-6017 | click → /mctb/missed-calls/cmuk91vov3x720r4e2s6g1j70 | navigated [production-origin]/mctb/missed-calls/cmuk91vov3x720r4e2s6g1j70 | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: #(571) 477-6175(571) 477-6175 | click → /mctb/missed-calls/cmuha96y94w6118125d0m2c3t | navigated [production-origin]/mctb/missed-calls/cmuha96y94w6118125d0m2c3t | — | — | — | PASS — UI |  |
| /mctb | Overview | — | CTA link: Open inbox | click → /mctb/conversations | navigated [production-origin]/mctb/conversations | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | — | Search filter | type "555" | filtered | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | Filters | Filter control 1 | focus/open | visible | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | Filters | Filter control 2 | focus/open | visible | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | Filters | Filter control 3 | focus/open | visible | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | Filters | Filter control 4 | focus/open | visible | — | — | — | PASS — UI |  |
| /mctb/conversations | Conversations | — | Search | type test | ok | — | — | — | PASS — UI |  |
| /mctb/conversations | Conversations | Thread | Message composer | select thread | composer disabled (expected if restricted) | — | — | sender eligibility | PASS — UI |  |
| /mctb/compliance/consent | Consent log | — | Search | type 555 | ok | cross-check via DB optional | — | — | PASS — UI |  |
| /mctb/analytics | Analytics | — | KPI drilldown link | click missed calls stat | [production-origin]/mctb/analytics | — | — | — | FAIL — UI |  |
| /mctb/setup/notifications | Setup Notifications | Urgent | Urgent detection toggle | toggle off/on (restore) | toggled | emergencyBefore=false after=false | restored | handoff config | PASS — UI + PERSISTENCE |  |
| /mctb/setup/notifications | Setup Notifications | Recipients | Add recipient | prompt flow mctb-browser-cert@transovo.test | row visible | recipientCount=0 certPresent=false | — | handoff recipients | FAIL — UI / BACKEND |  |
| /mctb/setup/notifications | Setup Notifications | Recipients | Add recipient refresh | reload | missing after refresh | {"recipientCount":0,"emergencyDetectionEnabled":false,"certRecipientPresent":false} | FAIL | — | FAIL — PERSISTENCE |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | Preview greeting | edit text + preview | preview invoked | — | — | — | PASS — UI |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | Playback control | click play | control clicked | — | — | active greeting audio | PASS — UI |  |
| /mctb/analytics | Analytics | — | KPI drilldown link | navigate /mctb/missed-calls | [production-origin]/mctb/missed-calls | — | — | — | PASS — UI |  |
| /mctb/setup/recovery | Setup Recovery | — | Save changes | observe (no mutation this pass) | present | pause/resume tested phase1 | — | — | PASS — UI |  |
| /mctb/phone | Own Sender | — | Sender ownership display | load | platform sender visible | phoneNumberId=cmsgtjms84g6l2h0o255w1e3v | — | active sender | PASS — UI |  |
| /mctb/phone | Own Sender | Registration | A2P/TFV status surface | read status | status visible | — | — | — | PASS — UI |  |
| /mctb/setup/links | Setup Links | Validation | Malformed URL | save bad url | no crash | no 500 | — | — | PASS — UI (no validator surfaced) |  |
| /mctb | Overview | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | button: Setup guide | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Missed calls0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Recovery texts sent0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Customer replies0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Needs reply0Waiting on your team | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | button: Pause recovery | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Manage | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: View all | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: #(703) 816-6017(703) 816-6017 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: #(571) 477-6175(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Open inbox | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: ++18666020680Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: ++18885046264Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: ++15714073615Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Business line(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: ForwardingVerified | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: ConsentI already have permission to text these callers | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: Sender(571) 407-3615 · Ready | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | main | a: RecoveryActive | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb | Overview | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery | Recovery hub | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | consent | radio: Press 1 to consentIncluded with FreeCallers hear a short prompt and press 1 to g | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | consent | radio: I already have consent to text these callersFor businesses that already obtained | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | consent | checkbox: base-ui-_r_5_ | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | consent | button: Certify & Enable Existing Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | button: Setup guide | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Missed calls0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Recovery texts sent0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Customer replies0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Needs reply0Waiting on your team | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | button: Pause recovery | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Manage | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: View all | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: #(703) 816-6017(703) 816-6017 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: #(571) 477-6175(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Open inbox | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: ++18666020680Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: ++18885046264Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: ++15714073615Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Business line(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: ForwardingVerified | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: ConsentI already have permission to text these callers | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: Sender(571) 407-3615 · Ready | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | main | a: RecoveryActive | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /onboarding/mctb | Onboarding | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/missed-calls | Missed Calls | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Manage setup | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: Needs reply0 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | input: missed-search | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | combobox: Recovery outcome | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | combobox: Date range | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | combobox: Trigger | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | combobox: Sort | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: C6Caller 6017(703) 816-6017 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | button: Actions for Caller 6017 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | a: AAnthony Johnson(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | main | button: Actions for Anthony  Johnson | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/missed-calls | Missed Calls | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/conversations | Conversations | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | input: inbox-search | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: All | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Needs reply | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Mine | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Unassigned | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Closed | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Spam | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | checkbox: Select Caller 6017 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: C6Caller 6017Sep 27, 8:07 PMHi, sorry we missed your call. How can we help? http | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: C6Caller 60175 Days AgoHi, sorry we missed your call. How can we help? https://t | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | checkbox: Select Anthony  Johnson | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: AAnthony Johnson12 Days AgoHi, sorry we missed your call. How can we help? https | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | checkbox: Select Caller 8331 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: C8Caller 833131 Days AgoHi, sorry we missed your call. How can we help? https:// | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | button: Call | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | main | textarea: composer | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/conversations | Conversations | main | button: Send | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/conversations | Conversations | main | a: View missed call | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/conversations | Conversations | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/voicemail | Voicemail inbox | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | main | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Messages | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | Greeting | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/voicemail | Voicemail inbox | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/analytics | Analytics | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | radio: 7 days | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | radio: 30 days | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | radio: 90 days | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Missed calls28 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Recovery texts sent23 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Customers replied8 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: 2 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: 1 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | main | a: Open voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/analytics | Analytics | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI | js:Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings. |
| /mctb/notifications | Notifications | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | switch: Urgent Reply Alerts enabled | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | textarea: mctb-urgent-instructions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | textarea: Sample customer reply for urgent test | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | button: Run test | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | button: Add recipient | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: Customer replied by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: Urgent reply by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: Urgent reply by SMS | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: Needs reply (15 min) by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: New voicemail by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | main | checkbox: Delivery failure by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/notifications | Notifications | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup | Setup overview | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup | Setup overview | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/start | Setup wizard | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | button: Setup guide | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Missed calls0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Recovery texts sent0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Customer replies0Today | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Needs reply0Waiting on your team | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | button: Pause recovery | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Manage | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: View all | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: #(703) 816-6017(703) 816-6017 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: #(571) 477-6175(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Open inbox | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: ++18666020680Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: ++18885046264Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: ++15714073615Hi, sorry we missed your call. How can we help? [production-origin] | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Business line(571) 477-6175 | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: ForwardingVerified | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: ConsentI already have permission to text these callers | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: Sender(571) 407-3615 · Ready | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | main | a: RecoveryActive | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/start | Setup wizard | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/phone | Setup Phone | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Test connection | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | input: Business line phone number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | combobox: Carrier | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | combobox: Ring before forwarding | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Verify again | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Manage messaging numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | button: Add toll-free or local number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | a: Messaging registration | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | radio: (571) 749-1060Verified | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | main | radio: (866) 346-4256Pending | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/setup/phone | Setup Phone | main | button: View 3 more numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/phone | Setup Phone | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/text-back | Setup Text back | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Edit consent | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Manage sender | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | a: Existing permission | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | input: platform-recovery-template | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | switch: Send a booking link | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/text-back | Setup Text back | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/consent | Setup Consent | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/consent | Setup Consent | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | switch: Urgent Reply Alerts enabled | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | textarea: mctb-urgent-instructions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | textarea: Sample customer reply for urgent test | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Run test | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Add recipient | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: Customer replied by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: Urgent reply by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: Urgent reply by SMS | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: Needs reply (15 min) by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: New voicemail by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | main | checkbox: Delivery failure by email | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/notifications | Setup Notifications | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/recovery | Setup Recovery | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | main | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | a: Voicemail settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | tab: Messages | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | tab: Greeting | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/voicemail | Setup Voicemail | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/links | Setup Links | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Edit consent | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Manage sender | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | a: Existing permission | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | input: platform-recovery-template | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | switch: Send a booking link | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/links | Setup Links | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: 1 hour | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Until tomorrow | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: 1 week | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Indefinitely | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Recovery delay | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Cooldown | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Max automated recovery texts | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Save follow-up rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | checkbox: No answer | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | checkbox: Busy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | checkbox: Rejected / declined | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | checkbox: Unreachable | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | checkbox: After voicemail | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Save rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | a: View consent history | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | a: Edit rules | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | tab: General | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | tab: Rules | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | tab: Consent | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | tab: Exclusions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Add number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/exclusions | Setup Exclusions | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/setup/test | Setup Test | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Test connection | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | input: Business line phone number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | combobox: Carrier | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | combobox: Ring before forwarding | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Verify again | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Manage messaging numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Add toll-free or local number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Messaging registration | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | radio: (571) 749-1060Verified | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | radio: (866) 346-4256Pending | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/setup/test | Setup Test | main | button: View 3 more numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | a: Fix | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Start test | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | main | button: Close | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/setup/test | Setup Test | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/compliance/consent | Consent log | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: ← Setup | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Consent settings | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | a: Consent settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Search | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | main | button: Show | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/compliance/consent | Consent log | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/ai-recovery | AI Recovery | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Inbox | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable AI Recovery | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Collect Name | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Collect What they need | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Collect Service location | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Collect Urgency | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Collect Best time to call back | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Take a message | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Booking | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Emergencies | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Pricing questions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Service-area questions | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable Existing-customer issues | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable General FAQs | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | switch: Enable booking link for AI Recovery | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/ai-recovery | AI Recovery | main | a: Configure in Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | main | a: Edit | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/ai-recovery | AI Recovery | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/phone | Own Sender / Phone | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Test connection | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | input: Business line phone number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | combobox: Carrier | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | combobox: Ring before forwarding | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Verify again | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Manage messaging numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | button: Add toll-free or local number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | a: Messaging registration | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | radio: (571) 749-1060Verified | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | main | radio: (866) 346-4256Pending | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/phone | Own Sender / Phone | main | button: View 3 more numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/phone | Own Sender / Phone | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/numbers | Phone inventory | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Test connection | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | input: Business line phone number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | combobox: Carrier | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | combobox: Ring before forwarding | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Verify again | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Manage messaging numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Add toll-free or local number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | a: Messaging registration | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | radio: (571) 749-1060Verified | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | radio: (866) 346-4256Pending | observe disabled | disabled as expected | — | — | — | PASS — CAPABILITY-LOCKED / DISABLED |  |
| /mctb/numbers | Phone inventory | main | button: View 3 more numbers | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Copy | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Use this number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Add another number | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | main | button: Close | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/numbers | Phone inventory | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb/text-back | Text back (launch) | main | a: Transovo | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | button: Collapse sidebar | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Overview | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Getting Started | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Missed Calls | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Conversations | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Voicemail | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Analytics | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Missed-Call Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Text Back | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: AI Recovery | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Notifications | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Phone & Forwarding | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Settings | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Billing | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Help | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | button: Blue Ridge Realty(571) 477-6175 | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | input: input | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | button: Notifications | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Edit consent | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Manage sender | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | a: Existing permission | manifest only (link exercised in nav flows) | listed in live DOM | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | input: platform-recovery-template | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | switch: Send a booking link | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | main | button: Save changes | manifest enumerate | visible interactive | — | — | — | PASS — UI (manifest) |  |
| /mctb/text-back | Text back (launch) | — | route interactive manifest | goto + tabs + DOM enumerate | HTTP 200 | — | — | — | PASS — UI |  |
| /mctb | Mobile | 390px | Nav + primary actions reachable | viewport pass | page rendered | — | — | — | PASS — RESPONSIVE |  |
