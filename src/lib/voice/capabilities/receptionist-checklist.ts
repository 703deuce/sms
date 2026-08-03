/**
 * Master AI-agent capability map for Transovo.
 *
 * Layers:
 * 1. Required for every AI receptionist
 * 2. Optional upgrades for a receptionist
 * 3. Required only when appointment booking is enabled
 * 4. Required only for specialized receptionist variants
 * 5. Features meant mainly for other AI-agent solutions
 *
 * Status reflects Transovo↔Telnyx wiring readiness for reuse across agent types.
 */

export type CapabilityTier =
  | "required_receptionist"
  | "optional_receptionist"
  | "required_booking"
  | "specialized"
  | "other_solutions";

export type CapabilityStatus =
  | "live"
  | "partial"
  | "wizard_wired"
  | "platform_ready"
  | "planned";

export type AgentCapability = {
  id: string;
  label: string;
  tier: CapabilityTier;
  /** Tool catalog keys / platform hooks this capability depends on. */
  toolKeys?: string[];
  status: CapabilityStatus;
  notes?: string;
  /** Solution types that should enable this by default. */
  defaultFor?: Array<
    | "standard_receptionist"
    | "appointment_receptionist"
    | "after_hours"
    | "overflow"
    | "missed_call"
    | "lead_qualification"
    | "customer_support"
    | "medical"
    | "legal"
    | "property_management"
  >;
};

