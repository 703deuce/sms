/**
 * Integration rules engine — expand events into actions without architecture changes.
 * Defaults mirror product preferences; workspaces can override via connection config.
 */

import { getConnection } from "@/lib/integrations/connections";
import type { CrmPlatformEvent, CrmPlatformEventType, CrmProviderId } from "../types";
import { getCrmSyncPreferences } from "../settings";

export type RuleAction =
  | "log_call"
  | "log_sms"
  | "create_task"
  | "create_note"
  | "create_lead"
  | "attach_recording"
  | "attach_transcript"
  | "attach_ai_summary"
  | "upsert_contact"
  | "skip";

export type CrmIntegrationRule = {
  id: string;
  when: CrmPlatformEventType | CrmPlatformEventType[];
  then: RuleAction[];
  enabled?: boolean;
  /** Optional preference gate — rule skipped when preference is false. */
  requiresPref?: keyof Awaited<ReturnType<typeof getCrmSyncPreferences>>;
};

const DEFAULT_RULES: CrmIntegrationRule[] = [
  {
    id: "missed_call_task",
    when: "call.missed",
    then: ["log_call", "create_task"],
    requiresPref: "createTasksOnMissedCall",
  },
  {
    id: "call_log",
    when: ["call.completed", "call.incoming", "call.outgoing"],
    then: ["log_call"],
    requiresPref: "syncCalls",
  },
  {
    id: "voicemail",
    when: "voicemail.received",
    then: ["log_call", "create_note", "create_task"],
    requiresPref: "syncVoicemail",
  },
  {
    id: "recording",
    when: "recording.ready",
    then: ["log_call", "attach_recording"],
    requiresPref: "syncRecordings",
  },
  {
    id: "transcript",
    when: "transcript.ready",
    then: ["log_call", "attach_transcript"],
    requiresPref: "syncTranscripts",
  },
  {
    id: "ai_summary",
    when: "ai_summary.ready",
    then: ["log_call", "attach_ai_summary"],
    requiresPref: "syncAiSummary",
  },
  {
    id: "sms_in",
    when: "sms.received",
    then: ["log_sms", "upsert_contact"],
    requiresPref: "syncSms",
  },
  {
    id: "sms_out",
    when: ["sms.sent", "sms.delivered", "sms.failed"],
    then: ["log_sms"],
    requiresPref: "syncSms",
  },
  {
    id: "sms_to_lead",
    when: "sms.received",
    then: ["create_lead"],
    requiresPref: "autoCreateLeads",
    enabled: false, // opt-in via workspace rules
  },
  {
    id: "callback_task",
    when: "callback.scheduled",
    then: ["create_task"],
    requiresPref: "createTasksOnCallback",
  },
  {
    id: "contact_upsert",
    when: ["contact.created", "contact.updated"],
    then: ["upsert_contact"],
    requiresPref: "autoCreateContacts",
  },
  {
    id: "lead_created",
    when: "lead.created",
    then: ["create_lead"],
    requiresPref: "autoCreateLeads",
  },
  {
    id: "task_created",
    when: ["task.created", "task.completed"],
    then: ["create_task"],
    requiresPref: "syncTasks",
  },
];

function matches(rule: CrmIntegrationRule, type: CrmPlatformEventType) {
  const when = Array.isArray(rule.when) ? rule.when : [rule.when];
  return when.includes(type);
}

export async function resolveRulesForEvent(input: {
  workspaceId: string;
  provider: CrmProviderId;
  event: CrmPlatformEvent;
}): Promise<{ actions: RuleAction[]; rulesApplied: string[] }> {
  const prefs = await getCrmSyncPreferences(input.workspaceId, input.provider);
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = (conn?.configJson || {}) as { crmRules?: CrmIntegrationRule[] };
  const custom = cfg.crmRules || [];
  const rules = [...DEFAULT_RULES, ...custom];

  const actions = new Set<RuleAction>();
  const rulesApplied: string[] = [];

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (!matches(rule, input.event.type)) continue;
    if (rule.requiresPref && prefs[rule.requiresPref] === false) continue;
    rulesApplied.push(rule.id);
    for (const a of rule.then) actions.add(a);
  }

  // Always allow graceful empty — unsupported/optional with no matching prefs.
  return { actions: [...actions], rulesApplied };
}

export function defaultCrmRules(): CrmIntegrationRule[] {
  return DEFAULT_RULES.map((r) => ({ ...r }));
}
