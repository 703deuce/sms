import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listRecentIntegrationContextForContact } from "@/lib/integrations/framework/contact-links";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;

    const contact = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await listRecentIntegrationContextForContact(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
