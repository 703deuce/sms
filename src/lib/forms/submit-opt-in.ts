import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseFormConfig, computeAgeFromDateOfBirth } from "@/lib/forms/types";

type FormRow = {
  id: string;
  workspaceId: string;
  slug: string | null;
  url: string | null;
  disclosureText: string | null;
  disclosureVersion: string | null;
  thankYouMessage: string | null;
  doubleOptIn: boolean;
  listName: string;
  startCampaignId: string | null;
  config?: unknown;
};

export type OptInSubmitInput = {
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  consent: boolean;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  embedHost?: string | null;
};

export type OptInSubmitResult =
  | { ok: true; thankYouMessage: string; contactId: string }
  | { ok: false; error: string };

export async function submitOptInForm(
  form: FormRow,
  input: OptInSubmitInput,
): Promise<OptInSubmitResult> {
  if (!input.consent) {
    return { ok: false, error: "Consent checkbox is required" };
  }
  if (!input.phone?.trim()) {
    return { ok: false, error: "Phone number is required" };
  }

  const formConfig = parseFormConfig(form.config);
  if (formConfig.ageGateMinAge) {
    const needsDob = formConfig.fields?.includes("dateOfBirth");
    if (needsDob && !input.dateOfBirth?.trim()) {
      return { ok: false, error: "Date of birth is required" };
    }
    if (input.dateOfBirth?.trim()) {
      const age = computeAgeFromDateOfBirth(input.dateOfBirth);
      if (age === null) {
        return { ok: false, error: "Invalid date of birth" };
      }
      if (age < formConfig.ageGateMinAge) {
        return { ok: false, error: `You must be at least ${formConfig.ageGateMinAge} years old to subscribe` };
      }
    }
  }

  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: form.workspaceId, phone },
  });
  if (suppressed) {
    return { ok: false, error: "This number cannot be subscribed. It may have opted out previously." };
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: form.workspaceId, phone } },
  });
  const isNew = !contact;

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: form.workspaceId,
        phone,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        email: input.email || null,
        status: "SUBSCRIBED",
        consentSource: `form:${form.slug}`,
        consentDate: new Date(),
        customFields: input.dateOfBirth
          ? ({ dateOfBirth: input.dateOfBirth } as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } else {
    if (contact.status === "BLOCKED" || contact.status === "UNSUBSCRIBED") {
      return { ok: false, error: "This contact cannot be subscribed." };
    }
    const existingCf =
      contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)
        : {};
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        status: "SUBSCRIBED",
        firstName: input.firstName || contact.firstName,
        lastName: input.lastName || contact.lastName,
        email: input.email || contact.email,
        consentSource: `form:${form.slug}`,
        consentDate: new Date(),
        customFields: {
          ...existingCf,
          ...(input.dateOfBirth ? { dateOfBirth: input.dateOfBirth } : {}),
        } as Prisma.InputJsonValue,
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
      ipAddress: input.ip,
      userAgent: input.userAgent,
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
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      await emitAutomationEvent(form.workspaceId, "list.member_added", contact.id, {
        listId: list.id,
      }).catch(() => undefined);
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
      console.error("[forms] campaign enroll failed", err);
    }
  }

  const payload: Record<string, unknown> = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    referrer: input.referrer,
    embedHost: input.embedHost,
  };

  await prisma.formSubmission.create({
    data: {
      workspaceId: form.workspaceId,
      formId: form.id,
      contactId: contact.id,
      phone,
      payload: payload as Prisma.InputJsonValue,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      referrer: input.referrer,
      embedHost: input.embedHost,
    },
  });

  await prisma.optInForm.update({
    where: { id: form.id },
    data: { submissions: { increment: 1 } },
  });

  const { emitAutomationEvent } = await import("@/lib/automations/events");
  await emitAutomationEvent(form.workspaceId, "form.submitted", contact.id, {
    formSlug: form.slug || "",
    sourceType: input.embedHost?.includes("widget") ? "popup" : undefined,
  }).catch(() => undefined);

  // Popup/widget submissions share form infrastructure — also fire popup trigger.
  const isPopup =
    Boolean(input.embedHost?.includes("widget")) ||
    Boolean(input.referrer?.includes("/embed/w/"));
  if (isPopup) {
    const widget = await prisma.growWidget.findFirst({
      where: { workspaceId: form.workspaceId, linkedFormId: form.id },
      select: { id: true, name: true, widgetType: true },
    });
    await emitAutomationEvent(form.workspaceId, "popup.submitted", contact.id, {
      popupId: widget?.id,
      formSlug: form.slug || "",
      sourceType: "popup",
      widgetType: widget?.widgetType,
    }).catch(() => undefined);
  }

  if (isNew) {
    await emitAutomationEvent(form.workspaceId, "customer.created", contact.id).catch(
      () => undefined,
    );
  }

  return {
    ok: true,
    thankYouMessage: form.thankYouMessage || "Thanks — you're subscribed!",
    contactId: contact.id,
  };
}
