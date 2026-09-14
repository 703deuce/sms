import { getPrisma } from "@/lib/db";
import { defaultHandoffConfig, DEFAULT_LEAD_FIELD_SCHEMA } from "./defaults";
import type {
  MctbHandoffConfigDto,
  MctbLeadFieldConfig,
  MctbNotificationRecipientDto,
  MctbRoutingMatrix,
} from "./types";
import { MCTB_RESPONSE_MODES, MCTB_EMERGENCY_ACTIONS } from "./types";

function parseFieldSchema(json: unknown): MctbLeadFieldConfig[] {
  if (!Array.isArray(json)) return DEFAULT_LEAD_FIELD_SCHEMA;
  const parsed = json.filter(
    (row): row is MctbLeadFieldConfig =>
      row &&
      typeof row === "object" &&
      typeof (row as MctbLeadFieldConfig).id === "string" &&
      typeof (row as MctbLeadFieldConfig).requirement === "string",
  );
  return parsed.length ? parsed : DEFAULT_LEAD_FIELD_SCHEMA;
}

function parseRoutingMatrix(json: unknown): MctbRoutingMatrix {
  if (!json || typeof json !== "object") return defaultHandoffConfig().routingMatrix;
  return json as MctbRoutingMatrix;
}

function rowToDto(row: {
  responseMode: string;
  emergencyDetectionEnabled: boolean;
  emergencyCriteria: string | null;
  emergencyAction: string;
  emergencyUncertainBehavior: string;
  bookingBehavior: string;
  fieldSchemaJson: unknown;
  routingMatrixJson: unknown;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursEmergencyBypass: boolean;
  quietHoursNonUrgentSmsDelay: boolean;
}): MctbHandoffConfigDto {
  const mode = MCTB_RESPONSE_MODES.includes(row.responseMode as MctbHandoffConfigDto["responseMode"])
    ? (row.responseMode as MctbHandoffConfigDto["responseMode"])
    : "notify_only";
  const emergencyAction = MCTB_EMERGENCY_ACTIONS.includes(
    row.emergencyAction as MctbHandoffConfigDto["emergencyAction"],
  )
    ? (row.emergencyAction as MctbHandoffConfigDto["emergencyAction"])
    : "notify_only";

  return {
    responseMode: mode,
    emergencyDetectionEnabled: row.emergencyDetectionEnabled,
    emergencyCriteria: row.emergencyCriteria,
    emergencyAction,
    emergencyUncertainBehavior:
      row.emergencyUncertainBehavior === "treat_normal" ||
      row.emergencyUncertainBehavior === "clarify"
        ? row.emergencyUncertainBehavior
        : "handoff_human",
    bookingBehavior:
      row.bookingBehavior === "on_request" ||
      row.bookingBehavior === "selected_services" ||
      row.bookingBehavior === "ai_when_fit"
        ? row.bookingBehavior
        : "off",
    fieldSchema: parseFieldSchema(row.fieldSchemaJson),
    routingMatrix: parseRoutingMatrix(row.routingMatrixJson),
    quietHours: {
      enabled: row.quietHoursEnabled,
      start: row.quietHoursStart,
      end: row.quietHoursEnd,
      emergencyBypass: row.quietHoursEmergencyBypass,
      nonUrgentSmsDelay: row.quietHoursNonUrgentSmsDelay,
    },
  };
}

export async function loadMctbHandoffConfig(workspaceId: string): Promise<MctbHandoffConfigDto> {
  const prisma = getPrisma();
  const row = await prisma.mctbHandoffConfig.findUnique({ where: { workspaceId } });
  if (!row) return defaultHandoffConfig();
  return rowToDto(row);
}

export async function ensureMctbHandoffConfig(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.mctbHandoffConfig.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  const defaults = defaultHandoffConfig();
  return prisma.mctbHandoffConfig.create({
    data: {
      workspaceId,
      responseMode: defaults.responseMode,
      emergencyDetectionEnabled: defaults.emergencyDetectionEnabled,
      emergencyAction: defaults.emergencyAction,
      emergencyUncertainBehavior: defaults.emergencyUncertainBehavior,
      bookingBehavior: defaults.bookingBehavior,
      fieldSchemaJson: defaults.fieldSchema,
      routingMatrixJson: defaults.routingMatrix,
      quietHoursEmergencyBypass: defaults.quietHours.emergencyBypass,
    },
  });
}

