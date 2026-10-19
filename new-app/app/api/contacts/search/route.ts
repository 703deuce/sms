import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { searchContacts } from "@/lib/server/contacts";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const data = await searchContacts(workspaceId, q, Number(url.searchParams.get("limit") || 10));
    return NextResponse.json({
      data: data.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.company || c.phone,
        phone: c.phone,
        company: c.company,
        status: c.status,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
