import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getFaxUsageSnapshot } from "@/lib/fax/fax-usage";
import { listFaxNumbers } from "@/lib/fax/fax-number-provisioning";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const usage = await getFaxUsageSnapshot(auth.workspaceId);
    const numbers = await listFaxNumbers(auth.workspaceId);
    const prisma = getPrisma();
    const counts = await prisma.faxTransmission.groupBy({
      by: ["direction", "status"],
      where: { workspaceId: auth.workspaceId },
      _count: true,
    });

    return NextResponse.json({ data: { usage, numbers, counts } });
  } catch (err) {
    return jsonError(err);
  }
}
