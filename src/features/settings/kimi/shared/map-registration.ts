import type { MessagingRegistration } from "@/lib/domain";
import type { BusinessRegistrationCardData } from "@/components/settings/kimi-ui/business/types";
import type { MessagingRegistrationView } from "@/components/settings/kimi-ui/messaging/types";

function normalizeStatus(status: string | null | undefined): "approved" | "pending" | "rejected" {
  const value = (status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected" || value === "failed") return "rejected";
  return "pending";
}

export function mapBusinessRegistration(
  registration: MessagingRegistration | null,
): BusinessRegistrationCardData {
  return {
    legalBusinessName: registration?.legalBusinessName || "—",
    dbaName: registration?.dbaName || "",
    businessType: registration?.businessType || "—",
    businessIndustry: registration?.businessIndustry || "—",
    businessRegistrationId: registration?.businessRegistrationId || "—",
    websiteUrl: registration?.websiteUrl || "",
    street: registration?.street || "",
    city: registration?.city || "",
    region: registration?.region || "",
    postalCode: registration?.postalCode || "",
    country: registration?.country || "US",
    contactEmail: registration?.contactEmail || "",
    contactPhone: registration?.contactPhone || "",
    brandStatus: normalizeStatus(registration?.brandStatus),
    campaignStatus: normalizeStatus(registration?.campaignStatus),
    updatedAt: registration?.updatedAt
      ? new Date(registration.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

export function mapMessagingRegistrationView(
  registration: MessagingRegistration | null,
): MessagingRegistrationView {
  const samples = registration?.sampleMessages || [];
  const sampleMessages =
    samples.length > 0
      ? samples
      : ["Sample message for compliance records. Reply STOP to opt out."];

  const status = normalizeStatus(registration?.campaignStatus || registration?.brandStatus);
  return {
    status,
    brandName: registration?.legalBusinessName || registration?.dbaName || "—",
    useCase: registration?.useCase || "Customer care",
    useCaseDescription:
      registration?.useCaseDescription ||
      "SMS notifications and customer support messages for subscribers who opted in.",
    optInDescription:
      registration?.optInDescription ||
      "Subscribers opt in via web form, keyword, or written consent.",
    messageVolume: registration?.messageVolume || "—",
    vertical: registration?.vertical || "—",
    submittedAt: registration?.updatedAt
      ? new Date(registration.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    approvedAt:
      status === "approved" && registration?.updatedAt
        ? new Date(registration.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    sampleMessages,
    helpMessage: registration?.helpMessage || "",
    stopMessage: registration?.stopMessage || "",
    consentText: "",
    termsVersion: "1",
    consentCapturedAt: registration?.updatedAt
      ? new Date(registration.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—",
  };
}
