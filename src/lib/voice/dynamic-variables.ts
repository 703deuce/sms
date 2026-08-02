import { getPrisma } from "@/lib/db";
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
    set("business_timezone", messaging?.timezone);
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

  // Explicit per-call overrides win
  if (input.overrides && typeof input.overrides === "object") {
    for (const [k, v] of Object.entries(input.overrides)) set(k, v);
  }

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

  return out;
}
