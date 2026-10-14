import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { evaluateAndPersistReputationAlerts } from "@/lib/reputation/alert-rules";
import { loadReputationAlertsData } from "@/lib/reputation/alerts-data";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const data = await loadReputationAlertsData(businessId);
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load alerts");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const alertId = body.alertId as string | undefined;
    const action = String(body.action ?? "resolve").toLowerCase();
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);

    if (action === "run") {
      const created = await evaluateAndPersistReputationAlerts(businessId);
      const data = await loadReputationAlertsData(businessId);
      return NextResponse.json({ ok: true, created, data });
    }

    if (!alertId) {
      return NextResponse.json({ error: "alertId required" }, { status: 400 });
    }

    if (String(body.source ?? "").toLowerCase() === "synthesized") {
      return NextResponse.json({ ok: true, persisted: false });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("reputation_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("business_id", businessId);

    if (error) {
      if (/relation .*reputation_alerts|schema cache|does not exist/i.test(error.message)) {
        return NextResponse.json({ ok: true, persisted: false });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to resolve alert");
  }
}
