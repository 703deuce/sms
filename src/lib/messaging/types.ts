import type { MessagingRegistration, MessagingStepStatus } from "@prisma/client";

export type RegistrationAction =
  | "start"
  | "save_business"
  | "save_use_case"
  | "purchase_number"
  | "release_number"
  | "submit"
  | "refresh_status"
  | "activate"
  | "pause"
  | "resume"
  | "send_test";

export type BusinessDetailsInput = {
  legalBusinessName: string;
  dbaName?: string;
  businessType: string;
  businessIndustry: string;
  businessIdentity?: string;
  businessRegistrationId: string;
  websiteUrl: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country?: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle?: string;
};

export type UseCaseInput = {
  useCase: string;
  useCaseDescription: string;
  sampleMessages: string[];
  optInDescription: string;
  helpMessage?: string;
  stopMessage?: string;
  messageVolume?: string;
  vertical?: string;
};

export type RegistrationProgressStep = {
  key: string;
  label: string;
  status: MessagingStepStatus;
};

export type RegistrationPublic = MessagingRegistration & {
  progress: RegistrationProgressStep[];
  ready: boolean;
  liveMode: boolean;
};

export class JobDeferredError extends Error {
  deferMs: number;
  /** When true, do not increment/consume maxAttempts (Twilio review polling). */
  soft: boolean;
  constructor(message: string, deferMs = 15 * 60 * 1000, soft = true) {
    super(message);
    this.name = "JobDeferredError";
    this.deferMs = deferMs;
    this.soft = soft;
  }
}

export class JobFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobFailedError";
  }
}

export type NumberSearchResult = {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  isoCountry?: string;
  capabilities?: { sms?: boolean; mms?: boolean; voice?: boolean };
};
