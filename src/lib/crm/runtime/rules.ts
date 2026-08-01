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
  /** Extra preference gates — all must be true (or undefined). */
  requiresPrefs?: Array<keyof Awaited<ReturnType<typeof getCrmSyncPreferences>>>;
};

const DEFAULT_RULES: CrmIntegrationRule[] = [
  // Missed calls always log when call sync is on; task is a separate toggle.
  {
    id: "missed_call_log",
    when: "call.missed",
    then: ["log_call"],
    requiresPref: "syncCalls",
  },
  {
    id: "missed_call_task",
    when: "call.missed",
    then: ["create_task"],
    requiresPref: "createTasksOnMissedCall",
  },
  {
    id: "call_log",
    when: ["call.completed", "call.incoming", "call.outgoing"],
    then: ["log_call"],
    requiresPref: "syncCalls",
  },
  {
    id: "voicemail_log",
    when: "voicemail.received",
    then: ["log_call"],
    requiresPref: "syncVoicemail",
  },
  {
    id: "voicemail_note",
    when: "voicemail.received",
    then: ["create_note"],
    requiresPrefs: ["syncVoicemail", "syncNotes"],
  },
  {
    id: "voicemail_task",
    when: "voicemail.received",
    then: ["create_task"],
    requiresPrefs: ["syncVoicemail", "createTasksOnVoicemail"],
  },
  {
    id: "recording",
    when: "recording.ready",
    then: ["log_call", "attach_recording"],
    requiresPrefs: ["syncCalls", "syncRecordings"],
  },
  {
    id: "transcript",
    when: "transcript.ready",
    then: ["log_call", "attach_transcript"],
    requiresPrefs: ["syncCalls", "syncTranscripts"],
  },
  {
    id: "ai_summary",
    when: "ai_summary.ready",
    then: ["log_call", "attach_ai_summary"],
    requiresPrefs: ["syncCalls", "syncAiSummary"],
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
    id: "sms_unread_task",
    when: "sms.received",
    then: ["create_task"],
    requiresPref: "createTasksOnUnreadSms",
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
    id: "appointment_note",
    when: "appointment.booked",
    then: ["create_note"],
    requiresPref: "syncNotes",
  },
  {
    id: "appointment_task",
    when: "appointment.booked",
    then: ["create_task"],
    requiresPref: "syncTasks",
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
    then: ["create_lead", "upsert_contact"],
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

function prefsAllow(
  prefs: Awaited<ReturnType<typeof getCrmSyncPreferences>>,
  rule: CrmIntegrationRule,
) {
  if (rule.requiresPref && prefs[rule.requiresPref] === false) return false;
  if (rule.requiresPrefs) {
    for (const key of rule.requiresPrefs) {
      if (prefs[key] === false) return false;
    }
  }
  return true;
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
    if (!prefsAllow(prefs, rule)) continue;
    rulesApplied.push(rule.id);
    for (const a of rule.then) actions.add(a);
  }

  // Hard gates — never create notes/tasks/calls/sms when the matching object sync is off.
  if (!prefs.syncNotes) actions.delete("create_note");
  if (!prefs.syncTasks) actions.delete("create_task");
  if (!prefs.syncCalls) {
    actions.delete("log_call");
    actions.delete("attach_recording");
    actions.delete("attach_transcript");
    actions.delete("attach_ai_summary");
  }
  if (!prefs.syncSms) actions.delete("log_sms");
  if (!prefs.syncActivities && !prefs.syncCalls && !prefs.syncSms) {
    // activities master switch when neither call nor sms logging is active
  }

  return { actions: [...actions], rulesApplied };
}

export function defaultCrmRules(): CrmIntegrationRule[] {
  return DEFAULT_RULES.map((r) => ({ ...r }));
}
