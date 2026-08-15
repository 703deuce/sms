import type { PhoneNumber } from "@/lib/types";
import { getPrisma } from "@/lib/db";
import {
  derivePersonalServiceState,
  personalServiceLabel,
  readPersonalSettings,
} from "@/lib/workspace/personal-service";
import { loadPhoneNumbers } from "@/lib/workspace-data";

export type PersonalNumberRow = PhoneNumber & {
  serviceState: string;
  serviceLabel: string;
  voicemailEnabled: boolean;
  parkedSince: string | null;
  portAwayExpiresAt: string | null;
};

export function mapPersonalNumber(number: PhoneNumber): PersonalNumberRow {
  const settings = readPersonalSettings(number);
  const state = derivePersonalServiceState(number);
  return {
    ...number,
    serviceState: state,
    serviceLabel: personalServiceLabel(state),
    voicemailEnabled: settings.voicemailEnabled === true,
    parkedSince: (settings.parkedSince as string) || null,
    portAwayExpiresAt: (settings.portAwayWindowExpiresAt as string) || null,
  };
}

export async function loadPersonalNumbers(workspaceId: string): Promise<PersonalNumberRow[]> {
  const numbers = await loadPhoneNumbers(workspaceId);
  return numbers.map(mapPersonalNumber);
}

export async function loadPersonalNumber(
  workspaceId: string,
  numberId: string,
): Promise<PersonalNumberRow | null> {
  const numbers = await loadPersonalNumbers(workspaceId);
  return numbers.find((n) => n.id === numberId) ?? null;
}

export async function loadParkedNumbers(workspaceId: string): Promise<PersonalNumberRow[]> {
  return (await loadPersonalNumbers(workspaceId)).filter(
    (n) => n.serviceState === "PARKED" || readPersonalSettings(n).parked === true,
  );
}

export type PersonalActivityRow = {
  id: string;
  kind: string;
  summary: string;
  at: string;
};

export async function loadPersonalActivity(
  workspaceId: string,
  limit = 10,
): Promise<PersonalActivityRow[]> {
  const prisma = getPrisma();
  const calls = await prisma.humanCall.findMany({
    where: { workspaceId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      direction: true,
      status: true,
      from: true,
      to: true,
      startedAt: true,
      endedAt: true,
    },
  });

  return (calls as Array<{
    id: string;
    direction: string;
    status: string;
    from: string;
    to: string;
    startedAt: Date;
    endedAt: Date | null;
  }>).map((c) => ({
    id: c.id,
    kind: "call",
    summary: `${c.direction === "inbound" ? "Incoming" : "Outgoing"} call ${c.from} → ${c.to} (${c.status})`,
    at: c.startedAt.toISOString(),
  }));
}

export async function loadBusinessWorkspacesForUser(userId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true, type: true } } },
  });
  return memberships
    .filter((m: { workspace: { type: string } }) => m.workspace.type === "BUSINESS")
    .map((m: { workspace: { id: string; name: string } }) => ({
      id: m.workspace.id,
      name: m.workspace.name,
    }));
}
