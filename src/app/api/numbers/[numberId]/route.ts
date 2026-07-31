import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const row = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: mapPhoneNumber(row) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as {
      friendlyName?: string;
      status?: string;
    };
    const existing = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await getPrisma().phoneNumber.update({
      where: { id: numberId },
      data: {
        friendlyName: body.friendlyName ?? undefined,
        status: body.status ?? undefined,
      },
    });
    return NextResponse.json({ data: mapPhoneNumber(updated) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
