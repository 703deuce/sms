import type { AgentConfig, OperatingMaturityConfig } from "@/lib/agent";

/** Schedule used for operating-state resolution (custom coverage overrides when active). */
export function resolveBusinessScheduleForRuntime(editor: AgentConfig): OperatingMaturityConfig["businessSchedule"] {
  if (editor.coverage.mode === "custom" && editor.coverage.customSchedule) {
    return editor.coverage.customSchedule;
  }
  return editor.operating.businessSchedule;
}

function enrichOnCallSchedule(editor: AgentConfig): OperatingMaturityConfig["onCallSchedule"] {
  const entries = editor.operating.onCallSchedule.entries.map((entry) => {
    const destId = entry.destination.transferDestinationId?.trim();
    const transfer = destId ? editor.transfers.find((t) => t.id === destId) : undefined;
    return {
      ...entry,
      destination: {
        label: entry.destination.label || transfer?.name || "On-call",
        phoneE164: entry.destination.phoneE164?.trim() || transfer?.number?.trim(),
        transferDestinationId: destId,
      },
    };
  });
  return {
    ...editor.operating.onCallSchedule,
    entries,
  };
}

export function operatingPolicyFromEditor(editor: AgentConfig): OperatingMaturityConfig {
  const schedule = resolveBusinessScheduleForRuntime(editor);
  const onCall = {
    ...enrichOnCallSchedule(editor),
    timezone: editor.operating.onCallSchedule.timezone || schedule.timezone,
  };
  return {
    revision: editor.operating.revision || "v1",
    businessSchedule: schedule,
    afterHoursBehavior: editor.operating.afterHoursBehavior,
    onCallSchedule: onCall,
    callbackSla: {
      ...editor.operating.callbackSla,
      normalCustomMinutes:
        editor.operating.callbackSla.normalTarget === "custom"
          ? editor.messages.slaHours * 60
          : editor.operating.callbackSla.normalCustomMinutes,
    },
  };
}
