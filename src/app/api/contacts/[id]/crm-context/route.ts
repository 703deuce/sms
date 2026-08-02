import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getContactCrmContext } from "@/lib/integrations/product/contact-crm-context";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: contactId } = await context.params;

    const contact = await getPrisma().contact.findFirst({
      where: { id: contactId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await getContactCrmContext(auth.workspaceId, contactId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
