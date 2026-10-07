const CONTEXT_KEY = "arSmsReminderContexts";
const MAX_CONTEXTS = 8;

export type ArSmsReminderContext = {
  appointmentId: string;
  sentAt: string;
  reminderGeneration?: number;
  timelineType?: string;
  outboundProviderMessageId?: string;
};

export function parseReminderContexts(customFields: unknown): ArSmsReminderContext[] {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return [];
  const root = customFields as Record<string, unknown>;
  const raw = root[CONTEXT_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is ArSmsReminderContext =>
        Boolean(
          x &&
            typeof x === "object" &&
            typeof (x as ArSmsReminderContext).appointmentId === "string" &&
            typeof (x as ArSmsReminderContext).sentAt === "string",
        ),
    )
    .slice(0, MAX_CONTEXTS);
}

export function mergeReminderContext(
  customFields: unknown,
  entry: ArSmsReminderContext,
): Record<string, unknown> {
  const base =
    customFields && typeof customFields === "object" && !Array.isArray(customFields)
      ? { ...(customFields as Record<string, unknown>) }
      : {};
  const prev = parseReminderContexts(base);
  const next = [entry, ...prev.filter((c) => c.appointmentId !== entry.appointmentId)].slice(
    0,
    MAX_CONTEXTS,
  );
  return { ...base, [CONTEXT_KEY]: next };
}
