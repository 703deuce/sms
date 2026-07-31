import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const form = await getPrisma().optInForm.findFirst({
    where: { slug, status: "Active" },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({
    data: {
      name: form.name,
      disclosureText: form.disclosureText,
      thankYouMessage: form.thankYouMessage,
      doubleOptIn: form.doubleOptIn,
      config: form.config,
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
    };

    if (!body.consent) {
      return NextResponse.json({ error: "Consent checkbox is required" }, { status: 400 });
    }
    if (!body.phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const phone = normalizeE164(body.phone);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");

    let contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: form.workspaceId, phone } },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          workspaceId: form.workspaceId,
          phone,
          firstName: body.firstName || null,
          lastName: body.lastName || null,
          email: body.email || null,
          status: "SUBSCRIBED",
          consentSource: `form:${form.slug}`,
          consentDate: new Date(),
        },
      });
    } else {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: "SUBSCRIBED",
          firstName: body.firstName || contact.firstName,
          lastName: body.lastName || contact.lastName,
          email: body.email || contact.email,
          consentSource: `form:${form.slug}`,
          consentDate: new Date(),
        },
      });
    }

    await prisma.consentRecord.create({
      data: {
        workspaceId: form.workspaceId,
        contactId: contact.id,
        phone,
        consentDate: new Date(),
        source: `form:${form.slug}`,
        disclosureVersion: form.disclosureVersion || "form-v1",
        disclosureText: form.disclosureText,
        ipAddress: ip,
        userAgent,
        formUrl: form.url,
        doubleOptInStatus: form.doubleOptIn ? "pending" : "not_required",
      },
    });

    if (form.listName) {
      let list = await prisma.contactList.findFirst({
        where: { workspaceId: form.workspaceId, name: form.listName },
      });
      if (!list) {
        list = await prisma.contactList.create({
          data: { workspaceId: form.workspaceId, name: form.listName },
        });
      }
      try {
        await prisma.contactListMember.create({
          data: { listId: list.id, contactId: contact.id },
        });
      } catch {
        // already member
      }
    }

    if (form.startCampaignId) {
      try {
        await enrollContactInCampaign({
          workspaceId: form.workspaceId,
          campaignId: form.startCampaignId,
          phone,
          contactId: contact.id,
          metadata: { source: "form", formSlug: form.slug },
        });
      } catch (err) {
        console.error("[public/forms] enroll failed", err);
      }
    }

    await prisma.optInForm.update({
      where: { id: form.id },
      data: { submissions: { increment: 1 } },
    });

    const { emitAutomationEvent } = await import("@/lib/automations/events");
    await emitAutomationEvent(form.workspaceId, "form.submitted", contact.id, {
      formSlug: form.slug || slug,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      thankYouMessage: form.thankYouMessage || "Thanks — you're subscribed!",
    });
  } catch (err) {
    console.error("[public/forms]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 400 },
    );
  }
}
