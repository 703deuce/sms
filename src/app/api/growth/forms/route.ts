import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().optInForm.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      listName?: string;
      disclosureText?: string;
      thankYouMessage?: string;
      doubleOptIn?: boolean;
      startCampaignId?: string;
      fields?: unknown;
    };
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${randomBytes(3).toString("hex")}`;
    const url = `${getAppBaseUrl()}/f/${slug}`;

    const created = await getPrisma().optInForm.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        listName: body.listName?.trim() || "Form subscribers",
        slug,
        url,
        disclosureText:
          body.disclosureText ||
          "By submitting, you agree to receive SMS from us. Msg&data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.",
        disclosureVersion: "form-v1",
        thankYouMessage: body.thankYouMessage || "Thanks — you're subscribed!",
        doubleOptIn: Boolean(body.doubleOptIn),
        startCampaignId: body.startCampaignId || null,
        config: { fields: body.fields || ["phone", "firstName"] },
        status: "Active",
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
