import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { buildVCard } from "@/lib/contact-cards/vcard";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const row = await getPrisma().contactCardProfile.findUnique({
      where: { workspaceId: auth.workspaceId },
    });
    return NextResponse.json({
      data: row
        ? {
            ...row,
            vcard: buildVCard(row),
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      businessName?: string;
      phone?: string;
      website?: string;
      email?: string;
      address?: string;
      logoUrl?: string;
      attachToWelcomeMms?: boolean;
    };
    if (!body.businessName?.trim()) {
      return NextResponse.json({ error: "businessName required" }, { status: 400 });
    }
    const row = await getPrisma().contactCardProfile.upsert({
      where: { workspaceId: auth.workspaceId },
      create: {
        workspaceId: auth.workspaceId,
        businessName: body.businessName.trim(),
        phone: body.phone,
        website: body.website,
        email: body.email,
        address: body.address,
        logoUrl: body.logoUrl,
        attachToWelcomeMms: body.attachToWelcomeMms ?? false,
      },
      update: {
        businessName: body.businessName.trim(),
        phone: body.phone,
        website: body.website,
        email: body.email,
        address: body.address,
        logoUrl: body.logoUrl,
        ...(body.attachToWelcomeMms !== undefined
          ? { attachToWelcomeMms: body.attachToWelcomeMms }
          : {}),
      },
    });
    return NextResponse.json({
      data: {
        ...row,
        vcard: buildVCard(row),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
