import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { applyMapping, type CsvMapTarget } from "@/lib/reputation/bulk-csv";
import { validateBulkRecipients } from "@/lib/reputation/bulk-validate";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      headers,
      rows,
      mapping,
      duplicateProtectionDays,
    } = body as {
      businessId?: string;
      headers?: string[];
      rows?: string[][];
      mapping?: Record<string, CsvMapTarget>;
      duplicateProtectionDays?: number;
    };

    if (!businessId || !headers?.length || !rows || !mapping) {
      return NextResponse.json({ error: "businessId, headers, rows, and mapping required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const mapped = applyMapping(headers, rows, mapping);
    const result = await validateBulkRecipients({
      businessId,
      rows: mapped,
      duplicateProtectionDays: duplicateProtectionDays ?? 90,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Validation failed");
  }
}
