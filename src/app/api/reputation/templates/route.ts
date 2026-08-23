import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  archiveTemplate,
  createTemplate,
  duplicateTemplate,
  listTemplates,
  setDefaultTemplate,
  updateTemplate,
  type TemplateChannel,
} from "@/lib/reputation/templates";
import { sendReviewRequestEmail, sendReviewRequestSms } from "@/lib/reputation/review-sends";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const templates = await listTemplates(businessId, url.searchParams.get("archived") === "1");
    return NextResponse.json({ templates });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (body.action === "duplicate" && body.templateId) {
      const result = await duplicateTemplate(body.templateId, businessId, auth.organizationId);
      return NextResponse.json(result);
    }

    if (body.action === "test_send" && body.templateId) {
      const templates = await listTemplates(businessId);
      const tpl = templates.find((t) => t.id === body.templateId);
      if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      if (tpl.channel === "sms") {
        if (!body.toPhone) {
          return NextResponse.json({ error: "toPhone required for SMS test" }, { status: 400 });
        }
        const result = await sendReviewRequestSms({
          organizationId: auth.organizationId,
          businessId,
          customerPhone: body.toPhone,
          customerName: body.customerName ?? "Test",
          templateId: tpl.id,
        });
        return NextResponse.json({ ok: true, send: result });
      }
      if (!body.toEmail) {
        return NextResponse.json({ error: "toEmail required for email test" }, { status: 400 });
      }
      const result = await sendReviewRequestEmail({
        organizationId: auth.organizationId,
        businessId,
        customerEmail: body.toEmail,
        customerName: body.customerName ?? "Test",
        templateId: tpl.id,
      });
      return NextResponse.json({ ok: true, send: result });
    }

    if (!body.name || !body.body || !body.channel) {
      return NextResponse.json({ error: "name, body, channel required" }, { status: 400 });
    }
    const result = await createTemplate({
      organizationId: auth.organizationId,
      businessId,
      channel: body.channel as TemplateChannel,
      name: body.name,
      subject: body.subject,
      body: body.body,
      tone: body.tone,
      isDefault: Boolean(body.isDefault),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const templateId = body.templateId as string | undefined;
    if (!businessId || !templateId) {
      return NextResponse.json({ error: "businessId and templateId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (body.action === "archive") {
      await archiveTemplate(templateId, businessId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "set_default") {
      const template = await setDefaultTemplate(templateId, businessId);
      return NextResponse.json({ template });
    }

    const result = await updateTemplate(templateId, businessId, {
      name: body.name,
      subject: body.subject,
      body: body.body,
      tone: body.tone,
      channel: body.channel,
      isDefault: body.isDefault,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed");
  }
}
