import "server-only";

import { getPrisma } from "@/lib/db";
import { logFaxActivity } from "../fax-service";

type AutomationCondition = {
  field: string;
  operator: string;
  value?: string;
};

type AutomationAction = {
  type: string;
  config?: Record<string, unknown>;
};

function matchesCondition(
  condition: AutomationCondition,
  ctx: Record<string, unknown>,
): boolean {
  const actual = String(ctx[condition.field] ?? "");
  const expected = String(condition.value ?? "");
  switch (condition.operator) {
    case "equals":
      return actual.toLowerCase() === expected.toLowerCase();
    case "contains":
      return actual.toLowerCase().includes(expected.toLowerCase());
    case "exists":
      return Boolean(actual);
    default:
      return false;
  }
}

export async function runFaxAutomations(workspaceId: string, transmissionId: string) {
  const prisma = getPrisma();
  const rules = await prisma.faxAutomationRule.findMany({
    where: { workspaceId, enabled: true },
  });
  if (!rules.length) return;

  const transmission = await prisma.faxTransmission.findFirst({
    where: { id: transmissionId, workspaceId },
    include: { intelligence: true },
  });
  if (!transmission) return;

  const ctx: Record<string, unknown> = {
    direction: transmission.direction,
    fromE164: transmission.fromE164 || "",
    toE164: transmission.toE164 || "",
    documentType: transmission.intelligence?.documentType || "",
    priority: transmission.priority || "normal",
    folder: transmission.folder,
  };

  for (const rule of rules) {
    const conditions = (rule.conditionsJson || []) as AutomationCondition[];
    const actions = (rule.actionsJson || []) as AutomationAction[];
    const allMatch = conditions.every((c) => matchesCondition(c, ctx));
    if (!allMatch) continue;

    for (const action of actions) {
      await executeAutomationAction(workspaceId, transmissionId, action);
    }

    await prisma.faxAutomationRule.update({
      where: { id: rule.id },
      data: { lastRunAt: new Date() },
    });
  }
}

async function executeAutomationAction(
  workspaceId: string,
  transmissionId: string,
  action: AutomationAction,
) {
  const prisma = getPrisma();
  switch (action.type) {
    case "apply_tag": {
      const tag = String(action.config?.tag || "").trim();
      if (!tag) break;
      const tx = await prisma.faxTransmission.findFirst({ where: { id: transmissionId, workspaceId } });
      const tags = Array.isArray(tx?.tagsJson) ? [...(tx.tagsJson as string[])] : [];
      if (!tags.includes(tag)) tags.push(tag);
      await prisma.faxTransmission.update({
        where: { id: transmissionId },
        data: { tagsJson: tags as object },
      });
      break;
    }
    case "move_folder": {
      const folder = String(action.config?.folder || "").trim();
      if (folder) {
        await prisma.faxTransmission.update({
          where: { id: transmissionId },
          data: { folder },
        });
      }
      break;
    }
    case "mark_important":
      await prisma.faxTransmission.update({
        where: { id: transmissionId },
        data: { priority: "important" },
      });
      break;
    case "send_email": {
      const to = String(action.config?.email || "").trim();
      if (!to) break;
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
      await sendTransactionalEmail({
        to,
        subject: "Fax automation notification",
        htmlContent: appUrl
          ? `<p>A fax matched your automation rule.</p><p><a href="${appUrl}/fax/inbox">View fax</a></p>`
          : `<p>A fax matched your automation rule.</p>`,
        textContent: "A fax matched your automation rule.",
      }).catch(() => undefined);
      break;
    }
    default:
      break;
  }

  await logFaxActivity({
    workspaceId,
    faxTransmissionId: transmissionId,
    eventType: "automation_executed",
    message: `Action: ${action.type}`,
    metadata: action.config,
  });
}
