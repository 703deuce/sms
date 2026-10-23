import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import { sendTransactionalEmail, resolveTransactionalEmailSenderConfig } from "@/lib/email/brevo";
import { getPowerDialerAnalytics } from "@/lib/server/phone/power-dialer/analytics-service";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "reports_schedule");
    const prisma = getPrisma();
    const rows = await prisma.powerDialerScheduledReport.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 403);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "reports_schedule");
    const body = (await request.json()) as {
      name?: string;
      cadence?: string;
      recipients?: string[];
      action?: "send_now";
      id?: string;
    };
    const prisma = getPrisma();

    if (body.action === "send_now" && body.id) {
      const row = await prisma.powerDialerScheduledReport.findFirst({
        where: { id: body.id, workspaceId },
      });
      if (!row) throw new Error("Report not found");
      const cfg = resolveTransactionalEmailSenderConfig();
      if (!cfg.productionReady) {
        throw new Error(
          "Email not configured — set BREVO_API_KEY and BREVO_FROM_EMAIL or TRANSOVO_TRANSACTIONAL_FROM_EMAIL",
        );
      }
      const analytics = await getPowerDialerAnalytics(workspaceId, "7d");
      const recipients = Array.isArray(row.recipientsJson)
        ? (row.recipientsJson as string[])
        : [];
      const text = `Power Dialer weekly summary: ${analytics.totals.attempts} attempts, ${analytics.totals.humanConversations} conversations, ${analytics.totals.billableMinutes} talk minutes.`;
      for (const to of recipients) {
        await sendTransactionalEmail({ to, subject: row.name, textContent: text, workspaceId });
      }
      await prisma.powerDialerScheduledReport.update({
        where: { id: row.id },
        data: { lastSentAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const row = await prisma.powerDialerScheduledReport.create({
      data: {
        workspaceId,
        name: body.name?.trim() || "Weekly summary",
        cadence: body.cadence === "daily" ? "daily" : "weekly",
        recipientsJson: body.recipients || [],
        filtersJson: { range: "7d" },
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
