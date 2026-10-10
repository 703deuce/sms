import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  getLibraryTemplateByParts,
  getTemplateLibraryCatalog,
  listLibraryIndustries,
  listLibraryTemplateSummaries,
  listMessageTypesForIndustry,
} from "@/lib/appointment-reminders/template-library/catalog";
import {
  INDUSTRY_LABELS,
  MESSAGE_TYPE_LABELS,
  type TemplateMessageType,
} from "@/lib/appointment-reminders/template-library/types";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const industry = searchParams.get("industry");
    const messageType = searchParams.get("messageType") as TemplateMessageType | null;
    const channelParam = searchParams.get("channel");
    const channel =
      channelParam === "email" ? "email" : channelParam === "sms" ? "sms" : undefined;

    if (searchParams.get("summaries") === "1") {
      const page = Math.max(1, Number(searchParams.get("page") || "1"));
      const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "50")));
      const { rows, total } = listLibraryTemplateSummaries({
        industry: industry || undefined,
        messageType: messageType || undefined,
        channel,
        q: searchParams.get("q") || undefined,
        recommendedOnly: searchParams.get("recommended") === "1",
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
      return NextResponse.json({ data: { rows, total, page, pageSize } });
    }

    if (industry && messageType) {
      const channel = channelParam === "email" ? "email" : "sms";
      const entry = getLibraryTemplateByParts(industry, messageType, channel);
      if (!entry) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ data: entry });
    }

    const catalog = getTemplateLibraryCatalog();
    return NextResponse.json({
      data: {
        version: catalog.version,
        templateCount: catalog.templates.length,
        industries: listLibraryIndustries().map((id) => ({
          id,
          label: INDUSTRY_LABELS[id] || id,
          messageTypes: listMessageTypesForIndustry(id).map((mt) => ({
            id: mt,
            label: MESSAGE_TYPE_LABELS[mt] || mt,
          })),
        })),
        messageTypeLabels: MESSAGE_TYPE_LABELS,
        industryLabels: INDUSTRY_LABELS,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
