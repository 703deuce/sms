#!/usr/bin/env npx tsx
/**
 * Restore 571-407 Telnyx number to original Transovo LiveKit Inbound connection.
 * One-off operational rollback — does not change SMS app code.
 */
import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  findFqdnConnectionByName,
  routeTelnyxNumberToConnection,
} from "@/lib/telephony/provisioning/telnyx/sip-connection";
import { TRANSOVO_TELNYX_FQDN_CONNECTION_NAME } from "@/lib/telephony/provisioning/config";

const ORIGINAL_CONNECTION_ID =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID?.trim() || "3022029259041408870";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: { contains: "571407" }, status: { not: "released" } },
    select: {
      id: true,
      e164: true,
      providerNumberId: true,
      settingsJson: true,
      workspaceId: true,
    },
  });
  if (!phone?.providerNumberId) throw new Error("571-407 number not found in database");

  const before = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
  );

  const byName = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const targetId = String(byName?.id || ORIGINAL_CONNECTION_ID);
  const targetName = String(byName?.connection_name || TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);

  const route = await routeTelnyxNumberToConnection({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    connectionId: targetId,
  });

  const after = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
  );

  const settings = (phone.settingsJson || {}) as Record<string, unknown>;
  const telephony = (settings.telephony || {}) as Record<string, unknown>;
  if (telephony.telnyxFqdnConnectionId !== targetId) {
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        settingsJson: {
          ...settings,
          telephony: {
            ...telephony,
            telnyxFqdnConnectionId: targetId,
            lastProvisionedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  const afterConn = String(after.data?.connection_id || "");
  console.log(
    JSON.stringify(
      {
        ok: afterConn === targetId,
        phone: { e164: phone.e164, id: phone.id, workspaceId: phone.workspaceId },
        before: {
          connectionId: before.data?.connection_id,
          connectionName: before.data?.connection_name,
        },
        restoredTo: { connectionId: targetId, connectionName: targetName },
        after: {
          connectionId: after.data?.connection_id,
          connectionName: after.data?.connection_name,
        },
        route,
      },
      null,
      2,
    ),
  );

  if (afterConn !== targetId) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
