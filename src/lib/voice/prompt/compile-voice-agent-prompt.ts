/**
 * Canonical voice prompt compiler — wizard config → layered Telnyx instructions.
 * Prompt = fast working knowledge. RAG = long-tail. Runtime = live truth.
 */

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  TRANSOVO_BASE_VOICE_RULES,
  TRANSOVO_BASE_VOICE_RULES_VERSION,
  buildIdentitySection,
  buildRoleSection,
} from "./base-voice-rules";
import {
  buildCompactBusinessSections,
  businessContextRevision,
} from "./build-business-context";
import {
  buildEnabledCapabilitiesSection,
  buildVoiceBehaviorRules,
  buildWorkspacePolicyContext,
} from "./build-policy-context";
import { KNOWLEDGE_HIERARCHY_RULES } from "./knowledge-classification";
import {
  deriveLeadRecoveryPolicyFromWizard,
  policyVersionLabel,
} from "@/lib/voice/runtime/wizard-policy-bridge";
import { isAfterHoursVoiceProfile } from "@/lib/voice/runtime/voice-profile";
import type {
  CompiledVoicePromptResult,
  CompiledVoicePromptSectionId,
  VoiceCallPromptState,
  VoicePromptCompileInput,
  VoicePromptInspection,
} from "./types";

export const VOICE_PROMPT_COMPILER_VERSION = "v1.0.0";

const SECTION_HEADERS: Record<CompiledVoicePromptSectionId, string> = {
  identity: "# Identity",
  role: "# Role",
  businessInformation: "# Business Information",
  businessHours: "# Business Hours / Current Status",
  services: "# Services",
  approvedPricing: "# Approved Pricing",
  commonQuestions: "# Common Questions",
  businessPolicies: "# Business Policies",
  serviceArea: "# Service Area",
  callHandling: "# Call Handling",
  workspacePolicy: "# Workspace Policy",
  allowedCapabilities: "# Allowed Capabilities",
  currentCallState: "# Current Call State",
  currentGoal: "# Current Goal",
  knownInformation: "# Known Information",
  missingInformation: "# Missing Information",
  retrievedKnowledge: "# Retrieved Knowledge",
  conversationRules: "# Conversation Rules",
  knowledgeHierarchy: "# Knowledge Hierarchy",
  safety: "# Safety",
  bookingPolicy: "# Booking Policy",
  dateTimePolicy: "# Date and Time",
  transferPolicy: "# Transfer Policy",
  fallbackPolicy: "# Fallback Policy",
  toolPolicy: "# Tool Policy",
  fieldCollection: "# Field Collection",
};

function formatCallState(state: VoiceCallPromptState): string {
  const lines: string[] = [];
  if (state.currentState) lines.push(`State: ${state.currentState}`);
  if (state.primaryIntent) lines.push(`Primary intent: ${state.primaryIntent}`);
  if (state.workflowComplete != null) {
    lines.push(`Workflow complete: ${state.workflowComplete}`);
  }
  if (state.allowedTools?.length) {
    lines.push(`Allowed tools: ${state.allowedTools.join(", ")}`);
  }
  return lines.join("\n");
}

