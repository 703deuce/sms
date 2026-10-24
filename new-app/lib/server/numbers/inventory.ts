import { getPrisma } from "@/lib/server/db";
import { listAccountPhoneNumbers } from "@/lib/server/telnyx/numbers";
import { mapPhoneRowToOwned } from "@/lib/server/numbers/map-owned";
import type { ExternalConnection, OwnedNumber, PortRequest } from "@/lib/numbers";

function isPlatformSender(settingsJson: unknown): boolean {
  if (!settingsJson || typeof settingsJson !== "object") return false;
  const role = (settingsJson as Record<string, unknown>).mctbRole;
  return role === "platform_mctb_sender";
}

export async function syncTelnyxIntoWorkspace(workspaceId: string): Promise<number> {
  const telnyxRows = await listAccountPhoneNumbers();
  const prisma = getPrisma();
  let upserted = 0;

  for (const row of telnyxRows) {
    if (!row.phone_number) continue;
    const digits = row.phone_number.replace(/\D/g, "");
    const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : null;
    const tollFree = row.phone_number.includes("800") || row.phone_number.includes("888");

    await prisma.phoneNumber.upsert({
      where: { workspaceId_e164: { workspaceId, e164: row.phone_number } },
      create: {
        workspaceId,
        e164: row.phone_number,
        type: tollFree ? "Toll-free" : "Local",
        areaCode,
        friendlyName: row.phone_number,
        provider: "telnyx",
        providerNumberId: row.id,
        status: row.status === "active" ? "Active" : "Pending",
        purchasedAt: new Date(),
        capabilitiesJson: { voice: true, sms: true, mms: false },
      },
      update: {
        providerNumberId: row.id,
        status: row.status === "active" ? "Active" : "Pending",
      },
    });
    upserted += 1;
  }

  return upserted;
}

export async function loadOwnedNumbers(workspaceId: string): Promise<OwnedNumber[]> {
  const { detectNumberProductBindings } = await import("@/lib/server/telephony/bindings");
  const rows = await getPrisma().phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { e164: "asc" },
  });

  const filtered = rows.filter((r) => !isPlatformSender(r.settingsJson));
  const owned: OwnedNumber[] = [];
  for (const row of filtered) {
    const base = mapPhoneRowToOwned(row);
    const bindings = await detectNumberProductBindings({
      workspaceId,
      phoneNumberId: row.id,
    });
    base.assignments = bindings.map((b, index) => ({
      id: `as_${row.id}_${b.product}`,
      product: b.product,
      target: b.detail,
      schedule: "Always",
      priority: index + 1,
      status: "active",
    }));
    base.destination = base.assignments[0]?.target ?? "Not routed";
    owned.push(base);
  }
  return owned;
}

export async function loadMctbConnections(_workspaceId: string): Promise<ExternalConnection[]> {
  // MCTB business line + ingress live in setup APIs (ported next). Owned Telnyx rows cover inventory tab.
  return [];
}

export async function loadPortRequests(_workspaceId: string): Promise<PortRequest[]> {
  return [];
}

export type PlatformSenderView = {
  id: string;
  number: string;
  label: string;
} | null;

export async function loadPlatformSender(): Promise<PlatformSenderView> {
  const prisma = getPrisma();
  const byEnv = process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID?.trim();
  if (byEnv) {
    const row = await prisma.phoneNumber.findFirst({
      where: { id: byEnv, status: "Active" },
      select: { id: true, e164: true },
    });
    if (row?.e164) {
      return { id: row.id, number: row.e164, label: "Transovo platform number (shared)" };
    }
  }

  const candidates = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: { id: true, e164: true, settingsJson: true },
    take: 20,
  });
  const platform = candidates.filter((c) => isPlatformSender(c.settingsJson));
  if (platform.length === 1 && platform[0]?.e164) {
    return {
      id: platform[0].id,
      number: platform[0].e164,
      label: "Transovo platform number (shared)",
    };
  }
  return null;
}
