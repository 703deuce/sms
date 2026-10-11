/**
 * Verify recently imported AR appointments have reminder dispatch rows.
 * WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-verify-imported-reminder-dispatch.ts
 */
import { getPrisma } from "@/lib/db";
import { discoverAndEnqueueDueAppointmentReminders } from "@/lib/appointment-reminders/reminder-discovery";

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const hours = Number(process.env.HOURS || "6");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const prisma = getPrisma();

  const imported = await prisma.voiceAppointment.findMany({
    where: { workspaceId: ws, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
  });

  console.log(`Appointments updated in last ${hours}h:`, imported.length);
  for (const a of imported) {
    const dispatches = await prisma.arReminderDispatch.findMany({
      where: { workspaceId: ws, appointmentId: a.id },
      orderBy: { intendedFireAt: "asc" },
      select: {
        id: true,
        timelineType: true,
        status: true,
        intendedFireAt: true,
        reminderGeneration: true,
      },
    });
    console.log(
      JSON.stringify(
        {
          appointmentId: a.id,
          title: a.serviceName,
          startsAt: a.startsAt.toISOString(),
          dispatchCount: dispatches.length,
          dispatches,
        },
        null,
        2,
      ),
    );
  }

  const discovery = await discoverAndEnqueueDueAppointmentReminders();
  console.log("\nReminder discovery tick:", discovery);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
