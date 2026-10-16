# AI Receptionist — configuration tracing report (generated)

Generated field count (top-level): **111**

## activate

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `activationMode` | no | no | no | — |
| `scheduledAt` | no | no | no | — |

## appointments

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `appointmentTypes` | yes | no | no | — |
| `bookingBehavior` | yes | no | no | receptionistCompiled.bookingBehavior |
| `bookingLinkLabel` | no | no | no | — |
| `bookingLinkSmsConsentRequired` | no | no | no | — |
| `bookingLinkUrl` | yes | no | yes | — |
| `bookingStrategy` | yes | no | no | receptionistCompiled.bookingStrategy / enabledBuiltinTools |
| `calendarConnected` | yes | yes | no | — |
| `calendarEmail` | no | no | no | — |
| `calendarProvider` | yes | yes | no | — |
| `calendlyEventTypeDurationMin` | no | no | no | — |
| `calendlyEventTypeName` | no | no | no | — |
| `calendlyEventTypeUri` | yes | yes | no | — |
| `calendlyTimezone` | no | no | no | — |
| `collectFields` | yes | no | no | receptionistCompiled.fieldManifest |
| `qualificationEnabled` | yes | no | no | — |
| `qualificationNeedsReviewFallback` | no | no | no | — |
| `qualificationNotQualifiedFallback` | no | no | no | — |
| `qualificationRequiredBeforePrimaryAction` | no | no | no | — |
| `qualificationRevision` | no | no | no | — |
| `qualificationRules` | yes | no | yes | — |
| `qualificationRulesMatchMode` | no | no | no | — |
| `qualificationSupportedZipCodes` | no | no | no | — |
| `selectedAppointmentTypeId` | no | no | no | — |

## call-handling

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `afterHoursNotificationEvents` | no | no | no | — |
| `afterHoursNotificationRecipients` | no | no | no | — |
| `aiCallRecoveryConsentMode` | no | no | no | — |
| `aiCallRecoveryContinueOverSms` | no | no | no | — |
| `aiCallRecoveryDelaySeconds` | no | no | no | — |
| `aiCallRecoveryEnabled` | yes | no | no | — |
| `aiCallRecoverySendingPhoneNumberId` | no | no | yes | — |
| `aiCallRecoverySendWhenCallbackCreated` | no | no | no | — |
| `allowCallerRequestedTransfer` | no | no | no | — |
| `callbackAskPreferredTime` | no | no | no | — |
| `callbackConfirmNumber` | no | no | no | — |
| `callbackRequestsEnabled` | yes | no | no | — |
| `callbackRequiredCollectFieldIds` | no | no | no | — |
| `callbackUseAniByDefault` | no | no | no | — |
| `defaultTransferPlanId` | no | no | no | — |
| `detectVoicemailOnTransfer` | no | no | yes | — |
| `operatingMaturity` | yes | no | no | — |
| `salesSolicitationAction` | no | no | no | — |
| `salesSolicitationEnabled` | no | no | no | — |
| `solicitorPolicy` | yes | no | no | — |
| `spamLikelyPolicy` | yes | no | no | — |
| `transferDestinationName` | no | no | no | — |
| `transferDestinationPhone` | yes | no | yes | receptionistCompiled.transferPolicy |
| `transferDestinations` | yes | no | no | — |
| `transferFallback` | no | no | no | — |
| `transferPlanSteps` | yes | no | no | — |
| `transferRingSeconds` | no | no | no | — |
| `transferRouting` | yes | no | no | — |
| `transferTriggers` | yes | no | no | — |
| `urgencyEnabled` | no | no | no | — |
| `urgencyRules` | no | no | no | — |
| `voiceV2HumanTransferEnabled` | yes | no | no | — |
| `warmTransfer` | yes | no | no | — |

## goals

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `answerWhen` | yes | no | no | — |
| `capabilities` | yes | no | no | receptionistCompiled.capabilities |
| `outcomeSlug` | no | no | no | — |
| `preset` | no | no | no | — |
| `solutionName` | no | no | no | — |

## information

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `agentName` | yes | no | no | receptionistCompiled.agentDisplayName |
| `businessName` | no | no | no | — |
| `conversationBehaviors` | yes | no | no | — |
| `crmEnabled` | no | no | no | — |
| `guardrails` | yes | no | yes | — |
| `knowledgeBaseEnabled` | yes | no | no | — |
| `knowledgeBaseRevision` | no | no | no | — |
| `knowledgeItems` | no | yes | yes | — |
| `knowledgeSource` | no | no | no | — |
| `language` | yes | no | no | — |
| `linkedKnowledgeBaseId` | yes | yes | no | — |
| `longTermMemory` | no | no | no | — |
| `openingGreeting` | yes | no | yes | receptionistCompiled.greeting |
| `role` | no | no | no | — |
| `speakingStyle` | no | no | no | — |
| `speaksFirst` | no | no | no | — |
| `timezone` | no | no | no | — |
| `tone` | no | no | no | — |
| `websiteUrl` | yes | yes | yes | — |

## meta

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `agentId` | no | no | no | — |
| `setupId` | no | no | no | — |
| `telnyxAssistantId` | no | no | no | — |

## phone

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `callRecording` | yes | no | no | — |
| `connectionGreeting` | yes | no | yes | Telnyx connection greeting (publish) |
| `connectionGreetingAudioUrl` | no | no | yes | — |
| `connectionGreetingText` | yes | no | yes | — |
| `numberSource` | no | no | no | — |
| `outboundSmsE164` | no | no | yes | — |
| `outboundSmsMode` | no | no | no | — |
| `outboundSmsPhoneNumberId` | no | no | yes | — |
| `phoneNumberE164` | no | no | yes | — |
| `phoneNumberId` | yes | yes | no | TriggerDeployment / inbound routing |
| `ringBehavior` | yes | no | no | — |
| `ringTeamSeconds` | no | no | no | — |

## test

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `lastTestPassed` | no | no | no | — |
| `testScenario` | no | no | no | — |

## voice

| Field | Runtime | External processing | Sensitive | Runtime mapping |
|-------|---------|---------------------|-----------|------------------|
| `backchannelLevel` | no | no | no | — |
| `callerPausePatience` | no | no | no | — |
| `interruptionSensitivity` | no | no | no | — |
| `interruptionStyle` | no | no | no | — |
| `openAiCustomVoiceId` | no | no | no | — |
| `responsiveness` | no | no | no | — |
| `speakingPace` | yes | no | no | — |
| `speakingSpeed` | no | no | no | — |
| `voiceAccent` | no | no | no | — |
| `voiceId` | yes | no | no | realtime.voiceId / GPT-Live voice |
| `voiceLabel` | no | no | no | — |
| `voiceSource` | no | no | no | — |

## Known gaps (manual)

1. **Nested array fields** (appointment types, transfer destinations, qualification rules) — traced via flatten paths; registry metadata is leaf-oriented.
2. **Behavioral proof** — tool invoke / booking success not logged here; use call/tool traces.
3. **Operational pages** (`/voice/knowledge`, `/voice/call-handling`) — use same API trace headers when extended; editor uses wizard POST today.
4. **Draft save side effects on master** — non-lightweight steps may still run hooks/live sync; tracing flags `UNEXPECTED_LIVE_EFFECT` until lifecycle ADR is fully deployed.
5. **Published snapshot verification** — post-publish diff compares wizard snapshots on VoiceAgentVersion config when present.
