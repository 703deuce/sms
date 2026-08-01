import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getCapabilityMatrixTable } from "@/lib/crm/capability";
import { getFeatureMatrix } from "@/lib/crm/feature-matrix";
import { CRM_PROVIDER_IDS, isCrmProvider } from "@/lib/crm/registry";
import type { CrmProviderId } from "@/lib/crm/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const providerParam = new URL(request.url).searchParams.get("provider")?.trim();

    if (providerParam) {
      if (!isCrmProvider(providerParam)) {
        return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
      }
      return NextResponse.json({
        data: {
          provider: providerParam,
          features: getFeatureMatrix(providerParam),
          matrix: getCapabilityMatrixTable(),
        },
      });
    }

    const data = CRM_PROVIDER_IDS.map((id: CrmProviderId) => ({
      provider: id,
      features: getFeatureMatrix(id),
    }));
    return NextResponse.json({
      data,
      matrix: getCapabilityMatrixTable(),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
