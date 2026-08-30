import { getPrisma } from "@/lib/db";
import { buildBusinessLocalClock } from "./runtime-clock";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "./types";

/**
 * Resolve runtime dynamic variables for a Telnyx AI Assistant session.
 * Values are stringified for Telnyx `assistant.dynamic_variables`.
 */
export async function resolveCallDynamicVariables(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  contactId?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
  direction?: string | null;
  overrides?: Record<string, unknown> | null;
}): Promise<Record<string, string>> {
  const prisma = getPrisma();
  const out: Record<string, string> = {};

  const set = (key: string, value: unknown) => {
    if (value == null) return;
    const s = String(value).trim();
    if (!s) return;
    out[key] = s;
  };

  let workspaceTimezone: string | null = null;
  let agentTimezone: string | null = null;

  // Workspace / business defaults
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true, displayName: true },
    });
    set("workspace_name", ws?.displayName || ws?.name);
    set("company_name", ws?.displayName || ws?.name);
    set("business_name", ws?.displayName || ws?.name);
    const messaging = await prisma.workspaceMessagingSettings.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    workspaceTimezone = messaging?.timezone ? String(messaging.timezone) : null;
    set("business_timezone", workspaceTimezone);
  } catch {
    // ignore
  }

  // Agent config defaults (draftConfig may carry a dynamicVariables map)
  if (input.agentId) {
    try {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      });
      if (agent) {
        set("agent_name", agent.displayName || agent.name);
        set("agent_purpose", agent.purpose);
        const cfg = parseVoiceAgentConfig(agent.draftConfig) as VoiceAgentConfig & {
          dynamicVariables?: Record<string, unknown>;
        };
        const defaults = cfg.dynamicVariables;
        if (defaults && typeof defaults === "object") {
          for (const [k, v] of Object.entries(defaults)) set(k, v);
          if (defaults.timezone != null) agentTimezone = String(defaults.timezone);
          if (defaults.business_timezone != null) {
            agentTimezone = String(defaults.business_timezone);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Call / caller
  set("caller_phone", input.fromE164);
  set("called_phone", input.toE164);
  set("call_direction", input.direction);
  if (input.callId) set("call_id", input.callId);

  // Contact
  if (input.contactId) {
    try {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, workspaceId: input.workspaceId },
      });
      if (contact) {
        const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        set("contact_id", contact.id);
        set("contact_name", fullName || contact.email || contact.phone);
        set("full_name", fullName);
        set("first_name", contact.firstName);
        set("last_name", contact.lastName);
        set("contact_email", contact.email);
        set("contact_phone", contact.phone);
        set("contact_company", contact.company);
      }
    } catch {
      // ignore
    }
  } else if (input.fromE164) {
    try {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: input.workspaceId, phone: input.fromE164 },
      });
      if (contact) {
        const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        set("contact_id", contact.id);
        set("contact_name", fullName || contact.email || contact.phone);
        set("full_name", fullName);
        set("first_name", contact.firstName);
        set("last_name", contact.lastName);
        set("contact_email", contact.email);
      }
    } catch {
      // ignore
    }
  }

  // Explicit per-call overrides win (including timezone for the clock below)
  if (input.overrides && typeof input.overrides === "object") {
    for (const [k, v] of Object.entries(input.overrides)) set(k, v);
  }

  // If this webhook runs, attach a fresh clock. Flux latency profiles skip the
  // webhook entirely so greeting is not blocked — those agents use resolve_datetime.
  const clock = buildBusinessLocalClock(
    out.business_timezone ||
      out.timezone ||
      agentTimezone ||
      workspaceTimezone,
  );
  set("business_timezone", clock.business_timezone);
  set("timezone", clock.business_timezone);
  set("current_date", clock.current_date);
  set("current_day", clock.current_day);
  set("current_time", clock.current_time);
  set("utc_offset", clock.utc_offset);
  set("current_iso_local", clock.current_iso_local);

  // Memory privacy: strip excluded fields before sending to Telnyx.
  if (input.agentId) {
    try {
      const memory = await prisma.voiceMemoryConfig.findFirst({
        where: { workspaceId: input.workspaceId, agentId: input.agentId },
        orderBy: { updatedAt: "desc" },
      });
      const exclude = Array.isArray(memory?.excludeFields)
        ? (memory!.excludeFields as string[])
        : [];
      for (const key of exclude) {
        delete out[key];
        delete out[key.toLowerCase()];
      }
      // Sensitive defaults when mode excludes PII-ish keys
      if (memory?.mode === "none") {
        for (const key of Object.keys(out)) {
          if (
            /email|ssn|dob|address|password|secret|token/i.test(key) ||
            key.startsWith("contact_")
          ) {
            delete out[key];
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (input.callId) set("workflow_session_id", input.callId);

  let conversationWorkflowMode = false;
  if (input.agentId) {
    try {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
        select: { draftConfig: true },
      });
      if (agent) {
        const cfg = parseVoiceAgentConfig(agent.draftConfig);
        conversationWorkflowMode =
          (cfg.advanced as Record<string, unknown> | undefined)?.conversationWorkflowMode ===
          true;
      }
    } catch {
      // ignore
    }
  }

  if (conversationWorkflowMode) {
    try {
      const { resolveCallSessionContext } = await import("./call-session-context");
      const session = await resolveCallSessionContext({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        fromE164: input.fromE164,
      });
      for (const [key, value] of Object.entries(session)) {
        set(key, value);
      }
    } catch {
      // session context is best-effort
    }
  }

  if (input.callId && input.agentId && !conversationWorkflowMode) {
    try {
      const { buildRuntimeFieldManifest } = await import("@/lib/voice/field-runtime/requirements");
      const { buildRuntimeContext } = await import("@/lib/voice/workflow-engine/engine");
      const manifest = await buildRuntimeFieldManifest({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        workflow: "book_appointment",
      });
      set("workflow_session_id", manifest.session_id);
      set(
        "workflow_field_manifest_json",
        JSON.stringify({
          workflow: manifest.workflow,
          session_id: manifest.session_id,
          fields_to_collect: manifest.fields_to_collect,
        }).slice(0, 3500),
      );

      const runtimeCtx = await buildRuntimeContext({
        callId: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        workflow: "book_appointment",
      });
      set("workflow_state", runtimeCtx.state);
      set("workflow_complete", runtimeCtx.workflow_complete ? "true" : "false");
      set("next_action", runtimeCtx.next_action || "");
      if (runtimeCtx.do_not_advance) {
        set("do_not_advance", runtimeCtx.do_not_advance);
      }
      set(
        "allowed_tools_json",
        JSON.stringify(runtimeCtx.allowed_tools).slice(0, 1500),
      );
      if (runtimeCtx.current_field) {
        set(
          "current_required_field_json",
          JSON.stringify(runtimeCtx.current_field).slice(0, 800),
        );
        set("current_field_label", runtimeCtx.current_field.label || "");
      }
      set(
        "runtime_context_json",
        JSON.stringify({
          state: runtimeCtx.state,
          workflow_id: runtimeCtx.workflow_id,
          workflow_complete: runtimeCtx.workflow_complete,
          allowed_tools: runtimeCtx.allowed_tools,
          current_field: runtimeCtx.current_field,
          next_action: runtimeCtx.next_action,
          do_not_advance: runtimeCtx.do_not_advance,
          missing_count: runtimeCtx.missing_fields.length,
          complete: runtimeCtx.complete,
        }).slice(0, 3500),
      );
    } catch {
      // manifest is best-effort at call start
    }
  }

  return out;
}
