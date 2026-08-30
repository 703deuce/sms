import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { mapPhoneNumber } from "@/lib/mappers";
import { getPhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import type { PhoneNumber } from "@/lib/types";

export type WorkspacePhoneNumberSource = "owned";

export type WorkspaceAccessiblePhoneRow = {
  id: string;
  e164: string;
  friendlyName: string | null;
  type: string | null;
  a2pStatus: string | null;
  status: string | null;
  settingsJson?: unknown;
  provider?: string | null;
  source: WorkspacePhoneNumberSource;
  sourceLabel?: string;
  ownerWorkspaceId?: string;
};

const phoneSelect = {
  id: true,
  e164: true,
  friendlyName: true,
  type: true,
  a2pStatus: true,
  status: true,
  settingsJson: true,
  provider: true,
  workspaceId: true,
} as const;

function isReleasedPhoneStatus(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "released";
}

/** Workspace-owned numbers only — no linked platform demo rows. */
export async function loadWorkspaceAccessiblePhoneNumbers(
  workspaceId: string,
): Promise<WorkspaceAccessiblePhoneRow[]> {
  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { e164: "asc" },
    select: phoneSelect,
  });

  return owned.map(
    (n: (typeof owned)[number]): WorkspaceAccessiblePhoneRow => ({
      id: n.id,
      e164: n.e164,
      friendlyName: n.friendlyName,
      type: n.type,
      a2pStatus: n.a2pStatus,
      status: n.status,
      settingsJson: n.settingsJson,
      provider: n.provider,
      source: "owned",
    }),
  );
}

/** MCTB setup dropdown — active owned numbers only. */
export async function loadMctbSetupPhoneOptions(
  workspaceId: string,
): Promise<WorkspaceAccessiblePhoneRow[]> {
  const rows = await loadWorkspaceAccessiblePhoneNumbers(workspaceId);
  return rows.filter((n) => !isReleasedPhoneStatus(n.status));
}

export function enrichWorkspacePhoneWithMessagingStatus<T extends WorkspaceAccessiblePhoneRow>(
  rows: T[],
  _platformDemoPhoneNumberId?: string | null,
) {
  return rows.map((row) => ({
    ...row,
    messagingStatus: getPhoneMessagingStatus(row),
  }));
}

export function mapAccessiblePhoneToPhoneNumber(row: WorkspaceAccessiblePhoneRow): PhoneNumber {
  const digits = row.e164.replace(/\D/g, "");
  const areaCode = digits.length >= 11 ? digits.slice(1, 4) : digits.slice(0, 3);
  const mapped = mapPhoneNumber({
    id: row.id,
    e164: row.e164,
    type: row.type || "Local",
    areaCode,
    friendlyName: row.friendlyName,
    provider: row.provider,
    a2pStatus: row.a2pStatus || "NOT_STARTED",
    messagingService: "Default",
    monthlyCostCents: 0,
    status: row.status || "Active",
    settingsJson: row.settingsJson,
    assignments: [],
  });
  return {
    ...mapped,
    workspaceSource: row.source,
    workspaceSourceLabel: row.sourceLabel,
  };
}
