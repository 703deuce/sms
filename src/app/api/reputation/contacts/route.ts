import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  listBusinessContacts,
  setContactSuppression,
  upsertBusinessContact,
} from "@/lib/reputation/contacts";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("contacts.read", auth.organizationId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const cursor = url.searchParams.get("cursor");
    const q = url.searchParams.get("q") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const result = await listBusinessContacts(businessId, { cursor, q, limit });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to list contacts");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const result = await upsertBusinessContact({
      organizationId: auth.organizationId,
      businessId,
      firstName: body.firstName,
      lastName: body.lastName,
      customerName: body.customerName,
      phone: body.phone,
      email: body.email,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      source: body.source ?? "manual",
      notes: body.notes,
      consentState: body.consentState,
      consentSource: body.consentSource,
      customerDate: body.customerDate,
      lastServiceDate: body.lastServiceDate,
      externalCustomerId: body.externalCustomerId,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to save contact");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const contactId = body.contactId as string | undefined;
    if (!businessId || !contactId) {
      return NextResponse.json({ error: "businessId and contactId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (body.action === "suppress" || body.action === "unsuppress") {
      const channel = String(body.channel ?? "both");
      await setContactSuppression({
        organizationId: auth.organizationId,
        businessId,
        contactId,
        smsOptOut:
          channel === "email"
            ? undefined
            : body.action === "suppress"
              ? true
              : false,
        emailUnsubscribed:
          channel === "sms"
            ? undefined
            : body.action === "suppress"
              ? true
              : false,
      });
      return NextResponse.json({ ok: true });
    }

    // Update identity fields via upsert patch
    const result = await upsertBusinessContact({
      organizationId: auth.organizationId,
      businessId,
      firstName: body.firstName,
      lastName: body.lastName,
      customerName: body.customerName,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
      source: body.source ?? "manual_edit",
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to update contact");
  }
}
