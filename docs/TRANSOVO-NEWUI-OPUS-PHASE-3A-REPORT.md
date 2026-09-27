# Opus Phase 3A — Missing whole surfaces (completion report)

Branch: `cursor/opus-phase3a-missing-surfaces-2304`

## Routes / surfaces created or wired (Stage 2)

| Surface | Route | Implementation |
|---------|-------|----------------|
| AI Receptionist editor | `/voice/receptionist/edit` | `NewUiVoiceReceptionistEditorPage` + shared editor hook/sections |
| MCTB setup workspace chrome | `/mctb/setup/*` layout | `MctbSetupWorkspaceLayout` (LinkTabs only; section bodies frozen) |
| Call routing / ingress (append-only) | `/voice/call-handling` | `OpusCallRoutingIngressPanel` after frozen Opus call-handling page |
| MCTB onboarding | `/onboarding/mctb` | `MctbOnboardingRuntime` `shell="opus"` |
| Consent history | `/mctb/compliance/consent` | `NewUiMctbConsentHistoryPage` |
| Number purchase | `/voice/numbers/buy` | `NewUiVoiceNumbersBuyPage` + `hidePageChrome` on premium search |
| Integrations hub + sub-routes | `/integrations/*` | `IntegrationsWorkspaceLayout`; directory stats + API/webhooks/logs Opus `Panel` wrappers |
| Settings (Business / Team / Billing) | `/settings/business`, `/settings/team`, `/settings/billing` | `SettingsWorkspaceLayout`; `hideChrome` on connected settings shells |

## Opus components reused (representative)

- **Shell:** `Page`, `PageHeader`, `Panel`, `LinkTabs`, `Stat`, `Pill`, `Rows`, `EmptyState`, `Button`, `ButtonLink`, Opus `Table`
- **Voice:** `TransplantVoiceCallHandlingPage` (unchanged), `CallHandlingSwitcher` inside ingress panel
- **MCTB:** Production wizard panels (`MctbPhoneForwardingPanel`, consent cards, recovery sections) inside Opus onboarding runtime

## Backend connected

| Surface | APIs / services |
|---------|-----------------|
| Receptionist editor | `GET /api/voice/agents`, `GET/POST /api/solutions/appointment-receptionist`, integrations calendars/connections, `POST /api/voice/tts-preview` |
| Setup chrome | Existing setup section pages (unchanged bodies) |
| Ingress panel | `GET /api/mctb/inbound-handling`, call-handling wizard state |
| Onboarding | `GET/POST /api/mctb/onboarding`, forwarding test, `POST /api/mctb/live-test` |
| Consent history | `GET /api/mctb/consent-log` |
| Numbers buy | `/api/numbers/premium/*`, checkout modal flow |
| Integrations | Existing server loaders + `IntegrationsHomeClient`, API keys/webhooks panels |
| Settings | `BusinessSettingsConnected`, `UsersSettingsConnected`, `BillingSettingsConnected` APIs |

## New production-specific components

| Component | Why |
|-----------|-----|
| `use-voice-receptionist-editor.ts` | Shared draft/publish logic for Opus editor vs legacy |
| `voice-receptionist-editor-sections.tsx` | Opus `Panel` section composition around production step editors |
| `call-routing-ingress-panel.tsx` | Append-only ingress surface (no legacy embed) |
| `setup-workspace-layout.tsx` | Shared MCTB setup tabs without touching section bodies |
| `integrations-workspace-layout.tsx` / `settings-workspace-layout.tsx` | Shared Opus chrome for shared nav routes |
| `mctb-onboarding-runtime.tsx` | Single onboarding state machine; `shell` legacy vs Opus chrome |
| `consent-history-page.tsx`, `numbers-buy-page.tsx`, `onboarding-page.tsx` | Route entry connected shells |

## Deferred / follow-up (not missing backend)

- **Premium number search UI:** Opus-native search/results layout (business logic uses existing premium client with `hidePageChrome`; inner search cards still legacy-styled until a dedicated Opus search composition is built).
- **Onboarding step bodies:** Opus shell/footer; several steps still use production MCTB wizard subcomponents and legacy step CSS inside panels.
- **Settings / integrations inner cards:** Kimi/legacy field cards remain for behavior; Opus provides page chrome and tabs only.
- **Integrations native/CRM sub-routes:** Opus layout tabs; client bodies unchanged (functional preservation).

## Preservation confirmation

- Existing Opus manifest page bodies were **not** redesigned except: receptionist summary **CTA hrefs only**; call-handling **append** ingress block **below** frozen content; MCTB setup **tabs-only** layout wrapper.
- No full legacy page/editor embedded as the final presentation for scoped net-new routes (editor uses Opus shell + sections; onboarding uses `shell="opus"`).
- Production backend/business logic reused; no sandbox demo customer data added.
- `newui/` sandbox tree untouched.
- Unrelated routes/features not added.
