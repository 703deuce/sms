import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig, resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import {
  processStoreCheckout,
  type StoreProductKind,
} from "@/lib/appointments/service-booking/store-checkout";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind || "") as StoreProductKind;
    const productId = String(body.productId || "");
    const phone = String(body.phone || "");

    if (!productId || !kind || !phone) {
      return NextResponse.json({ error: "Product, type, and phone are required" }, { status: 400 });
    }

    if (!["package", "gift", "membership"].includes(kind)) {
      return NextResponse.json({ error: "Invalid product type" }, { status: 400 });
    }

    const result = await processStoreCheckout({
      workspaceSlug: slug,
      workspaceId: workspace.id,
      kind,
      productId,
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      phone,
      email: body.email ? String(body.email) : undefined,
      amountCents: body.amountCents != null ? Number(body.amountCents) : undefined,
      recipientName: body.recipientName ? String(body.recipientName) : undefined,
      recipientEmail: body.recipientEmail ? String(body.recipientEmail) : undefined,
      giftMessage: body.giftMessage ? String(body.giftMessage) : undefined,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