function formatKnownFields(known?: Record<string, string | null | undefined>): string {
  if (!known) return "";
  const entries = Object.entries(known).filter(([, v]) => v != null && String(v).trim());
  if (!entries.length) return "";
  return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

function buildBookingPolicySummary(
  state: AppointmentReceptionistWizardState,
  voiceBookingMode?: "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY",
): string {
  if (voiceBookingMode === "AI_BOOK") {
    return [
      "Live calendar booking is enabled (Microsoft via voice_ai_booking_turn).",
      "Check availability and book only through voice_ai_booking_turn or calendar_availability + book_appointment.",
      "Do not offer SMS booking links unless the caller refuses live booking or the calendar tool fails.",
      "Never invent times or confirm booked until the tool succeeds.",
    ].join(" ");
  }

  const afterHours = isAfterHoursVoiceProfile(state);
  if (afterHours) {
    const link = state.appointmentTypes.some(
      (t) => t.enabled && t.bookingPermission === "send_booking_link",
    );
    return [
      "After-hours V1: scheduling on the call is link-or-callback only.",
      `Booking link configured: ${link ? "yes — use send_resource after verbal SMS consent" : "no — callback and message capture"}.`,
      "No calendar lookup, slot offers, or appointment creation on this call.",
      "Sending a booking link does not end the call.",
    ].join(" ");
  }

  const lines = [
    `Booking capability: ${state.capabilities.includes("book_appointments") ? "enabled" : "disabled"}.`,
    `Final confirmation: ${state.bookingBehavior.confirmBeforeBooking ? "required" : "not required"}.`,
    `SMS confirmation: ${state.bookingBehavior.sendSmsAfterBooking ? "enabled" : "disabled"}.`,
    `Preferred day first: ${state.bookingBehavior.askPreferredDayFirst ? "yes" : "no"}.`,
    `Offer earliest slots: ${state.bookingBehavior.offerEarliestThree ? "yes" : "no"}.`,
  ];
  if (state.bookingBehavior.distinguishNewExisting) {
    lines.push(
      "Ask whether the caller is new or an existing patient/client before booking, and tailor questions accordingly.",
    );
  }
  if (state.capabilities.includes("book_appointments")) {
    lines.push(
      "Never offer, confirm, or book a day/time unless startsAt came from calendar_availability while scheduling tools were permitted.",
    );
  }
  return lines.join(" ");
}

function buildTransferPolicySummary(state: AppointmentReceptionistWizardState): string {
  if (!state.capabilities.includes("transfer_calls")) {
    return "Transfer disabled for this agent.";
  }
  const name = state.transferDestinationName || "configured destination";
  return `Transfer to ${name} when policy requires. Runtime resolves the phone number — never invent a destination.`;
}

function assembleSection(id: CompiledVoicePromptSectionId, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return `${SECTION_HEADERS[id]}\n${trimmed}`;
}

/**
 * Compile the full system prompt from wizard configuration and optional runtime overlays.
 */
export function compileVoiceAgentPrompt(
  input: VoicePromptCompileInput,
): CompiledVoicePromptResult {
  const wizard = input.wizard;
  const profile =
    input.profile ??
    (wizard.preset === "after_hours" || wizard.answerWhen === "after_hours"
      ? "after_hours"
      : "appointment_receptionist");

  const business = buildCompactBusinessSections(wizard);
  const lrPolicy = deriveLeadRecoveryPolicyFromWizard(wizard);
  const policyVersion = policyVersionLabel(lrPolicy, "wizard");
  const sections: Partial<Record<CompiledVoicePromptSectionId, string>> = {};

  sections.identity = buildIdentitySection({
    agentName: wizard.agentName || "Amy",
    businessName: wizard.businessName || "the business",
    role: wizard.role,
    profile,
  });
  sections.role = buildRoleSection(profile);
  sections.knowledgeHierarchy = KNOWLEDGE_HIERARCHY_RULES;
  sections.safety = TRANSOVO_BASE_VOICE_RULES;

  if (business.businessInformation) {
    sections.businessInformation = `Business knowledge:\n${business.businessInformation}`;
  }
  if (business.businessHours) sections.businessHours = business.businessHours;
  if (business.services) sections.services = business.services;
  if (business.approvedPricing) sections.approvedPricing = business.approvedPricing;
  if (business.commonQuestions) sections.commonQuestions = business.commonQuestions;
  if (business.businessPolicies) sections.businessPolicies = business.businessPolicies;
  if (business.serviceArea) sections.serviceArea = business.serviceArea;
  if (business.callHandling) sections.callHandling = business.callHandling;

  sections.workspacePolicy = buildWorkspacePolicyContext(wizard);
  sections.bookingPolicy = buildBookingPolicySummary(wizard, input.voiceBookingMode);
  sections.dateTimePolicy = isAfterHoursVoiceProfile(wizard)
    ? `Business timezone: {{business_timezone}} (${wizard.timezone || "America/New_York"}).
Use timezone for hours and urgency only — do not negotiate appointment times on this call.`
    : `Business timezone: {{business_timezone}} (${wizard.timezone || "America/New_York"}).
When the caller uses relative timing (today, tomorrow, this Friday), call resolve_datetime with their phrase.
Do not invent today's date or guess the weekday.
Repeat full date, day, time, and timezone before booking.`;
  sections.transferPolicy = buildTransferPolicySummary(wizard);
  sections.fallbackPolicy = `On tool failure: ${wizard.transferFallback.replaceAll("_", " ")}. Never invent availability or outcomes.`;
  sections.toolPolicy = `Use only tools listed in allowed_tools / runtime context.
Never claim booking, SMS, transfer, or cancellation succeeded until a tool returns confirmed success.
Do not call retrieval for hours, address, services, pricing, or FAQs present in Business Context above.`;
  sections.fieldCollection = `Field requirements come from get_runtime_context (current_field, missing_fields, allowed_tools).
Prefer record_current_field({ value }) during collection. Do not advance to scheduling before workflow_complete=true.`;
  sections.conversationRules = buildVoiceBehaviorRules(wizard);
  sections.allowedCapabilities = buildEnabledCapabilitiesSection(
    wizard,
    input.enabledCapabilities,
  );

  if (input.callState) {
    const cs = formatCallState(input.callState);
    if (cs) sections.currentCallState = cs;
    const known = formatKnownFields(input.callState.knownFields);
    if (known) sections.knownInformation = known;
    if (input.callState.missingFields?.length) {
      sections.missingInformation = input.callState.missingFields.map((f) => `- ${f}`).join("\n");
    }
  }
  if (input.activeTask?.trim()) sections.currentGoal = input.activeTask.trim();
  if (input.retrievedKnowledge?.trim()) {
    sections.retrievedKnowledge = input.retrievedKnowledge.trim();
  }

  const order: CompiledVoicePromptSectionId[] = [
    "identity",
    "role",
    "businessInformation",
    "businessHours",
    "services",
    "approvedPricing",
    "commonQuestions",
    "businessPolicies",
    "serviceArea",
    "callHandling",
    "workspacePolicy",
    "currentCallState",
    "currentGoal",
    "knownInformation",
    "missingInformation",
    "allowedCapabilities",
    "retrievedKnowledge",
    "bookingPolicy",
    "dateTimePolicy",
    "transferPolicy",
    "fallbackPolicy",
    "fieldCollection",
    "toolPolicy",
    "conversationRules",
    "knowledgeHierarchy",
    "safety",
  ];

  const includedSectionIds: CompiledVoicePromptSectionId[] = [];
  const parts: string[] = [];
  for (const id of order) {
    const body = sections[id];
    if (!body?.trim()) {
      if (!input.omitEmptySections) continue;
      continue;
    }
    const block = assembleSection(id, body);
    if (block) {
      parts.push(block);
      includedSectionIds.push(id);
    }
  }

  const systemPrompt = parts.join("\n\n");

  return {
    systemPrompt,
    sections,
    metadata: {
      compilerVersion: VOICE_PROMPT_COMPILER_VERSION,
      baseRulesVersion: TRANSOVO_BASE_VOICE_RULES_VERSION,
      profile,
      businessContextRevision: businessContextRevision(wizard),
      policyVersion,
      includedSectionIds,
      ragIncluded: Boolean(input.retrievedKnowledge?.trim()),
      callStateIncluded: Boolean(input.callState),
    },
  };
}

/** Admin/debug — metadata + section bodies without secrets beyond compiled prompt. */
export function inspectCompiledVoicePrompt(
  input: VoicePromptCompileInput,
  previewMaxChars = 4000,
): VoicePromptInspection {
  const compiled = compileVoiceAgentPrompt(input);
  const preview =
    compiled.systemPrompt.length <= previewMaxChars
      ? compiled.systemPrompt
      : `${compiled.systemPrompt.slice(0, previewMaxChars)}\n… [truncated]`;
  return {
    metadata: compiled.metadata,
    sections: compiled.sections,
    systemPromptPreview: preview,
    systemPromptCharCount: compiled.systemPrompt.length,
  };
}

/** Wizard-only compile — used at Telnyx publish time. */
export function compileVoiceAgentPromptFromWizard(
  wizard: AppointmentReceptionistWizardState,
): string {
  return compileVoiceAgentPrompt({ wizard, omitEmptySections: true }).systemPrompt;
}
