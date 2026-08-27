import type { MessagingRegistration } from "@/lib/domain";
import type { PhoneNumber } from "@/lib/types";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";

export function deriveRequiredActions(
  reg: MessagingRegistration | null | undefined,
  numbers: PhoneNumber[],
): string[] {
  const actions: string[] = [];
  const activeNumbers = numbers.filter((n) => n.status === "Active");
  const brandApproved = (reg?.brandStatus || "").toLowerCase() === "approved";
  const campaignApproved = (reg?.campaignStatus || "").toLowerCase() === "approved";
  const registrationReady =
    (reg?.overallStatus || "").toLowerCase() === "ready" &&
    Boolean(reg?.phoneAttached && reg?.phoneE164);

  if (!reg?.legalBusinessName) actions.push("Complete business profile with legal entity details");
  if (!reg?.websiteUrl) actions.push("Add website URL to brand registration");
  const samples = reg?.sampleMessages || [];
  if (!brandApproved && samples.length < 2) {
    actions.push("Provide 2 additional sample messages");
  }
  if (!reg?.optInDescription) actions.push("Confirm opt-in disclosure on website form");
  if (activeNumbers.length === 0 && !reg?.phoneE164) actions.push("Purchase or assign a phone number");

  const tollFree = activeNumbers.filter((n) => String(n.type || "").toLowerCase().includes("toll"));
  const local = activeNumbers.filter((n) => !String(n.type || "").toLowerCase().includes("toll"));
  const hasApprovedLocal = local.some((n) => isPhoneMessagingApproved(n));

  if (tollFree.length > 0 && !hasApprovedLocal) {
    const pendingTfv = tollFree.some((n) => !isPhoneMessagingApproved(n));
    if (pendingTfv) actions.push("Complete toll-free verification for trial numbers");
  }

  if (local.length > 0 && !registrationReady && !hasApprovedLocal) {
    const pendingA2p = local.some((n) => !isPhoneMessagingApproved(n));
    if (pendingA2p) actions.push("Complete A2P registration for local numbers");
  }

  if (!brandApproved && local.length > 0) {
    actions.push("Complete brand registration review");
  }
  if (!campaignApproved && local.length > 0) {
    actions.push("Submit campaign registration for carrier review");
  }
  return actions;
}

export function phoneNumbersSummary(numbers: PhoneNumber[]): string {
  const activeNumbers = numbers.filter((n) => n.status === "Active");
  if (activeNumbers.length === 0) return "No numbers";
  const approved = activeNumbers.filter((n) => isPhoneMessagingApproved(n));
  if (approved.length > 0) {
    const pending = activeNumbers.length - approved.length;
    if (pending > 0) return `${approved.length} messaging-ready · ${pending} other`;
    return `${activeNumbers.length} active`;
  }
  const pending = activeNumbers.filter((n) => !isPhoneMessagingApproved(n)).length;
  if (pending > 0) return `${activeNumbers.length} active · ${pending} pending`;
  return `${activeNumbers.length} active`;
}

export function tollFreeSummary(numbers: PhoneNumber[]): string {
  const tollFree = numbers.filter((n) => String(n.type || "").toLowerCase().includes("toll"));
  if (tollFree.length === 0) return "None";
  const approved = tollFree.every((n) => isPhoneMessagingApproved(n));
  return approved ? "Verified" : "Pending";
}

export type GettingStartedStep = {
  id: number;
  label: string;
  done: boolean;
  href?: string;
};

export function deriveGettingStartedSteps(input: {
  hasBusiness: boolean;
  hasPayment: boolean;
  a2pReady: boolean;
  hasNumber: boolean;
  contactCount: number;
  templateCount: number;
  hasSentCampaign: boolean;
}): GettingStartedStep[] {
  return [
    { id: 1, label: "Create account", done: true },
    {
      id: 2,
      label: "Add business details",
      done: input.hasBusiness,
      href: "/compliance/business",
    },
    {
      id: 3,
      label: "Add payment method",
      done: input.hasPayment,
      href: "/settings/billing",
    },
    {
      id: 4,
      label: "Complete A2P registration",
      done: input.a2pReady,
      href: "/compliance",
    },
    {
      id: 5,
      label: "Choose phone number",
      done: input.hasNumber,
      href: "/numbers",
    },
    {
      id: 6,
      label: "Verify personal test number",
      done: false,
      href: "/send/test",
    },
    {
      id: 7,
      label: "Import contacts",
      done: input.contactCount > 0,
      href: "/contacts/imports",
    },
    {
      id: 8,
      label: "Create first message",
      done: input.templateCount > 0,
      href: "/templates/new",
    },
    {
      id: 9,
      label: "Send first campaign",
      done: input.hasSentCampaign,
      href: "/send",
    },
    {
      id: 10,
      label: "Set up opt-in method",
      done: false,
      href: "/grow/keywords",
    },
  ];
}
