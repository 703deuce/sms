# MCTB wizard — reused AI Receptionist patterns

**Quality bar:** `src/components/receptionist/` (voice/agents guided setup).

This document lists which receptionist wizard primitives MCTB reuses. Do not recreate weaker approximations — import from the sources below.

| Receptionist source | MCTB usage |
|---------------------|------------|
| `WizardPageLayout` (`receptionist/ui.tsx`) | Main + sticky aside on Phone, Consent, Text Back, Test steps |
| `WizardPageHeader` | Step identity (icon, H1, subtitle) on guided steps |
| `WizardQuestionBlock` | Numbered question sections inside a step (carrier, ring timing, message editor) |
| `WizardFooter` | Coherent Back / Continue / Save control row |
| `SelectableCard` | Consent mode, carrier, greeting source — replaces plain radios/selects |
| `TimingOptionRow` | Walk-me-through vs show-instructions forwarding modes |
| `SidePanel` / `AboutNextPanel` pattern | “What happens next” + verification status rails |
| `WizardTextareaField` | Recovery opener composer (shell + optional hints) |
| `ReceptionistFlowStepper` pattern | `MctbFlowStepper` — numbered progress with done/active states |
| `AboutNextPanel` + `WizardFieldLabel` grid | `MctbBusinessIdentityStep` — identity fields + SMS preview rail |
| `SelectableCard` (multi-select toggle) | `MctbTriggerRuleCards` — missed-call rule outcomes |
| Verification timeline pattern | `MctbVerificationTimeline`, `MctbMessagingActivationPanel` |

**CSS:** `product-theme.css` classes (`.wizard-question-block`, `.wizard-rail-card`, `.wizard-rail-card-tinted`) — same as receptionist.

**Not copied:** Receptionist product content, capability cards, voice-test LiveKit UI, agent compile pipeline.
