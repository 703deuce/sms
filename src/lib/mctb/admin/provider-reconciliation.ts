/**
 * Compare Transovo-owned TFNs vs Twilio inventory to catch orphan numbers and billing leaks.
 */
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";

export type ProviderReconciliationResult = {
  scannedWorkspaces: number;
  transovoTollFreeActive: number;
  twilioTollFreeListed: number;
  missingInTwilio: string[];
  orphanInTwilio: string[];
  errors: string[];
};

export async function reconcileTwilioTollFreeInventory(limit = 100): Promise<ProviderReconciliationResult> {
  const prisma = getPrisma();
  const errors: string[] = [];
  const missingInTwilio: string[] = [];
  const orphanInTwilio: string[] = [];

  const rows = await prisma.phoneNumber.findMany({
    where: {
      status: { not: "Released" },
      type: { in: ["TollFree", "Toll-free"] },
      provider: { equals: "twilio", mode: "insensitive" },
    },
    select: { id: true, workspaceId: true, e164: true, twilioSid: true },
    take: limit,
  });

  if (!isLiveMessagingAdapter()) {
    return {
      scannedWorkspaces: new Set(rows.map((r: { workspaceId: string }) => r.workspaceId)).size,
      transovoTollFreeActive: rows.length,
      twilioTollFreeListed: 0,
      missingInTwilio: [],
      orphanInTwilio: [],
      errors: ["mock_adapter_skip"],
    };
  }

  const byWorkspace = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byWorkspace.get(row.workspaceId) || [];
    list.push(row);
    byWorkspace.set(row.workspaceId, list);
  }

  let twilioTotal = 0;
  const twilioSidsSeen = new Set<string>();

  for (const [workspaceId, numbers] of byWorkspace) {
    try {
      const reg = await getRegistrationByWorkspace(workspaceId);
      if (!reg?.subaccountSid || !reg.subaccountAuthTokenEnc) {
        errors.push(`${workspaceId}: missing subaccount`);
        continue;
      }
      const client = getSubaccountTwilioClient(
        reg.subaccountSid,
        decryptSecret(reg.subaccountAuthTokenEnc),
      );
      const listed = await client.incomingPhoneNumbers.list({ limit: 100 });
      const tollFree = listed.filter((n) => String(n.phoneNumber || "").match(/^\+1(800|888|877|866|855|844|833)/));
      twilioTotal += tollFree.length;

      const sidSet = new Set(tollFree.map((n) => n.sid));
      for (const n of tollFree) twilioSidsSeen.add(n.sid);

      for (const pn of numbers) {
        const sid = pn.twilioSid;
        if (sid && !sidSet.has(sid)) {
          missingInTwilio.push(`${workspaceId}:${pn.e164}:${sid}`);
        }
      }

      for (const n of tollFree) {
        const owned = numbers.some(
          (pn: { twilioSid: string | null }) => pn.twilioSid === n.sid,
        );
        if (!owned) {
          orphanInTwilio.push(`${workspaceId}:${n.phoneNumber}:${n.sid}`);
        }
      }
    } catch (err) {
      errors.push(
        `${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    scannedWorkspaces: byWorkspace.size,
    transovoTollFreeActive: rows.length,
    twilioTollFreeListed: twilioTotal,
    missingInTwilio,
    orphanInTwilio,
    errors,
  };
}
