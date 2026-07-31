import { getPrisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Email a digest of recent unread in-app notifications to each workspace
 * member, based on their WorkspaceNotificationPrefs.digestFrequency.
 */
export async function processNotificationDigests(frequency = "daily") {
  const prisma = getPrisma();
  const prefsRows = (await prisma.workspaceNotificationPrefs.findMany({
    where: { digestFrequency: frequency },
  })) as Array<{
    workspaceId: string;
    userId: string;
    notifyEmail: string | null;
  }>;

  const windowMs =
    frequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);

  let sent = 0;
  for (const pref of prefsRows) {
    const notifications = (await prisma.inAppNotification.findMany({
      where: {
        workspaceId: pref.workspaceId,
        userId: pref.userId,
        readAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    })) as Array<{ title: string; body: string | null; createdAt: Date }>;

    if (notifications.length === 0) continue;

    let email = pref.notifyEmail?.trim() || "";
    if (!email) {
      const user = await prisma.user.findUnique({ where: { id: pref.userId } });
      email = user?.email || "";
    }
    if (!email) continue;

    const items = notifications
      .map(
        (n) =>
          `<li style="margin-bottom:8px"><strong>${escapeHtml(n.title)}</strong>${
            n.body ? `<br><span style="color:#64748b">${escapeHtml(n.body)}</span>` : ""
          }</li>`,
      )
      .join("");

    await sendTransactionalEmail({
      to: email,
      subject: `${BRAND_NAME}: ${notifications.length} new notification${
        notifications.length === 1 ? "" : "s"
      }`,
      htmlContent: `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">
          <h2 style="margin:0 0 12px">Your ${frequency} digest</h2>
          <ul style="padding-left:18px;margin:0">${items}</ul>
        </div>`,
      textContent: notifications.map((n) => `- ${n.title}${n.body ? `: ${n.body}` : ""}`).join("\n"),
    });
    sent += 1;
  }

  return { processed: prefsRows.length, sent };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
