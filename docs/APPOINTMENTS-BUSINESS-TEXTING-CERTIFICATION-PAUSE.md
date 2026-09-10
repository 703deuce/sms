# Appointments — Certification Pause (Business Texting Expansion)

**Effective:** 2026-09-10  
**Authority:** Product scope expansion — Business Texting Phase 1

## Status: PAUSED

Final master browser certification (8H-1), final visual tightening, and production polish for Appointments are **paused** until Business Texting absorption is complete and reconciled.

**Do not** resume master UAT or treat the 308-row closed inventory as frozen scope.

## What is paused

| Workstream | Branch / artifact | Action |
|------------|-------------------|--------|
| Master browser UAT | `cursor/batch8h1-master-browser-cert-709b`, PR #368 | Hold at current progress (~39/229 journeys) |
| Final polish pass | Theme rollout PR #369 | May continue in parallel for non-campaign surfaces; campaign surfaces restyle under Business Texting work |
| Closed inventory sign-off | `docs/APPOINTMENTS-MASTER-BROWSER-CERTIFICATION.md` | Do not mark complete |

## What continues

1. Business Texting absorption audit and implementation (this workstream)
2. Bug fixes that block Business Texting or break existing Appointments/MCTB runtime
3. Documentation updates for expanded V1 scope (`docs/APPOINTMENTS-BUSINESS-TEXTING-V1-SCOPE.md`)

## Resume criteria

Resume final certification when **all** Business Texting completion gates pass:

### Contacts gate

- Booking-created and imported contacts share one canonical system
- Manual create, CSV import, segments work
- Campaigns consume both contact sources
- No separate SMS Contacts workflow required
- STOP/suppression honored

### Campaigns gate

- `/appointments/campaigns` under Messages nav with Appointments shell
- List, create, audience, composer, templates, send/schedule, review, attestation
- Approved Business Texting sender required for send
- Real runtime sends; results; replies in Inbox; opt-outs suppressed

### Visual gate

- Campaigns uses Appointments design system (not legacy SMS shell)

### Scope gate

- No accidental restoration of old SMS product areas (Dashboard, Grow, Drips, etc.)

## Sign-off

When gates pass, update this document with resume date and link to reconciliation PR.
