import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const data = await loadLatestMomentumRun(businessId);

    const supabase = createServiceClient();
    const { data: attrs } = await supabase
      .from("review_campaign_attributions")
      .select("attribution_level")
      .eq("business_id", businessId);
    const campaignAttribution = {
      confirmed: (attrs ?? []).filter((a) => a.attribution_level === "confirmed").length,
      likely: (attrs ?? []).filter((a) => a.attribution_level === "likely").length,
      unattributed: (attrs ?? []).filter((a) => a.attribution_level === "unattributed").length,
    };

    if (!data) {
      return NextResponse.json({
        run: null,
        entities: [],
        tasks: [],
        campaignAttribution,
      });
    }

    return NextResponse.json({ ...data, campaignAttribution });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load momentum report");
  }
}
