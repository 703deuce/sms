/**
 * Read-only: recent MCTB handoff events + notification deliveries (prod diagnostics).
 * Usage: npx tsx scripts/mctb-inspect-notification-deliveries.ts [workspaceId]
 */
import { getPrisma } from "../src/lib/db";

const workspaceFilter = process.argv[2]?.trim();

async function main() {
  const prisma = getPrisma();
  const where = workspaceFilter ? { workspaceId: workspaceFilter } : {};

  const events = await prisma.mctbHandoffEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      workspaceId: true,
      eventType: true,
      createdAt: true,
      conversationId: true,
      missedCallEventId: true,
    },
  });

  const deliveries = await prisma.mctbNotificationDelivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      workspaceId: true,
      handoffEventId: true,
      channel: true,
      status: true,
      destination: true,
      failureReason: true,
      createdAt: true,
      sentAt: true,
    },
  });

  const emailStats = await prisma.mctbNotificationDelivery.groupBy({
    by: ["status", "channel"],
    where: { ...where, channel: "email" },
    _count: true,
  });

  let workspaceSample: unknown = null;
  if (workspaceFilter) {
    const [config, recipients] = await Promise.all([
      prisma.mctbHandoffConfig.findUnique({ where: { workspaceId: workspaceFilter } }),
      prisma.mctbNotificationRecipient.findMany({
        where: { workspaceId: workspaceFilter },
        select: {
          id: true,
          name: true,
          email: true,
          enabled: true,
          eventChannelsJson: true,
        },
      }),
    ]);
    workspaceSample = {
      routingMatrixJson: config?.routingMatrixJson ?? null,
      responseMode: config?.responseMode ?? null,
      recipients: recipients.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email ? `${r.email.slice(0, 3)}…` : null,
        enabled: r.enabled,
        eventChannels: r.eventChannelsJson,
      })),
    };
  }

  console.log(
    JSON.stringify(
      {
        workspaceFilter: workspaceFilter || null,
        emailStats,
        recentEvents: events,
        recentDeliveries: deliveries,
        workspaceConfig: workspaceSample,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
