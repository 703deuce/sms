import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

type Ctx = { params: Promise<{ linkId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { linkId } = await ctx.params;
  const row = await getPrisma().paymentLink.findUnique({ where: { id: linkId } });
  if (!row) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      id: row.id,
      amountCents: row.amountCents,
      currency: row.currency,
      description: row.description,
      status: row.status,
    },
  });
}
