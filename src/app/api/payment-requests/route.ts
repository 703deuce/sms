import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import {
  createAndSendPaymentRequest,
  listPaymentRequests,
  summarizePaymentRequests,
} from "@/lib/payment-requests/service";
import { parseAmountToMinor } from "@/lib/payment-requests/format";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const url = new URL(request.url);
    const summaryOnly = url.searchParams.get("summary") === "1";

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const dateScope = {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    };

    if (summaryOnly) {
      const summary = await summarizePaymentRequests(workspaceId, dateScope);
      return NextResponse.json({ data: summary });
    }

    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "10");
    const list = await listPaymentRequests(workspaceId, {
      search: url.searchParams.get("search") || undefined,
      status: url.searchParams.get("status") || "all",
      page,
      pageSize,
      ...dateScope,
    });

    const summary = await summarizePaymentRequests(workspaceId, dateScope);
    return NextResponse.json({ data: { ...list, summary } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const body = (await request.json()) as Record<string, unknown>;

    const amountMinor =
      typeof body.amountMinor === "number"
        ? body.amountMinor
        : parseAmountToMinor(String(body.amount || body.amountDollars || ""));
    if (!amountMinor || amountMinor < 50) {
      return NextResponse.json({ error: "Amount must be at least $0.50" }, { status: 400 });
    }

    const description = String(body.description || "").trim();
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const phone = String(body.customerPhoneE164 || body.phone || "").trim();
    if (!phone) {
      return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      (body.idempotencyKey ? String(body.idempotencyKey) : undefined);

    let expiresAt: Date | null = null;
    const expiration = String(body.expiration || "none");
    if (expiration === "24h") expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (expiration === "3d") expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    if (expiration === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await createAndSendPaymentRequest({
      workspaceId,
      customerPhoneE164: phone,
      amountMinor,
      currency: body.currency ? String(body.currency) : "usd",
      description,
      customerNote: body.customerNote ? String(body.customerNote) : null,
      customerName: body.customerName ? String(body.customerName) : null,
      contactId: body.contactId ? String(body.contactId) : null,
      conversationId: body.conversationId ? String(body.conversationId) : null,
      missedCallId: body.missedCallId ? String(body.missedCallId) : null,
      appointmentId: body.appointmentId ? String(body.appointmentId) : null,
      sourceType: body.sourceType ? (String(body.sourceType) as never) : undefined,
      createdByUserId: auth.session.userId,
      expiresAt,
      idempotencyKey: idempotencyKey || null,
      sendSms: body.sendSms !== false,
      deliveryMethod:
        body.deliveryMethod === "invoice" || body.sendInvoice === true ? "invoice" : "checkout",
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
