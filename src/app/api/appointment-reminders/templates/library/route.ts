import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  getLibraryTemplateByParts,
  getTemplateLibraryCatalog,
  listLibraryIndustries,
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
    const channel = searchParams.get("channel") === "email" ? "email" : "sms";

    if (industry && messageType) {
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
