import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { createPaymentLink } from "@/lib/payments/create-link";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().paymentLink.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      phone?: string;
      amountCents?: number;
      currency?: string;
      description?: string;
      contactId?: string;
      campaignId?: string;
      sendSms?: boolean;
      smsBody?: string;
    };
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "phone required" }, { status: 400 });
    }
    const link = await createPaymentLink({
      workspaceId: auth.workspaceId,
      phone: body.phone,
      amountCents: Number(body.amountCents || 0),
      currency: body.currency,
      description: body.description,
      contactId: body.contactId,
      campaignId: body.campaignId,
    });

    let smsResult: unknown = null;
    if (body.sendSms) {
      const text =
        body.smsBody?.trim() ||
        `Pay here: ${link.url}`;
      smsResult = await sendQuickSms({
        workspaceId: auth.workspaceId,
        to: body.phone,
        body: text.includes(link.url) ? text : `${text} ${link.url}`,
      });
    }

    return NextResponse.json({ data: link, sms: smsResult }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
