import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig, resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import { listActiveStoreProducts } from "@/lib/appointments/service-booking/store-checkout";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }

    const products = await listActiveStoreProducts(workspace.id);

    return NextResponse.json({
      data: {
        workspace: {
          slug: workspace.slug,
          name: workspace.displayName || workspace.name,
          logoUrl: workspace.logoUrl,
        },
        products,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
