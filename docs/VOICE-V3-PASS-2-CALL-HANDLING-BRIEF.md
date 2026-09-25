# Voice V3 Pass 2 — Product surface architecture (operator brief)

**Status:** In progress on `cursor/voice-v3-pass-2-call-handling-2304`  
**Pass 1:** Closed — do not run another feature-completeness audit or polish Pass 1.

## Ordering

1. Merge Pass 1  
2. **Pass 2** (this pass) — operational UI over existing persisted wizard config  
3. **Pass 3** — PSTN certification on the finished product  

Do not certify transfers on wizard-only UI, then immediately move configuration to Call Handling.

## Objective (summary)

Expose what we already built. **No** second transfer/on-call/hours model. **No** runtime rewrite.

- Wizard = guided onboarding  
- **Call Handling** (`/voice/call-handling`) = durable operational home for transfers, on-call, hours relationship, emergency/urgency, notifications, caller protection, recent transfer outcomes  
- Same `POST /api/solutions/appointment-receptionist` + `wizardStepId: "call-handling"` persistence as wizard  
- Preserve Pass 1: knowledge gaps, `/voice/analytics`, needs-attention failed transfers  
- Nav updates **after** surfaces exist  

Full operator prompt (sections 1–28, report template §A–H) is in the product completion thread / Pass 2 kickoff message. Implementation report: `docs/VOICE-V3-PASS-2-CALL-HANDLING-REPORT.md`.

## Change discipline

Read existing implementation first. Reuse editors. No MCTB changes. No live Telnyx experiments. No MS FIND/BOOK changes.
