# Phase 3A complete — Integrations remainder (copy-friendly)

Branch: `cursor/opus-phase3a-missing-surfaces-2304`  
Commit: `e0e37e32`  
PR: https://github.com/703deuce/sms/pull/544  

---

## Summary

Finished the remaining Integrations Stage 2 presentation pass: eight route bodies converted to Opus-native components, calendar visual seam removed, visual-boundary audit at **0 / 0**. Did **not** start existing-page parity/fill work.

---

## Converted routes (8)

| Route | Stage 2 component |
|--------|-------------------|
| `/integrations/crm/[provider]` | `CrmProviderOpus` |
| `/integrations/crm/pipeline` | `CrmPipelineOpus` |
| `/integrations/native/tasks` | `NativeTasksOpus` |
| `/integrations/native/orders` | `NativeOrdersOpus` |
| `/integrations/native/appointments` | `NativeAppointmentsOpus` |
| `/integrations/native/audit` | `NativeAuditOpus` |
| `/integrations/native/ai-policy` | `NativeAiPolicyOpus` |
| `/integrations/native/[provider]` | `NativeProviderOpus` |

Each `page.tsx` gates on `isNewUiStage2Enabled()`; legacy `*Client` components remain on the non–Stage 2 path with the same APIs and behavior.

---

## Calendar visual seam

- **Before:** `platform-integrations-opus.tsx` embedded `CalendarIntegrationsCard` (legacy/shadcn inside Opus Panel).
- **After:** Renders `CalendarIntegrationsOpus` from `src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx` (same calendar OAuth/API behavior; Opus `Panel` / transplant `Button`).

---

## New / updated files (this pass)

### New Opus presentation modules
- `src/newui-transplant/connected/integrations/native-tasks-opus.tsx`
- `src/newui-transplant/connected/integrations/native-orders-opus.tsx`
- `src/newui-transplant/connected/integrations/native-audit-opus.tsx`
- `src/newui-transplant/connected/integrations/native-ai-policy-opus.tsx`
- `src/newui-transplant/connected/integrations/native-appointments-opus.tsx`
- `src/newui-transplant/connected/integrations/native-provider-opus.tsx`
- `src/newui-transplant/connected/integrations/crm-pipeline-opus.tsx`
- `src/newui-transplant/connected/integrations/crm-provider-opus.tsx`
- `src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx`

### Wired pages (Stage 2 gate)
- `src/app/(app)/integrations/native/tasks/page.tsx`
- `src/app/(app)/integrations/native/orders/page.tsx`
- `src/app/(app)/integrations/native/audit/page.tsx`
- `src/app/(app)/integrations/native/ai-policy/page.tsx`
- `src/app/(app)/integrations/native/appointments/page.tsx`
- `src/app/(app)/integrations/native/[provider]/page.tsx`
- `src/app/(app)/integrations/crm/pipeline/page.tsx`
- `src/app/(app)/integrations/crm/[provider]/page.tsx`

### Other
- `src/newui-transplant/connected/integrations/platform-integrations-opus.tsx` — `CalendarIntegrationsOpus` instead of `CalendarIntegrationsCard`
- `src/app/(app)/integrations/crm/[provider]/crm-onboarding-wizard.tsx` — optional `presentation="opus"` with Opus `Panel` shell when opened from `CrmProviderOpus`

---

## Visual boundary audit (required result)

**Remaining scoped places where Opus workspace/layout wraps a legacy/Kimi presentation body: 0**

**Remaining embedded legacy/Kimi presentation components inside otherwise Opus-native Phase 3A surfaces: 0**

Checks run:
- All eight routes have `isNewUiStage2Enabled()` gates.
- No `CalendarIntegrationsCard`, `IntegrationsHomeClient`, Kimi, or `@/components/ui/card` / `page-header` imports under `src/newui-transplant/connected/integrations/`.
- No `CalendarIntegrationsCard` under `src/newui-transplant/`.

Artifact (if present on agent VM): `/opt/cursor/artifacts/phase3a-visual-boundary-audit.txt`

---

## Preserved (not redone)

- Number purchase (`/voice/numbers/buy`)
- MCTB onboarding (`/onboarding/mctb` opus shell)
- Settings Business / Team / Billing
- Already-converted integration routes (home, API, webhooks, logs, native list, CRM list, native leads, etc.)
- Receptionist editor, Consent History, MCTB Setup chrome, Call Handling
- Frozen original Opus pages
- `newui/` sandbox (untouched)

---

## Rules followed

- Preserve backend/business logic; separate presentation on Stage 2 path only.
- Do not wrap legacy client inside Opus Panel only.
- Do not begin existing-page parity/fill phase.
- Existing Opus freeze: no redesign or relocation of frozen Opus content.

---

## Commit message (reference)

```
Finish Phase 3A integrations Opus bodies and calendar seam

Convert the eight remaining Integrations Stage 2 routes to Opus-native
presentation components while preserving existing APIs and client logic
on the legacy path.

Replace CalendarIntegrationsCard embed in platform integrations manage
with CalendarIntegrationsOpus. Wire CRM onboarding wizard Opus shell when
shown from CrmProviderOpus.
```

---

## Next step (out of scope for this pass)

Append missing functionality under pages Opus already built (parity/fill list) — **not started**.
