/**
 * Import Telnyx-account phone numbers into a Transovo workspace and (optionally)
 * attach them to the Call Control connection so inbound webhooks fire.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type TelnyxOwnedNumber = {
  id: string;
  e164: string;
  status?: string;
  connectionId?: string | null;
  messagingProfileId?: string | null;
};

export async function listTelnyxOwnedNumbers(): Promise<TelnyxOwnedNumber[]> {
  if (!getTelnyxApiKey()) return [];
  const out: TelnyxOwnedNumber[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<{
      data?: Array<Record<string, unknown>>;
      meta?: { total_pages?: number; page_number?: number };
    }>("/phone_numbers", {
      query: { "page[number]": page, "page[size]": 50 },
    });
    const rows = res.data || [];
    for (const row of rows) {
      const e164 = normalizeE164(String(row.phone_number || ""));
      if (!e164) continue;
      out.push({
        id: String(row.id || ""),
        e164,
        status: row.status ? String(row.status) : undefined,
        connectionId: row.connection_id ? String(row.connection_id) : null,
        messagingProfileId: row.messaging_profile_id
          ? String(row.messaging_profile_id)
          : null,
      });
    }
    const totalPages = Number(res.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
    page += 1;
    if (page > 20) break;
  }
  return out;
}

/**
 * Upsert Telnyx numbers into this workspace.
 * Skips E.164s already owned by a *different* workspace (inbound lookup is global).
 */
export async function importTelnyxNumbersIntoWorkspace(input: {
  workspaceId: string;
  /** When set, only import these E.164s. Otherwise import all account numbers. */
  e164s?: string[];
  attachConnection?: boolean;
}) {
  const owned = await listTelnyxOwnedNumbers();
  const want = input.e164s?.length
    ? new Set(input.e164s.map((n) => normalizeE164(n)).filter(Boolean))
    : null;
  const candidates = owned.filter((n) => (want ? want.has(n.e164) : true));

  const prisma = getPrisma();
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim() || "";
  const imported: Array<{
    id: string;
    e164: string;
    providerNumberId: string;
    attached: boolean;
    skippedReason?: string;
  }> = [];

  for (const n of candidates) {
    if (!n.id) continue;
    const elsewhere = await prisma.phoneNumber.findFirst({
      where: { e164: n.e164, NOT: { workspaceId: input.workspaceId } },
      select: { id: true, workspaceId: true },
    });
    if (elsewhere) {
      imported.push({
        id: elsewhere.id,
        e164: n.e164,
        providerNumberId: n.id,
        attached: false,
        skippedReason: `already in another workspace (${elsewhere.workspaceId})`,
      });
      continue;
    }

    const row = await prisma.phoneNumber.upsert({
      where: {
        workspaceId_e164: { workspaceId: input.workspaceId, e164: n.e164 },
      },
      create: {
        workspaceId: input.workspaceId,
        e164: n.e164,
        type: "Local",
        areaCode: n.e164.replace(/\D/g, "").slice(1, 4) || null,
        providerNumberId: n.id,
        status: "Active",
        purchasedAt: new Date(),
        a2pStatus: "PENDING",
        capabilitiesJson: { voice: true, sms: true, source: "telnyx_sync" },
      },
      update: {
        providerNumberId: n.id,
        status: "Active",
        releasedAt: null,
      },
    });

    let attached = Boolean(n.connectionId && connectionId && n.connectionId === connectionId);
    if (input.attachConnection !== false && connectionId && n.connectionId !== connectionId) {
      try {
        await telnyxRequest(`/phone_numbers/${encodeURIComponent(n.id)}`, {
          method: "PATCH",
          body: { connection_id: connectionId },
        });
        attached = true;
      } catch (err) {
        imported.push({
          id: row.id,
          e164: n.e164,
          providerNumberId: n.id,
          attached: false,
          skippedReason: `imported but connection attach failed: ${
            err instanceof Error ? err.message : String(err)
          }`.slice(0, 240),
        });
        continue;
      }
    }

    imported.push({
      id: row.id,
      e164: n.e164,
      providerNumberId: n.id,
      attached,
    });
  }

  return {
    telnyxCount: owned.length,
    imported,
    connectionId: connectionId || null,
  };
}
