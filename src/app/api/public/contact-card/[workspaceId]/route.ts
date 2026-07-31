import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { buildVCard } from "@/lib/contact-cards/vcard";

/** Public vCard download for a workspace's contact card (used for welcome MMS). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const profile = await getPrisma().contactCardProfile.findUnique({
      where: { workspaceId },
    });
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const vcard = buildVCard(profile);
    const filename = `${(profile.businessName || "contact").replace(/[^a-z0-9]+/gi, "-")}.vcf`;
    return new NextResponse(vcard, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
