# MCTB Simplified Launch — FAQ / Approved Information Closure

**Branch:** `cursor/mctb-simplified-launch-2304`  
**Baseline:** `40b49edbcdad8b13d470b65546ab31650d9bc90e`  
**Draft PR:** #484

## 1. Approved business information source

**Selected:** Shared workspace **Company Brain** via `loadBusinessBrain(workspaceId)` from `src/lib/agents/appointment-booking/business-brain.ts`, wrapped by `loadMctbApprovedBusinessInformation()` in `src/lib/mctb/approved-business-information.ts`.

**Includes:** `workspace.customFieldsConfig.businessBrain` (approved `knowledgeFacts`, `businessHoursSummary`, locations), plus workspace service names from `voiceService` (operational catalog, not agent runtime).

**Excludes:** Voice agent id, `voiceAgentKnowledgeBase`, `voiceKnowledgeSource` RAG, Voice V3 file search, published agent versions, LiveKit/GPT-Live/Sol.

## 2. Launch profile changes

- `defaultLaunchEnabledScenarios()` → `general_faq: true` (only added scenario for FAQ).
- `launchFaqIntentPolicyOverrides()` → `BUSINESS_HOURS`, `BUSINESS_FAQ`, `SERVICE_AREA_CHECK`, `BUSINESS_LOCATION` → `ANSWER_APPROVED_INFORMATION`.
- `LAUNCH_ACTION_CAPABILITIES` includes `ANSWER_APPROVED_INFORMATION` (still excludes `AI_BOOK`).

## 3. Semantic context

`buildMctbSemanticConversationContext()` loads approved business information **only when** `leadRecovery.enabled` and adds `approved_business_information` to context and intent agent payload.

## 4. ANSWER_APPROVED_INFORMATION

`executeLeadRecoveryActions` → `generateApprovedInformationSmsReply()`:

1. Deterministic grounding (hours summary, service name match, knowledge fact labels).
2. Optional LLM (`mctbSemanticStructuredJson`) constrained to `prompt_block` only.
3. Safe fallback from `faqPolicy.fallback` when not grounded.

## 5. Behavioral tests

`scripts/test-mctb-launch-approved-faq.ts` — hours, services, unknown, booking → `SEND_BOOKING_LINK`, `AI_BOOK` blocked, STOP ordering, semantic context wiring.

## 6. Regression

All listed scripts **PASS** + new FAQ script. `verify:mctb-final-pipeline` reference env failure unchanged.

## 7. Verdict

**READY FOR PRODUCT REVIEW / MERGE DECISION**
