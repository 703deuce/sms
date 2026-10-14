import "server-only";

import { getPrisma } from "@/lib/db";
import { listTemplates as listReviewTemplates } from "@/lib/reputation/templates";
import { getTemplateLibraryCatalog } from "@/lib/appointment-reminders/template-library/catalog";

export type UnifiedTemplateProduct =
  | "campaigns"
  | "reviews"
  | "appointment_reminders"
  | "mctb";

export type UnifiedTemplateRow = {
  id: string;
  product: UnifiedTemplateProduct;
  name: string;
  channel: string;
  body: string;
  subject?: string | null;
  category?: string | null;
  updatedAt?: string | null;
  editable: boolean;
  href?: string;
};

export async function loadUnifiedTemplates(
  workspaceId: string,
  product?: UnifiedTemplateProduct | "all"
): Promise<UnifiedTemplateRow[]> {
  const rows: UnifiedTemplateRow[] = [];
  const want = product ?? "all";

  if (want === "all" || want === "campaigns") {
    const prisma = getPrisma();
    const campaignTemplates = await prisma.template.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    for (const t of campaignTemplates) {
      rows.push({
        id: t.id,
        product: "campaigns",
        name: t.name,
        channel: t.channel,
        body: t.body,
        category: t.category,
        updatedAt: t.updatedAt.toISOString(),
        editable: true,
        href: `/templates`,
      });
    }
  }

  if (want === "all" || want === "reviews") {
    const reviewRows = await listReviewTemplates(workspaceId);
    for (const t of reviewRows) {
      rows.push({
        id: String(t.id),
        product: "reviews",
        name: String(t.name ?? "Review template"),
        channel: String(t.channel ?? "sms"),
        body: String(t.body ?? ""),
        subject: (t.subject as string | null) ?? null,
        updatedAt: (t.updated_at as string | null) ?? null,
        editable: true,
        href: `/reviews/templates`,
      });
    }
  }

  if (want === "all" || want === "appointment_reminders") {
    const library = getTemplateLibraryCatalog().templates.slice(0, 40);
    for (const t of library) {
      rows.push({
        id: `ar-lib-${t.id}`,
        product: "appointment_reminders",
        name: t.label,
        channel: t.channel === "email" ? "Email" : "SMS",
        body: t.body,
        category: t.messageType,
        editable: false,
        href: "/appointment-reminders/reminders/templates",
      });
    }
  }

  if (want === "all" || want === "mctb") {
    const setup = await getPrisma().solutionSetup.findFirst({
      where: { workspaceId, solutionKey: "missed_call_text_back" },
      select: { configJson: true },
    });
    const cfg = (setup?.configJson as Record<string, unknown> | null) ?? {};
    const textBack = (cfg.textBack as Record<string, unknown> | undefined)?.opener;
    if (typeof textBack === "string" && textBack.trim()) {
      rows.push({
        id: "mctb-recovery-opener",
        product: "mctb",
        name: "Recovery opener",
        channel: "SMS",
        body: textBack,
        editable: true,
        href: "/mctb/setup/text-back",
      });
    }
  }

  return rows;
}
