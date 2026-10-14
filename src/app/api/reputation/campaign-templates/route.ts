import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import {
  listCampaignSystemTemplates,
  recommendCampaignTemplate,
  type CampaignTemplateFilter,
} from "@/lib/reputation/campaign-templates";

const FILTERS = new Set<CampaignTemplateFilter>([
  "sms",
  "email",
  "multi-channel",
  "automatic",
  "manual-csv",
  "service-business",
  "appointment-business",
  "past-customer-reactivation",
]);

export async function GET(request: Request) {
  try {
    await requireAuth();
    const url = new URL(request.url);
    const raw = url.searchParams.getAll("filter").concat(
      url.searchParams.get("filters")?.split(",").filter(Boolean) ?? []
    );
    const filters = raw.filter((f): f is CampaignTemplateFilter =>
      FILTERS.has(f as CampaignTemplateFilter)
    );
    const templates = listCampaignSystemTemplates(filters.length ? filters : undefined);
    const recommended = recommendCampaignTemplate({
      hasSmsConsentCapability: url.searchParams.get("sms") !== "0",
      isHomeService: url.searchParams.get("homeService") === "1",
    });
    return NextResponse.json({
      templates,
      recommendedId: recommended.id,
      featuredId: templates.find((t) => t.featured)?.id ?? "sms-email-follow-up",
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list templates");
  }
}
