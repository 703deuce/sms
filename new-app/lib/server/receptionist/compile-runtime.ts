import type { AgentConfig, Capability } from "@/lib/agent";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import {
  RECEPTIONIST_PUBLISHED_SCHEMA_VERSION,
} from "@/lib/server/receptionist/constants";
import { mapEditorVoiceToLiveVoiceId } from "@/lib/server/receptionist/voice-map";
import { buildVoiceV3Prompts } from "@/lib/server/voice-v3/build-voice-v3-prompts";
import {
  editorToVoiceV3AgentConfig,
  type KnowledgeCompileSlice,
} from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import type { ReceptionistBusinessFacts } from "@/lib/server/receptionist/business-facts";

/** Matches monolith `VOICE_V3_ASTRA_MODEL_DEFAULT` (GPT-Live delegation backend). */
const ASTRA_MODEL = process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-6-luna";

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

function buildVoiceV3Snapshot(
  config: AgentConfig,
  workspaceId: string,
  voiceV3Config: ReturnType<typeof editorToVoiceV3AgentConfig>,
): Record<string, unknown> {
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
    voiceV3AgentConfig: voiceV3Config,
  };
}

export function compilePublishedBundle(input: {
  editor: AgentConfig;
  workspaceId: string;
  agentId: string;
  businessName: string;
  timezone: string;
  businessFacts: ReceptionistBusinessFacts;
  knowledge: KnowledgeCompileSlice;
}): ReceptionistPublishedBundle {
  const toolNames = enabledTools(input.editor);
  const liveVoiceId = mapEditorVoiceToLiveVoiceId(
    input.editor.identity.voice,
    input.editor.identity.customVoiceId,
  );

  const voiceV3Config = editorToVoiceV3AgentConfig({
    editor: input.editor,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessName: input.businessName,
    timezone: input.timezone,
    businessFacts: input.businessFacts,
    knowledge: input.knowledge,
  });

  const prompts = buildVoiceV3Prompts({
    agentName: input.editor.identity.name,
    businessName: input.businessName,
    timezone: input.timezone,
    agentConfig: voiceV3Config,
    toolNames,
  });

  return {
    schemaVersion: RECEPTIONIST_PUBLISHED_SCHEMA_VERSION,
    publishedAt: new Date().toISOString(),
    editor: input.editor,
    runtime: {
      amyInstructions: prompts.liveInstructions,
      astraInstructions: prompts.astraInstructions,
      liveVoiceId,
      astraModel: ASTRA_MODEL,
      toolNames,
      maxToolSteps: 5,
      openaiFileSearchVectorStoreIds: input.knowledge.openaiVectorStoreIds,
      voiceV3: buildVoiceV3Snapshot(input.editor, input.workspaceId, voiceV3Config),
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
