# MCTB final commercial launch pass

**Status:** IN PROGRESS — finish line for commercially launch-ready MCTB (excluding public marketing/landing and per-customer carrier approval wait).

**Evidence matrix:** `docs/MCTB-FINAL-PRODUCT-FUNCTIONALITY-GAPS.md` (convert rows to COMPLETE | EXTERNAL_APPROVAL_PENDING | BLOCKED only when proven).

**Frozen:** Pure Opus shell, `mctb_texml_final_v1`, both consent branches, existing runtime/Telnyx/Brevo/Stripe paths — extend, do not rebuild.

## Central architecture (this pass)

| Concern | Authoritative module |
|--------|----------------------|
| Capabilities (tiers) | `src/lib/mctb/capabilities.ts` — `resolveMctbCapabilities()` |
| Free 25 recoveries / month | `src/lib/mctb/recovery-usage.ts` — `MCTB_RECOVERY` unit at send reserve |
| Platform templates | `src/lib/mctb/platform-message-templates.ts` |
| Existing Consent certification copy | `src/lib/mctb/existing-consent-certification-copy.ts` + `capture/attestation.ts` |
| Urgent / notifications | landed handoff stack (single pass) |
| 10DLC retail vs Telnyx cost | Stripe/catalog config — do not hard-code $4.50+$15 wholesale in runtime |

## Product tiers (behavioral contract)

- **Free:** Press-1, platform sender, locked templates, 25 `MCTB_RECOVERY`/month, Brevo caller-replied email, no Existing Consent / urgent / booking / AI / own sender.
- **Recovery paid:** higher recovery allowance, Existing Consent + certification, booking links, urgent email/SMS, still platform sender policy.
- **AI Recovery:** conversational AI (separate from urgent classification).
- **Own sender add-on:** TFN/10DLC lifecycle; platform sender stays active while pending; verified own sender unlocks custom templates + manual two-way.

## Certification sections (38 matrix)

Sections 0–40 from the launch instruction map to evidence rows in the gaps doc. **Within our control:** implement, test, set status COMPLETE with records. **Carrier TFV/10DLC:** EXTERNAL_APPROVAL_PENDING when product workflow is proven but approval is outstanding.

## Deploy discipline

Push → Coolify green → `/api/health` commit match → then functional/browser proof. Do not certify stale production.

## Automated guards (extend as behavior lands)

```bash
npx tsx scripts/test-mctb-capabilities-resolver.ts
npx tsx scripts/test-mctb-urgent-handoff-guards.ts
npx tsx scripts/test-mctb-caller-replied-inbound-path.ts
npm run verify:mctb-stage2-presentation
```
