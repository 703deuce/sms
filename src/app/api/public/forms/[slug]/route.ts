import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { parseFormConfig } from "@/lib/forms/types";
import { submitOptInForm } from "@/lib/forms/submit-opt-in";

function requestMeta(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  const referrer = request.headers.get("referer") || request.headers.get("referrer");
  const embedHost = request.headers.get("x-embed-host");
  return { ip, userAgent, referrer, embedHost };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const prisma = getPrisma();
  const form = await prisma.optInForm.findFirst({
    where: { slug, status: "Active" },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: form.workspaceId },
    select: { name: true },
  });

  const config = parseFormConfig(form.config);
  const branding = {
    businessName: config.branding?.businessName || workspace?.name || "Transovo",
    primaryColor: config.branding?.primaryColor || "#2563eb",
    accentColor: config.branding?.accentColor || "#0ea5e9",
    theme: config.branding?.theme || "light",
    logoUrl: config.branding?.logoUrl || null,
  };

  // Track page views (hosted page + embed loads)
  const trackView = request.headers.get("x-track-view") !== "0";
  if (trackView) {
    await prisma.optInForm.update({
      where: { id: form.id },
      data: { views: { increment: 1 } },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    data: {
      name: form.name,
      slug: form.slug,
      disclosureText: form.disclosureText,
      thankYouMessage: form.thankYouMessage,
      doubleOptIn: form.doubleOptIn,
      fields: config.fields,
      branding,
      headline: config.headline,
      subheadline: config.subheadline,
      buttonLabel: config.buttonLabel || "Subscribe",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const prisma = getPrisma();
    const form = await prisma.optInForm.findFirst({
      where: { slug, status: "Active" },
    });
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const body = (await request.json()) as {
      phone?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      consent?: boolean;
      embedHost?: string;
    };

    const meta = requestMeta(request);
    const result = await submitOptInForm(form, {
      phone: body.phone || "",
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      consent: Boolean(body.consent),
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer,
      embedHost: body.embedHost || meta.embedHost,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      thankYouMessage: result.thankYouMessage,
    });
  } catch (err) {
    console.error("[public/forms]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 400 },
    );
  }
}
