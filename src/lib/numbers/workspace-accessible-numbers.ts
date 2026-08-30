import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { mapPhoneNumber } from "@/lib/mappers";
import {
  getPlatformDemoPhoneRecord,
  isWorkspaceAuthorizedForPlatformDemoNumber,
} from "@/lib/mctb/platform-demo-access";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { getPhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import type { PhoneNumber } from "@/lib/types";

export type WorkspacePhoneNumberSource = "owned" | "linked";

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

function e164Key(e164: string | null | undefined): string | null {
  if (!e164?.trim()) return null;
  try {
    return normalizeE164(e164);
  } catch {
    const digits = e164.replace(/\D/g, "");
    return digits || null;
  }
}

function isReleasedPhoneStatus(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "released";
}

/** Prefer owned workspace DID over linked platform-demo row for the same E.164. */
function dedupeAccessiblePhonesByE164(
  rows: WorkspaceAccessiblePhoneRow[],
): WorkspaceAccessiblePhoneRow[] {
  const byE164 = new Map<string, WorkspaceAccessiblePhoneRow>();
  const withoutE164: WorkspaceAccessiblePhoneRow[] = [];

  for (const row of rows) {
    const key = e164Key(row.e164);
    if (!key) {
      withoutE164.push(row);
      continue;
    }
    const existing = byE164.get(key);
    if (!existing) {
      byE164.set(key, row);
      continue;
    }
    if (existing.source === "linked" && row.source === "owned") {
      byE164.set(key, row);
    }
  }

  return [...byE164.values(), ...withoutE164].sort((a, b) => a.e164.localeCompare(b.e164));
}

function buildLinkedPlatformDemoRow(
  platformDemoPhone: NonNullable<Awaited<ReturnType<typeof getPlatformDemoPhoneRecord>>>,
): WorkspaceAccessiblePhoneRow {
  return {
    id: platformDemoPhone.phoneNumberId,
    e164: platformDemoPhone.e164,
    friendlyName: formatMctbPhoneLabel(platformDemoPhone.e164),
    type: "local",
    a2pStatus: "APPROVED",
    status: "Active",
    settingsJson: {
      ...platformDemoPhone.settingsJson,
      ...telnyxLocalA2pSettings({
        role: "customer_production",
        a2pApproved: true,
      }),
    },
    provider: "telnyx",
    source: "linked",
    sourceLabel: "Assigned to your workspace",
    ownerWorkspaceId: platformDemoPhone.ownerWorkspaceId,
  };
}

/** Owned workspace numbers plus any platform-assigned lines linked to this workspace. */
export async function loadWorkspaceAccessiblePhoneNumbers(
  workspaceId: string,
): Promise<WorkspaceAccessiblePhoneRow[]> {
  const prisma = getPrisma();
  const [owned, platformDemoAuthorized, platformDemoPhone] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      orderBy: { e164: "asc" },
      select: phoneSelect,
    }),
    isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId),
    getPlatformDemoPhoneRecord(),
  ]);

  const rows: WorkspaceAccessiblePhoneRow[] = owned.map(
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

  const ownedE164Keys = new Set(
    rows.map((n) => e164Key(n.e164)).filter((k): k is string => Boolean(k)),
  );

  if (platformDemoAuthorized && platformDemoPhone) {
    const demoKey = e164Key(platformDemoPhone.e164);
    const alreadyHasId = rows.some((n) => n.id === platformDemoPhone.phoneNumberId);
    const workspaceOwnsDemoE164 = demoKey ? ownedE164Keys.has(demoKey) : false;
    if (!alreadyHasId && !workspaceOwnsDemoE164) {
      rows.push(buildLinkedPlatformDemoRow(platformDemoPhone));
    }
  }

  return dedupeAccessiblePhonesByE164(rows);
}

/** MCTB setup dropdown — active numbers only (no Released rows). */
export async function loadMctbSetupPhoneOptions(
  workspaceId: string,
): Promise<WorkspaceAccessiblePhoneRow[]> {
  const rows = await loadWorkspaceAccessiblePhoneNumbers(workspaceId);
  return rows.filter((n) => !isReleasedPhoneStatus(n.status));
}

export function enrichWorkspacePhoneWithMessagingStatus<T extends WorkspaceAccessiblePhoneRow>(
  rows: T[],
  platformDemoPhoneNumberId?: string | null,
) {
  return rows.map((n) => {
    const isLinkedProductionDid =
      platformDemoPhoneNumberId && n.id === platformDemoPhoneNumberId;
    const row = isLinkedProductionDid
      ? {
          ...n,
          a2pStatus: "APPROVED",
          settingsJson: {
            ...(n.settingsJson && typeof n.settingsJson === "object" && !Array.isArray(n.settingsJson)
              ? (n.settingsJson as Record<string, unknown>)
              : {}),
            ...telnyxLocalA2pSettings({
              role: "customer_production",
              a2pApproved: true,
            }),
          },
        }
      : n;
    return {
      ...row,
      messagingStatus: getPhoneMessagingStatus(row),
    };
  });
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
    messagingService: row.source === "linked" ? "Workspace assigned" : "Default",
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
