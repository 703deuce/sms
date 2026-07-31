import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const tickets = await getPrisma().supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: tickets });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      email?: string;
      subject?: string;
      body?: string;
      workspaceId?: string | null;
    };
    const email = (body.email || "").trim();
    const subject = (body.subject || "").trim();
    const message = (body.body || "").trim();
    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: "email, subject, and body are required" },
        { status: 400 },
      );
    }
    const ticket = await getPrisma().supportTicket.create({
      data: {
        email,
        subject,
        body: message,
        workspaceId: body.workspaceId?.trim() || null,
        status: "open",
      },
    });
    return NextResponse.json({ data: ticket });
  } catch (err) {
    return jsonError(err, 400);
  }
}