export const RECEPTIONIST_CAPABILITIES: AgentCapability[] = [
  // ——— 1. Required for every AI receptionist ———
  {
    id: "identity",
    label: "Business & solution identity",
    tier: "required_receptionist",
    status: "wizard_wired",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "phone_connection",
    label: "Phone-number connection & answering behavior",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "DID assign live; after-hours/overflow via shared activate hooks + routing sync",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "call_opening",
    label: "Immediate call opening / connection greeting",
    tier: "required_receptionist",
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "voice",
    label: "Voice configuration + telephone test",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "Speed / responsiveness / silenceTimeoutMs / fallbackVoiceId from wizard",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "speech_recognition",
    label: "Speech recognition (Deepgram Nova-3)",
    tier: "required_receptionist",
    status: "live",
    notes: "keyterms from business name, appointment types, transfer name",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "core_instructions",
    label: "Core instructions & guardrails",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "Includes knowledge fallback phrase always",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "business_knowledge",
    label: "Business knowledge sources",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "Wizard Scan POSTs /api/voice/knowledge + URL source; activate rebuilds profile/FAQ KB",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "knowledge_retrieval",
    label: "Knowledge retrieval tool",
    tier: "required_receptionist",
    toolKeys: [],
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "intent_handling",
    label: "Basic caller-intent handling",
    tier: "required_receptionist",
    status: "wizard_wired",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "collect_caller_info",
    label: "Caller-information collection",
    tier: "required_receptionist",
    toolKeys: ["save_caller_info", "lookup_customer"],
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "message_taking",
    label: "Message taking + staff notify",
    tier: "required_receptionist",
    toolKeys: ["take_structured_message", "create_task", "mark_disposition"],
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "human_transfer",
    label: "Human transfer + failed-transfer fallback",
    tier: "required_receptionist",
    toolKeys: ["escalate_human", "transfer"],
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "call_ending",
    label: "Hang-up and call ending",
    tier: "required_receptionist",
    toolKeys: ["hangup", "end_call"],
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "recording",
    label: "Call recording setting",
    tier: "required_receptionist",
    status: "live",
    notes:
      "compliance.recordingDisclosure; inbound speaks disclosure or prepends to greeting when concurrent mask skips speak",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "transcript_history",
    label: "Transcript & conversation history",
    tier: "required_receptionist",
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "post_call_summary",
    label: "Post-call summary & structured insights",
    tier: "required_receptionist",
    status: "live",
    notes: "extractionFields mapped into insight customFields from LLM/heuristic JSON",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "staff_notifications",
    label: "Staff notifications",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "In-app notify on message taken / urgent",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "call_history_ui",
    label: "Call history page",
    tier: "required_receptionist",
    status: "live",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },
  {
    id: "reliability_security",
    label: "Reliability & security controls",
    tier: "required_receptionist",
    status: "wizard_wired",
    notes: "Activation gates, transfer destination checks, recording disclosure, emergency disable",
    defaultFor: ["standard_receptionist", "appointment_receptionist"],
  },

  // ——— 2. Optional receptionist upgrades ———
  {
    id: "connection_greeting_prerecord",
    label: "Prerecorded connection greeting",
    tier: "optional_receptionist",
    status: "live",
    notes: "upload_custom audioUrl + Transovo default MP3; create_custom text",
  },
  {
    id: "background_ambience",
    label: "Background ambience",
    tier: "optional_receptionist",
    status: "platform_ready",
  },
  {
    id: "multilingual",
    label: "Multiple languages",
    tier: "optional_receptionist",
    status: "wizard_wired",
    notes: "mapWizardLanguage → primaryLanguage + transcription.language",
  },
  {
    id: "multi_transfer_destinations",
    label: "Multiple transfer destinations",
    tier: "optional_receptionist",
    status: "platform_ready",
  },
  {
    id: "warm_transfer",
    label: "Warm transfer",
    tier: "optional_receptionist",
    status: "wizard_wired",
    notes: "wizard warmTransfer → transfers.warmTransfer; builtin escalate uses warm_transfer type",
  },
  {
    id: "voicemail_detection",
    label: "Voicemail detection on transfer",
    tier: "optional_receptionist",
    status: "wizard_wired",
    notes: "detectVoicemailOnTransfer gates answering_machine_detection on transfer legs",
  },
  {
    id: "long_term_memory",
    label: "Long-term memory",
    tier: "optional_receptionist",
    status: "wizard_wired",
    notes: "longTermMemory → VoiceMemoryConfig (saveMemoryConfig) + advanced.memory; off by default",
  },
  {
    id: "crm_connection",
    label: "CRM connection",
    tier: "optional_receptionist",
    toolKeys: [
      "lookup_customer",
      "search_crm_contacts",
      "upsert_crm_contact",
      "create_crm_note",
      "create_crm_task",
    ],
    status: "wizard_wired",
    notes: "create_crm_note always on for receptionist; full CRM set when crmEnabled",
  },
  {
    id: "sms_followup",
    label: "SMS follow-up",
    tier: "optional_receptionist",
    toolKeys: ["send_sms"],
    status: "wizard_wired",
  },
  {
    id: "ai_handoff",
    label: "AI handoff to another assistant",
    tier: "optional_receptionist",
    toolKeys: ["handoff"],
    status: "platform_ready",
  },
  {
    id: "custom_workflows",
    label: "Custom visual workflows",
    tier: "optional_receptionist",
    status: "platform_ready",
  },

  // ——— 3. Booking ———
  {
    id: "calendar_connection",
    label: "Calendar connection",
    tier: "required_booking",
    status: "wizard_wired",
    notes: "Appointments step + /api/voice/calendars; activation blocks without live Google/Microsoft/internal",
    defaultFor: ["appointment_receptionist"],
  },
  {
    id: "appointment_types",
    label: "Appointment types → voice services",
    tier: "required_booking",
    status: "wizard_wired",
    defaultFor: ["appointment_receptionist"],
  },
  {
    id: "availability_tool",
    label: "Availability tool",
    tier: "required_booking",
    toolKeys: ["calendar_availability"],
    status: "live",
    defaultFor: ["appointment_receptionist"],
  },
  {
    id: "booking_tool",
    label: "Booking tool",
    tier: "required_booking",
    toolKeys: ["book_appointment"],
    status: "live",
    defaultFor: ["appointment_receptionist"],
  },
  {
    id: "booking_conversation",
    label: "Booking conversation logic & guardrails",
    tier: "required_booking",
    status: "wizard_wired",
    defaultFor: ["appointment_receptionist"],
  },
  {
    id: "reschedule_cancel",
    label: "Reschedule / cancel appointments",
    tier: "required_booking",
    toolKeys: ["reschedule_appointment", "cancel_appointment"],
    status: "live",
    defaultFor: ["appointment_receptionist"],
  },

  // ——— 4. Specialized ———
  {
    id: "after_hours",
    label: "After-hours receptionist rules",
    tier: "specialized",
    status: "wizard_wired",
    notes: "runSharedReceptionistHooks → after-hours activate stub",
    defaultFor: ["after_hours"],
  },
  {
    id: "overflow",
    label: "Overflow / ring-team-first",
    tier: "specialized",
    status: "wizard_wired",
    notes: "runSharedReceptionistHooks → overflow activate stub",
    defaultFor: ["overflow"],
  },
  {
    id: "missed_call",
    label: "Missed-call text-back receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes: "Activate hook stub under solutions/hooks/missed-call",
    defaultFor: ["missed_call"],
  },
  {
    id: "lead_qualification",
    label: "Lead-qualification receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes: "Activate hook stub; qualify_callers capability in wizard",
    defaultFor: ["lead_qualification"],
  },
  {
    id: "customer_support",
    label: "Customer-support receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes: "Activate hook stub under solutions/hooks/customer-support",
    defaultFor: ["customer_support"],
  },
  {
    id: "medical",
    label: "Medical / HIPAA receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes:
      "Activate hook: medical guardrails, medicalReceptionist, take_structured_message, compliance flags",
    defaultFor: ["medical"],
  },
  {
    id: "legal",
    label: "Legal intake receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes:
      "Activate hook: no-advice guardrails, legalReceptionist, conflict-check collectFields",
    defaultFor: ["legal"],
  },
  {
    id: "property_management",
    label: "Property management receptionist",
    tier: "specialized",
    status: "wizard_wired",
    notes:
      "Activate hook: unit/address intake, maintenance vs emergency, create_task, propertyReceptionist",
    defaultFor: ["property_management"],
  },

  // ——— 5. Other solutions ———
  {
    id: "outbound_dialing",
    label: "Outbound dialing / AMD",
    tier: "other_solutions",
    status: "platform_ready",
    notes: "Activate hook under solutions/hooks/outbound",
  },
  {
    id: "campaigns",
    label: "Campaigns / bulk lists",
    tier: "other_solutions",
    status: "platform_ready",
    notes: "Activate hook under solutions/hooks/campaigns",
  },
  {
    id: "dtmf_navigation",
    label: "DTMF navigation",
    tier: "other_solutions",
    toolKeys: ["send_dtmf"],
    status: "live",
  },
  {
    id: "payments",
    label: "Payment collection",
    tier: "other_solutions",
    status: "platform_ready",
    notes:
      "Activate hook: paymentsEnabled + webhook URL config; use payment_link when available",
  },
  {
    id: "surveys",
    label: "Surveys",
    tier: "other_solutions",
    status: "platform_ready",
    notes: "Activate hook: advanced.surveyMode post-call survey offer",
  },
  {
    id: "review_requests",
    label: "Review requests",
    tier: "other_solutions",
    status: "platform_ready",
    notes: "Activate hook: advanced.reviewRequests + workspace reviewLink",
  },
  {
    id: "appointment_reminders",
    label: "Appointment reminders",
    tier: "other_solutions",
    status: "live",
    notes:
      "Activate hook wires advanced.appointmentReminders to live appointment-reminders scan jobs",
  },
];

export function capabilitiesForSolution(
  solution:
    | "standard_receptionist"
    | "appointment_receptionist"
    | "after_hours"
    | "overflow"
    | "missed_call"
    | "lead_qualification"
    | "customer_support"
    | "medical"
    | "legal"
    | "property_management",
) {
  return RECEPTIONIST_CAPABILITIES.filter(
    (c) =>
      c.defaultFor?.includes(solution) ||
      (solution === "appointment_receptionist" &&
        (c.tier === "required_receptionist" || c.tier === "required_booking")),
  );
}

export function requiredToolKeysForSolution(
  solution: "standard_receptionist" | "appointment_receptionist",
): string[] {
  const caps = capabilitiesForSolution(solution);
  return [
    ...new Set(caps.flatMap((c) => c.toolKeys || []).filter(Boolean)),
  ];
}
