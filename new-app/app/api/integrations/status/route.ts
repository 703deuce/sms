import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listConnections, isStripeEnvConfigured } from "@/lib/integrations/connections";
import { listWorkspaceCalendarConnections } from "@/lib/calendar/connections";
import { providerEnvReady } from "@/lib/crm/registry";
import { getMerchantPaymentStatus } from "@/lib/merchant-payments/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [connections, calendars, payments] = await Promise.all([
      listConnections(auth.workspaceId),
      listWorkspaceCalendarConnections(auth.workspaceId),
      getMerchantPaymentStatus(auth.workspaceId),
    ]);

    const crmEnv = {
      zoho: providerEnvReady("zoho"),
      pipedrive: providerEnvReady("pipedrive"),
      salesforce: providerEnvReady("salesforce"),
    };

    return NextResponse.json({
      data: {
        connections,
        calendars,
        payments,
        stripePlatformConfigured: isStripeEnvConfigured(),
        crmEnv,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
