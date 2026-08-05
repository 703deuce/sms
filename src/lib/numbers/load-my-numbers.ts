/**
 * My Numbers — management view over TriggerDeployment records.
 * Source of truth for editing remains the trigger node on the workflow canvas.
 */

import { getPrisma } from "@/lib/db";
import { listTriggerDeploymentsForWorkspace } from "@/lib/automations/trigger-deployments";
import { formatPhone } from "@/lib/utils";

export type NumberRoutingRow = {
  phoneNumberId: string;
  e164: string;
  displayName: string;
  routes: Array<{
    deploymentId: string;
    eventType: string;
    status: string;
    flowId: string;
    flowName: string;
    href: string;
  }>;
};

export async function loadMyNumbersFromTriggers(workspaceId: string): Promise<{
  rows: NumberRoutingRow[];
  summary: { numbers: number; live: number; paused: number };
}> {
  const prisma = getPrisma();
  const [phones, deployments] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { workspaceId, releasedAt: null },
      orderBy: { purchasedAt: "desc" },
      select: { id: true, e164: true, friendlyName: true },
    }),
    listTriggerDeploymentsForWorkspace(workspaceId).catch(() => []),
  ]);

  const byPhone = new Map<string, NumberRoutingRow>();
  for (const p of phones as Array<{
    id: string;
    e164: string;
    friendlyName: string | null;
  }>) {
    byPhone.set(p.id, {
      phoneNumberId: p.id,
      e164: p.e164,
      displayName: p.friendlyName?.trim() || formatPhone(p.e164),
      routes: [],
    });
  }

  for (const d of deployments as Array<{
    id: string;
    phoneNumberId: string | null;
    eventType: string;
    status: string;
    flowId: string;
    flow?: { id: string; name: string } | null;
    phoneNumber?: { id: string; e164: string; friendlyName: string | null } | null;
  }>) {
    if (!d.phoneNumberId) continue;
    let row = byPhone.get(d.phoneNumberId);
    if (!row && d.phoneNumber) {
      row = {
        phoneNumberId: d.phoneNumberId,
        e164: d.phoneNumber.e164,
        displayName:
          d.phoneNumber.friendlyName?.trim() || formatPhone(d.phoneNumber.e164),
        routes: [],
      };
      byPhone.set(d.phoneNumberId, row);
    }
    if (!row) continue;
    row.routes.push({
      deploymentId: d.id,
      eventType: d.eventType,
      status: d.status,
      flowId: d.flowId,
      flowName: d.flow?.name || "Workflow",
      href: `/automations/${d.flowId}/edit`,
    });
  }

  const rows = [...byPhone.values()];
  const live = rows.reduce(
    (n, r) => n + r.routes.filter((x) => x.status === "live").length,
    0,
  );
  const paused = rows.reduce(
    (n, r) => n + r.routes.filter((x) => x.status === "paused").length,
    0,
  );

  return {
    rows,
    summary: { numbers: rows.length, live, paused },
  };
}
