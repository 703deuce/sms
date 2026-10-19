import type { AgentConfig, Capability } from "@/lib/agent";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import {
  RECEPTIONIST_PUBLISHED_SCHEMA_VERSION,
} from "@/lib/server/receptionist/constants";
import { mapEditorVoiceToLiveVoiceId } from "@/lib/server/receptionist/voice-map";

const ASTRA_MODEL = process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-5.2";

function enabledTools(config: AgentConfig): string[] {
  const names: string[] = ["update_intake", "end_call"];
  const cap = config.capabilities;
  const on = (c: Capability) => cap[c] === true;
  if (on("book") || on("reschedule")) {
    names.push("set_scheduling_preference", "find_availability");
  }
  if (on("book")) names.push("book_appointment", "send_booking_link");
  if (on("reschedule")) names.push("find_appointment", "reschedule_appointment");
  if (on("cancel")) names.push("find_appointment", "cancel_appointment");
  if (on("transfer")) names.push("transfer_call");
  if (on("message")) names.push("request_callback");
  if (on("answer")) names.push("business_answer");
  if (config.protection.some((r) => r.enabled && r.kind === "solicitor")) {
    names.push("report_unwanted_solicitor");
  }
  return [...new Set(names)];
}

function buildAmyInstructions(config: AgentConfig, businessName: string): string {
  const greeting = config.identity.greeting
    .replace(/\{business_name\}/g, businessName)
    .replace(/\{agent_name\}/g, config.identity.name)
    .replace(/\{time_of_day\}/g, "today");
  return [
    `You are ${config.identity.name}, ${config.identity.role} for ${businessName}.`,
    `Open with: ${greeting}`,
    "Speak naturally, one question at a time. Yield when the caller interrupts.",
    "Acknowledge tool work briefly; do not repeat filler phrases.",
    config.instructions?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAstraInstructions(config: AgentConfig, toolNames: string[]): string {
  return [
    "You are the backend reasoning layer for a live voice receptionist.",
    `Enabled tools: ${toolNames.join(", ")}.`,
    "Never invent calendar availability or booking confirmations — use tools.",
    "Persist intake with update_intake when the caller supplies configured fields.",
    "For scheduling: set_scheduling_preference before find_availability; book only after caller selects a slot.",
    config.qualification.rules.length
      ? `Qualification: ${config.qualification.match} of rules; fallback ${config.qualification.fallback}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildVoiceV3Snapshot(config: AgentConfig, workspaceId: string): Record<string, unknown> {
  return {
    workspaceId,
    identity: {
      displayName: config.identity.name,
      businessName: config.identity.role,
      language: config.identity.language,
    },
    capabilities: config.capabilities,
    intakeFields: config.intake.map((f) => ({
      key: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      description: f.label,
    })),
    appointments: config.appointments,
    transfers: config.transfers,
    coverage: config.coverage,
    messages: config.messages,
    protection: config.protection,
    telephony: {
      liveVoiceId: mapEditorVoiceToLiveVoiceId(config.identity.voice, config.identity.customVoiceId),
    },
  };
}

export function compilePublishedBundle(input: {
  editor: AgentConfig;
  workspaceId: string;
  businessName: string;
  openaiFileSearchVectorStoreIds?: string[];
}): ReceptionistPublishedBundle {
  const toolNames = enabledTools(input.editor);
  const liveVoiceId = mapEditorVoiceToLiveVoiceId(
    input.editor.identity.voice,
    input.editor.identity.customVoiceId,
  );
  return {
    schemaVersion: RECEPTIONIST_PUBLISHED_SCHEMA_VERSION,
    publishedAt: new Date().toISOString(),
    editor: input.editor,
    runtime: {
      amyInstructions: buildAmyInstructions(input.editor, input.businessName),
      astraInstructions: buildAstraInstructions(input.editor, toolNames),
      liveVoiceId,
      astraModel: ASTRA_MODEL,
      toolNames,
      maxToolSteps: 5,
      openaiFileSearchVectorStoreIds: input.openaiFileSearchVectorStoreIds ?? [],
      voiceV3: buildVoiceV3Snapshot(input.editor, input.workspaceId),
    },
  };
}

export function validateEditorForPublish(config: AgentConfig): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!config.identity.name?.trim()) errors.push("Agent name is required.");
  if (!config.identity.greeting?.trim()) errors.push("Greeting is required.");
  if (!config.connection.id?.trim()) errors.push("Assign a phone number in Call Handling.");
  if (config.capabilities.book && config.appointments.strategy === "live") {
    if (config.appointments.provider === "none") {
      errors.push("Connect a calendar or change booking strategy.");
    }
    if (!config.appointments.types.some((t) => t.enabled)) {
      errors.push("Enable at least one appointment type.");
    }
  }
  if (config.capabilities.transfer && !config.transfers.some((t) => t.enabled && t.number?.trim())) {
    errors.push("Enable at least one transfer destination.");
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
