# Settings Coverage Proof

**Authority:** Inventory config domains + Prisma models  
**Generated:** 2026-09-07

## Rule

| Condition | Classification |
|-----------|----------------|
| Config field, no customer UI | Gap (if intended configurable) |
| UI control, no runtime consumer | DEFECT — MISSING RUNTIME |
| Persists but no behavior change | DEFECT — MISSING RUNTIME |
| Legacy field, no canonical UI | Backward-compat test only |

## Gaps flagged

- **requestFormEnabled** (MissedCallTextConfig): DEFECT — MISSING UI → MCTB-DEFECT-SETUP-LINKS
- **defaultLinkUrl** (MissedCallTextConfig): DEFECT — MISSING UI → MCTB-DEFECT-SETUP-LINKS
- **requestFormFieldsJson** (MissedCallTextConfig): DEFECT — MISSING UI → MCTB-DEFECT-SETUP-LINKS

## Coverage table

| Config field | Domain | UI control | Save API | Persistence | Runtime consumer | Test ID | Gap |
|--------------|--------|------------|----------|-------------|------------------|---------|-----|
| bookingEnabled | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| timezone | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| businessPhone | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| weeklyHours | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| dateOverrides | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| blackoutDates | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| minimumBookingNoticeMinutes | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| maximumBookingDaysAhead | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| bookingProtection.mode | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| staff[] | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| locations[] | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| routingRules[] | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| bookingLimits | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| externalCalendarBlocking | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| reminders.confirmation | AppointmentPlatformConfig | /appointments/reminders | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-AUT-001 |  |
| reminders.reminder24h | AppointmentPlatformConfig | /appointments/reminders | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-AUT-001 |  |
| reminders.reminder2h | AppointmentPlatformConfig | /appointments/reminders | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-AUT-001 |  |
| voiceReminders | AppointmentPlatformConfig | /appointments/availability or settings | PATCH /api/appointments/settings | SolutionSetup.configJson | availability engine / reminder-delivery | APT-ENG-001 |  |
| enabled | MissedCallTextConfig | /mctb/setup/recovery | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-RT-005 |  |
| delaySeconds | MissedCallTextConfig | /mctb/setup/text-back | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-004 |  |
| messageTemplate | MissedCallTextConfig | /mctb/setup/text-back | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-004 |  |
| sendAfterNoAnswer | MissedCallTextConfig | /mctb/setup/missed-call-rules | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-002 |  |
| sendAfterBusy | MissedCallTextConfig | /mctb/setup/missed-call-rules | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-002 |  |
| sendAfterRejected | MissedCallTextConfig | /mctb/setup/missed-call-rules | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-002 |  |
| sendAfterTimeout | MissedCallTextConfig | /mctb/setup/missed-call-rules | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-002 |  |
| sendAfterVoicemail | MissedCallTextConfig | /mctb/setup/missed-call-rules | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-002 |  |
| businessHoursOnly | MissedCallTextConfig | LEGACY — runtime only | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-LEGACY-SCHED-001 |  |
| allowedStartTime | MissedCallTextConfig | LEGACY — runtime only | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-LEGACY-SCHED-001 |  |
| allowedEndTime | MissedCallTextConfig | LEGACY — runtime only | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-LEGACY-SCHED-001 |  |
| cooldownMinutes | MissedCallTextConfig | /mctb/setup/recovery | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-RT-006 |  |
| maxMessagesPerCaller | MissedCallTextConfig | /mctb/setup/recovery | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-RT-006 |  |
| suppressOptedOutNumbers | MissedCallTextConfig | runtime eligibility | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-RT-013 |  |
| requestFormEnabled | MissedCallTextConfig | MISSING /mctb/setup/links | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-DEFECT-SETUP-LINKS | DEFECT — MISSING UI |
| defaultLinkUrl | MissedCallTextConfig | MISSING /mctb/setup/links | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-DEFECT-SETUP-LINKS | DEFECT — MISSING UI |
| requestFormFieldsJson | MissedCallTextConfig | MISSING /mctb/setup/links | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-DEFECT-SETUP-LINKS | DEFECT — MISSING UI |
| phoneNumberId | MissedCallTextConfig | /mctb/setup/phone | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-001 |  |
| smsPhoneNumberId | MissedCallTextConfig | /mctb/setup/phone | POST /api/mctb/setup | missed_call_text_configs | eligibility + send job | MCTB-SET-001 |  |
| responseMode | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-MODE-* |  |
| emergencyDetectionEnabled | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-001 |  |
| emergencyAction | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-001 |  |
| bookingBehavior | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-001 |  |
| fieldSchemaJson | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-FIELD-* |  |
| routingMatrixJson | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-005 |  |
| quietHoursEnabled | MctbHandoffConfig | /mctb/setup/notifications | PATCH /api/mctb/handoff | mctb_handoff_configs | handoff orchestrator + notifications | MCTB-HO-005 |  |
| enabled | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-enabled |  |
| joinRule | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-joinRule |  |
| recordingEnabled | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-recordingEnabled |  |
| transcriptEnabled | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-transcriptEnabled |  |
| summaryEnabled | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-summaryEnabled |  |
| actionItemsEnabled | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-actionItemsEnabled |  |
| recordingRetentionDays | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-recordingRetentionDays |  |
| transcriptRetentionDays | NotetakerPlatformConfig | /settings/ai-notetaker | settings save | workspace settings JSON | meeting-assistant/service | AP-NOTETAKER-transcriptRetentionDays |  |
