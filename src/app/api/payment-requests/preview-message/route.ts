import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { resolvePaymentRequestMessaging } from "@/lib/payment-requests/messaging";
import { buildPaymentRequestPublicUrl } from "@/lib/payment-requests/public-url";
import { parseAmountToMinor } from "@/lib/payment-requests/format";
import { publicToken } from "@/lib/appointments/settings";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const body = (await request.json()) as Record<string, unknown>;
    const amountMinor =
      typeof body.amountMinor === "number"
        ? body.amountMinor
        : parseAmountToMinor(String(body.amount || ""));
    if (!amountMinor) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const description = String(body.description || "Payment").trim();
    const previewUrl = buildPaymentRequestPublicUrl(publicToken());
    const resolved = await resolvePaymentRequestMessaging(workspaceId, {
      businessDisplayName: body.businessName ? String(body.businessName) : "",
      amountMinor,
      currency: String(body.currency || "usd"),
      description,
      customerNote: body.customerNote ? String(body.customerNote) : null,
      publicUrl: previewUrl,
    });
    return NextResponse.json({ data: resolved });
  } catch (err) {
    return jsonError(err, 400);
  }
}
