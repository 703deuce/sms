import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildFaxDeliveryConfirmation } from "@/lib/fax/fax-delivery-confirmation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const { text, canDownload } = await buildFaxDeliveryConfirmation(auth.workspaceId, id);
    if (!canDownload) {
      return jsonError(
        new Error("Delivery confirmation is available only after the fax is delivered or received."),
        400,
      );
    }
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="fax-delivery-confirmation-${id}.txt"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
