# Smart Routing — UI Coverage Matrix

**Date:** 2026-08-23  
**Pass:** Customer UI completion on existing Smart Routing pages.

| Feature | Backend | UI location | Customer can use? | Action |
|---------|---------|-------------|-------------------|--------|
| Public business number | Working | `/smart-routing/setup` §1, overview status card | Yes | Extended |
| Routing DID | Working | Setup §2, overview status card (“Routing number”) | Yes | Extended |
| Caller-ID verification | Working | `CallerIdVerificationPanel` on setup | Yes | Added |
| Authorized callback users | Working | `AuthorizedCallersPanel` on setup | Yes | Extended |
| Callback PIN | Working | Add / reset PIN in authorized callers panel | Yes | Added |
| Call-through | Working | `BusinessCallbackGuide` on setup | Yes | Added |
| Latest missed call callback | Working | Phone menu (Press 1) — documented in guide | Yes (phone) | Documented |
| Latest voicemail callback | Working | Guide Press 2 | Yes (phone) | Documented |
| Callback-request callback | Working | Guide Press 3 | Yes (phone) | Documented |
| Manual outbound number | Working | Guide Press 4 + test card on setup | Yes | Added |
| Menu / DTMF | Working | `/smart-routing/new`, `/[flowId]` builder | Yes | Preserved |
| Sequential ring | Working | Flow builder ring groups | Yes | Preserved |
| Simultaneous ring | Working | Flow builder ring groups | Yes | Preserved |
| Business hours | Working | Flow builder + schedule engine | Yes | Preserved |
| Close Now | Working | `CloseNowControl` on overview + setup | Yes | Added |
| Call Gate | Working | Template on `/smart-routing/new` | Yes | Preserved + icon |
| Voicemail | Working | Flow builder | Yes | Preserved |
| MCTB fallback | Working | Flow builder fallback nodes | Yes | Preserved |
| Activity | Working | `/[flowId]/activity` + outbound rows | Yes | Extended |
| Analytics | Working | Overview status + `/api/smart-routing/analytics` | Partial | Extended |
| Forwarding instructions | Working | `ForwardingSetupPanel` | Yes | Added |
| Forwarding test | Working | Setup forwarding panel + session detection | Yes | Added |
| Destinations | Working | `DestinationsPanel` on setup | Yes | Added |
| Setup readiness | Working | `SetupStepper` + setup API `readiness` | Yes | Added |
| Temporary routing override (per-destination) | Not implemented | — | No | Documented — not built |
| Dashboard click-to-call callback | Not implemented | Activity shows outbound only | Phone path required | Documented |

## Pages changed

| Route | Changes |
|-------|---------|
| `/smart-routing` | Status cards, Close Now, workspace setup/analytics fetch |
| `/smart-routing/setup` | Full stepper, verification panel, forwarding, destinations, callback, tests |
| `/smart-routing/new` | Call Gate template icon |
| `/smart-routing/[flowId]/activity` | Incoming/outgoing filters, business callback rows |
| `/smart-routing/[flowId]/test` | Preserved (links to setup for callback test) |

## New components

- `overview-status-section.tsx`
- `close-now-control.tsx`
- `caller-id-verification-panel.tsx`
- `authorized-callers-panel.tsx`
- `forwarding-setup-panel.tsx`
- `business-callback-guide.tsx`
- `setup-stepper.tsx`
- `destinations-panel.tsx`

## Reused components

- `shared.tsx` (SrPageShell, cards, buttons)
- `setup-view.tsx` (shell, restructured)
- `overview-view.tsx` (flow table preserved)
- `builder-view.tsx`, `audio-view.tsx`, `test-view.tsx`

## Remaining manual steps (customer)

- Carrier forwarding dial codes on their phone
- Live Telnyx caller-ID verification on real business line
- PSTN tests 1–5 (see `docs/smart-routing-forwarding-metadata-audit.md`)

## Remaining production tests

1. Public number → forward → routing DID → menu; ANI preserved  
2. Employee → routing DID → PIN → outbound shows verified business number  
3. Real Telnyx verified-number on external line  
4. Smart Routing + MCTB no-answer → MCTB  
5. Smart Routing only no-answer → configured fallback  