export async function saveMctbHandoffConfig(
  workspaceId: string,
  patch: Partial<MctbHandoffConfigDto>,
): Promise<MctbHandoffConfigDto> {
  const prisma = getPrisma();
  await ensureMctbHandoffConfig(workspaceId);
  const data: Record<string, unknown> = {};
  if (patch.responseMode) data.responseMode = patch.responseMode;
  if (patch.emergencyDetectionEnabled !== undefined) {
    data.emergencyDetectionEnabled = patch.emergencyDetectionEnabled;
  }
  if (patch.emergencyCriteria !== undefined) data.emergencyCriteria = patch.emergencyCriteria;
  if (patch.emergencyAction) data.emergencyAction = patch.emergencyAction;
  if (patch.emergencyUncertainBehavior) {
    data.emergencyUncertainBehavior = patch.emergencyUncertainBehavior;
  }
  if (patch.bookingBehavior) data.bookingBehavior = patch.bookingBehavior;
  if (patch.fieldSchema) data.fieldSchemaJson = patch.fieldSchema;
  if (patch.routingMatrix) data.routingMatrixJson = patch.routingMatrix;
  if (patch.quietHours) {
    data.quietHoursEnabled = patch.quietHours.enabled;
    data.quietHoursStart = patch.quietHours.start;
    data.quietHoursEnd = patch.quietHours.end;
    data.quietHoursEmergencyBypass = patch.quietHours.emergencyBypass;
    data.quietHoursNonUrgentSmsDelay = patch.quietHours.nonUrgentSmsDelay;
  }
  const row = await prisma.mctbHandoffConfig.update({ where: { workspaceId }, data });
  return rowToDto(row);
}

export async function loadMctbNotificationRecipients(
  workspaceId: string,
): Promise<MctbNotificationRecipientDto[]> {
  const prisma = getPrisma();
  const rows = await prisma.mctbNotificationRecipient.findMany({
    where: { workspaceId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r: {
    id: string;
    name: string;
    email: string | null;
    mobileE164: string | null;
    roleDescription: string | null;
    eventChannelsJson: unknown;
    enabled: boolean;
    sortOrder: number;
  }) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    mobileE164: r.mobileE164,
    roleDescription: r.roleDescription,
    eventChannels: (r.eventChannelsJson || {}) as MctbNotificationRecipientDto["eventChannels"],
    enabled: r.enabled,
    sortOrder: r.sortOrder,
  }));
}

export async function saveMctbNotificationRecipients(
  workspaceId: string,
  recipients: Array<Omit<MctbNotificationRecipientDto, "id"> & { id?: string }>,
): Promise<MctbNotificationRecipientDto[]> {
  const prisma = getPrisma();
  const existing = await prisma.mctbNotificationRecipient.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const keepIds = new Set(recipients.filter((r) => r.id).map((r) => r.id!));
  const toDelete = existing
    .filter((e: { id: string }) => !keepIds.has(e.id))
    .map((e: { id: string }) => e.id);
  if (toDelete.length) {
    await prisma.mctbNotificationRecipient.deleteMany({
      where: { workspaceId, id: { in: toDelete } },
    });
  }
  const out: MctbNotificationRecipientDto[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const data = {
      workspaceId,
      name: r.name.trim(),
      email: r.email?.trim() || null,
      mobileE164: r.mobileE164?.trim() || null,
      roleDescription: r.roleDescription?.trim() || null,
      eventChannelsJson: r.eventChannels || {},
      enabled: r.enabled ?? true,
      sortOrder: r.sortOrder ?? i,
    };
    if (r.id && keepIds.has(r.id)) {
      const row = await prisma.mctbNotificationRecipient.update({
        where: { id: r.id, workspaceId },
        data,
      });
      out.push({
        id: row.id,
        name: row.name,
        email: row.email,
        mobileE164: row.mobileE164,
        roleDescription: row.roleDescription,
        eventChannels: row.eventChannelsJson as MctbNotificationRecipientDto["eventChannels"],
        enabled: row.enabled,
        sortOrder: row.sortOrder,
      });
    } else {
      const row = await prisma.mctbNotificationRecipient.create({ data });
      out.push({
        id: row.id,
        name: row.name,
        email: row.email,
        mobileE164: row.mobileE164,
        roleDescription: row.roleDescription,
        eventChannels: row.eventChannelsJson as MctbNotificationRecipientDto["eventChannels"],
        enabled: row.enabled,
        sortOrder: row.sortOrder,
      });
    }
  }
  return out;
}
