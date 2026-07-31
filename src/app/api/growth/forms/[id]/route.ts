import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { parseFormConfig, type FormFieldKey, type OptInFormConfig } from "@/lib/forms/types";

function mapForm(row: {
  id: string;
  workspaceId: string;
  name: string;
  listName: string;
  slug: string | null;
  url: string | null;
  status: string;
  submissions: number;
  views: number;
  config: unknown;
  disclosureText: string | null;
  disclosureVersion: string | null;
  thankYouMessage: string | null;
  doubleOptIn: boolean;
  startCampaignId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const config = parseFormConfig(row.config);
  const base = getAppBaseUrl();
  const slug = row.slug || "";
  return {
    id: row.id,
    name: row.name,
    listName: row.listName,
    slug: row.slug,
    url: row.url || (slug ? `${base}/f/${slug}` : null),
    embedUrl: slug ? `${base}/embed/f/${slug}` : null,
    status: row.status,
    submissions: row.submissions,
    views: row.views,
    disclosureText: row.disclosureText,
    disclosureVersion: row.disclosureVersion,
    thankYouMessage: row.thankYouMessage,
    doubleOptIn: row.doubleOptIn,
    startCampaignId: row.startCampaignId,
    config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    embedCode: slug
      ? `<div id="transovo-form-${slug}"></div>\n<script src="${base}/embed/form.js" data-slug="${slug}" data-target="transovo-form-${slug}" async></script>`
      : null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const form = await getPrisma().optInForm.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data: mapForm(form) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      listName?: string;
      disclosureText?: string;
      thankYouMessage?: string;
      doubleOptIn?: boolean;
      startCampaignId?: string | null;
      status?: string;
      fields?: FormFieldKey[];
      branding?: OptInFormConfig["branding"];
      headline?: string;
      subheadline?: string;
      buttonLabel?: string;
    };

    const existing = await getPrisma().optInForm.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const prevConfig = parseFormConfig(existing.config);
    const nextConfig: OptInFormConfig = {
      fields: body.fields ?? prevConfig.fields,
      branding: body.branding ?? prevConfig.branding,
      headline: body.headline ?? prevConfig.headline,
      subheadline: body.subheadline ?? prevConfig.subheadline,
      buttonLabel: body.buttonLabel ?? prevConfig.buttonLabel,
    };

    let status = existing.status;
    if (body.status) {
      const s = body.status.toLowerCase();
      if (s === "active") status = "Active";
      else if (s === "paused" || s === "inactive") status = "Paused";
      else if (s === "archived") status = "Archived";
    }

    const row = await getPrisma().optInForm.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        listName: body.listName?.trim() || undefined,
        disclosureText: body.disclosureText ?? undefined,
        thankYouMessage: body.thankYouMessage ?? undefined,
        doubleOptIn: body.doubleOptIn ?? undefined,
        startCampaignId:
          body.startCampaignId === null ? null : body.startCampaignId || undefined,
        status,
        config: nextConfig as object,
      },
    });

    return NextResponse.json({ data: mapForm(row) });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const existing = await getPrisma().optInForm.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().optInForm.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
