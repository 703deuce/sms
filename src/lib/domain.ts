/**
 * Domain types formerly sourced from @prisma/client.
 * Keep in sync with supabase/schema.sql.
 */

export type MessagingStepStatus =
  | "not_started"
  | "action_required"
  | "submitted"
  | "in_review"
  | "approved"
  | "failed"
  | "suspended"
  | "ready";

export type RecipientWorkflowStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "waiting"
  | "completed"
  | "stopped"
  | "failed"
  | "opted_out";

export type JobQueueStatus = "pending" | "processing" | "completed" | "failed" | "deferred";

export type InputJsonValue =
  | string
  | number
  | boolean
  | null
  | InputJsonValue[]
  | { [key: string]: InputJsonValue | undefined };

/** Namespace shim for former `Prisma.*` type references. */
export namespace Prisma {
  export type InputJsonValue =
    | string
    | number
    | boolean
    | null
    | InputJsonValue[]
    | { [key: string]: InputJsonValue | undefined };

  export type MessagingRegistrationUpdateInput = Record<string, any>;
  export type MessagingRegistrationUpdateManyMutationInput = Record<string, any>;
}

export type MessagingRegistration = {
  id: string;
  workspaceId: string;
  overallStatus: MessagingStepStatus;
  messagingEnabled: boolean;
  paused: boolean;
  subaccountSid: string | null;
  subaccountAuthTokenEnc: string | null;
  secondaryProfileSid: string | null;
  trustProductSid: string | null;
  brandSid: string | null;
  messagingServiceSid: string | null;
  a2pCampaignSid: string | null;
  phoneE164: string | null;
  phoneSid: string | null;
  phoneAttached: boolean;
  phonePurchasedAt: Date | string | null;
  profileStatus: MessagingStepStatus;
  trustStatus: MessagingStepStatus;
  brandStatus: MessagingStepStatus;
  messagingServiceStatus: MessagingStepStatus;
  campaignStatus: MessagingStepStatus;
  numberStatus: MessagingStepStatus;
  legalBusinessName: string | null;
  dbaName: string | null;
  businessType: string | null;
  businessIndustry: string | null;
  businessIdentity: string | null;
  businessRegistrationId: string | null;
  websiteUrl: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  useCase: string | null;
  useCaseDescription: string | null;
  sampleMessages: string[] | null;
  optInDescription: string | null;
  helpMessage: string | null;
  stopMessage: string | null;
  messageVolume: string | null;
  vertical: string | null;
  certifiedAt: Date | string | null;
  lastError: string | null;
  lastAdvancedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Provider-neutral Telnyx / multi-provider fields (additive)
  messagingProvider?: string | null;
  messagingProfileId?: string | null;
  phoneNumberId?: string | null;
  brandId?: string | null;
  campaignId?: string | null;
  brandStatusRaw?: string | null;
  campaignStatusRaw?: string | null;
  messagingActivationStatus?: string | null;
  registrationSubmittedAt?: Date | string | null;
  registrationApprovedAt?: Date | string | null;
  registrationFailureReason?: string | null;
};
