/**
 * Transovo port-out production lifecycle — provider-aware, customer-normalized.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { resolvePhoneNumberProvider } from "./providers/normalize";
import {
  PORTABILITY_GUARANTEE_DAYS,
  type PortOutStatus,
  portOutStatusLabel,
  rejectionCategoryCustomerMessage,
  isCorrectableRejection,
  isPortabilityReviewRejection,
} from "./port-out-constants";
import {
  getDestinationRule,
  destinationLabel,
  type PortOutDestinationType,
} from "./port-out-destination-rules";
import { readPersonalCallSettings } from "./personal-call-settings";
import {
  revealPersonalPortOutCredentials,
  setPersonalPortOutPin,
} from "./personal-port-out-service";

export type PortOutHistoryEntry = {
  status: string;
  at: string;
  note?: string | null;
  byUserId?: string | null;
};

export type CustomerPortOutPacket = {
  phoneNumber: string;
  friendlyName: string | null;
  accountHolderName: string;
  accountNumber: string;
  portPin: string | null;
  billingPhone: string | null;
  serviceAddress: string | null;
  locked: boolean;
  fields: Array<{ key: string; label: string; value: string; copyable: boolean }>;
};

export type CustomerPortOutRequest = {
  id: string;
  phoneNumberId: string;
  phone: string;
  status: string;
  statusLabel: string;
  destinationCarrier: string | null;
  destinationType: string | null;
  destinationLabel: string | null;
  guaranteeEligible: boolean;
  guaranteeReviewStatus: string | null;
  customerActionRequired: boolean;
  initiatedAt: string | null;
  focDate: string | null;
  completedAt: string | null;
  rejectionMessage: string | null;
  voicePortStatus: string | null;
  messagingPortStatus: string | null;
};

function parseHistory(raw: unknown): PortOutHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object" && "status" in e) as PortOutHistoryEntry[];
}

function addHistory(
  history: PortOutHistoryEntry[],
  status: string,
  note?: string | null,
  byUserId?: string | null,
) {
  history.push({
    status,
    at: new Date().toISOString(),
    note: note || portOutStatusLabel(status),
    byUserId: byUserId || null,
  });
  return history;
}

export function computeGuaranteeEligibility(input: {
  purchasedAt: Date | null;
  initiatedAt: Date;
  destinationType: string | null;
}): boolean {
  if (!input.purchasedAt) return false;
  const windowEnd = new Date(input.purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + PORTABILITY_GUARANTEE_DAYS);
  if (input.initiatedAt > windowEnd) return false;
  const rule = getDestinationRule(input.destinationType);
  if (rule && !rule.portabilityGuaranteeEligible) return false;
  return true;
}

export async function getOwnedActiveNumber(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  if (row.releasedAt) throw new Error("This number has been released.");
  return row;
}

export async function assertNumberEligibleForPortOut(workspaceId: string, phoneNumberId: string) {
  const row = await getOwnedActiveNumber(workspaceId, phoneNumberId);
  if (row.status !== "Active" && row.status !== "Parked") {
    throw new Error("This number is not active for port-out.");
  }

  const activePort = await getPrisma().portOutRequest.findFirst({
    where: {
      workspaceId,
      phoneNumberId,
      status: { notIn: ["COMPLETED", "CANCELED"] },
    },
  });
  if (activePort) {
    throw new Error("A port-out is already in progress for this number.");
  }

  return row;
}

async function resolveAuthorizedHolder(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true },
  });
  const reg = await getRegistrationByWorkspace(workspaceId);

  const name =
    reg?.contactFirstName && reg?.contactLastName
      ? `${reg.contactFirstName} ${reg.contactLastName}`.trim()
      : user?.name?.trim() || workspace?.displayName || workspace?.name || "Account holder";

  const addressParts = [reg?.street, reg?.city, reg?.region, reg?.postalCode, reg?.country].filter(
    Boolean,
  );
  const serviceAddress = addressParts.length ? addressParts.join(", ") : null;

  return {
    accountHolderName: name,
    billingPhone: reg?.contactPhone?.trim() || user?.phone?.trim() || null,
    serviceAddress,
    contactEmail: reg?.contactEmail?.trim() || user?.email || null,
  };
}

export async function buildCustomerPortOutPacket(
  workspaceId: string,
  phoneNumberId: string,
  userId: string,
): Promise<CustomerPortOutPacket> {
  const row = await getOwnedActiveNumber(workspaceId, phoneNumberId);
  const creds = await revealPersonalPortOutCredentials(workspaceId, phoneNumberId);
  const holder = await resolveAuthorizedHolder(workspaceId, userId);

  const billingPhone = holder.billingPhone || row.e164;
  const serviceAddress = holder.serviceAddress;

  const fields: CustomerPortOutPacket["fields"] = [
    { key: "phone", label: "Phone number", value: row.e164, copyable: true },
    {
      key: "accountHolder",
      label: "Account holder / authorized name",
      value: holder.accountHolderName,
      copyable: true,
    },
    { key: "accountNumber", label: "Account number", value: creds.accountNumber, copyable: true },
  ];

  if (!creds.locked && creds.pin) {
    fields.push({ key: "pin", label: "Transfer / port PIN", value: creds.pin, copyable: true });
  }

  fields.push({
    key: "btn",
    label: "Billing telephone number (BTN)",
    value: billingPhone,
    copyable: true,
  });

  if (serviceAddress) {
    fields.push({
      key: "address",
      label: "Service / billing address",
      value: serviceAddress,
      copyable: true,
    });
  }

  return {
    phoneNumber: row.e164,
    friendlyName: row.friendlyName,
    accountHolderName: holder.accountHolderName,
    accountNumber: creds.accountNumber,
    portPin: creds.locked ? null : creds.pin,
    billingPhone,
    serviceAddress,
    locked: creds.locked,
    fields,
  };
}

function mapRowToCustomer(row: {
  id: string;
  phoneNumberId: string;
  phone: string;
  status: string;
  destinationCarrier: string | null;
  destinationType: string | null;
  guaranteeEligible: boolean;
  guaranteeReviewStatus: string | null;
  customerActionRequired: boolean;
  initiatedAt: Date | null;
  focDate: Date | null;
  completedAt: Date | null;
  rejectionCategory: string | null;
  voicePortStatus: string | null;
  messagingPortStatus: string | null;
}): CustomerPortOutRequest {
  return {
    id: row.id,
    phoneNumberId: row.phoneNumberId,
    phone: row.phone,
    status: row.status,
    statusLabel: portOutStatusLabel(row.status),
    destinationCarrier: row.destinationCarrier,
    destinationType: row.destinationType,
    destinationLabel: destinationLabel(row.destinationType),
    guaranteeEligible: row.guaranteeEligible,
    guaranteeReviewStatus: row.guaranteeReviewStatus,
    customerActionRequired: row.customerActionRequired,
    initiatedAt: row.initiatedAt?.toISOString() ?? null,
    focDate: row.focDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    rejectionMessage: row.rejectionCategory
      ? rejectionCategoryCustomerMessage(row.rejectionCategory)
      : null,
    voicePortStatus: row.voicePortStatus,
    messagingPortStatus: row.messagingPortStatus,
  };
}

export async function listCustomerPortOutRequests(workspaceId: string) {
  const rows = await getPrisma().portOutRequest.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(mapRowToCustomer);
}

export async function getCustomerPortOutRequest(workspaceId: string, id: string) {
  const row = await getPrisma().portOutRequest.findFirst({
    where: { id, workspaceId },
  });
  return row ? mapRowToCustomer(row) : null;
}

export async function initiatePortOutTransfer(input: {
  workspaceId: string;
  userId: string;
  phoneNumberId: string;
  destinationType: PortOutDestinationType | string;
  destinationCarrier?: string | null;
  authorizedContactEmail?: string | null;
  authorizedContactName?: string | null;
  authorizedContactPhone?: string | null;
  preferredTransferDate?: string | null;
}) {
  const prisma = getPrisma();
  const row = await assertNumberEligibleForPortOut(input.workspaceId, input.phoneNumberId);
  const creds = await revealPersonalPortOutCredentials(input.workspaceId, input.phoneNumberId);

  if (creds.locked) {
    throw new Error(
      "Unlock port-out credentials before starting your transfer. Your PIN is hidden while locked.",
    );
  }

  const provider = resolvePhoneNumberProvider(row);
  const initiatedAt = new Date();
  const destinationType = input.destinationType.trim().toLowerCase();
  const rule = getDestinationRule(destinationType);
  const guaranteeEligible = computeGuaranteeEligibility({
    purchasedAt: row.purchasedAt,
    initiatedAt,
    destinationType,
  });

  const history = addHistory(
    [],
    "WAITING_FOR_CARRIER",
    "Customer marked transfer as started with gaining carrier",
    input.userId,
  );

  const portOut = await prisma.portOutRequest.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      phoneNumberId: input.phoneNumberId,
      phone: normalizeE164(row.e164),
      provider,
      destinationCarrier: input.destinationCarrier?.trim() || rule?.label || null,
      destinationType,
      status: "WAITING_FOR_CARRIER",
      purchasedAt: row.purchasedAt,
      initiatedAt,
      guaranteeEligible,
      authorizedContactEmail: input.authorizedContactEmail?.trim() || null,
      authorizedContactName: input.authorizedContactName?.trim() || null,
      authorizedContactPhone: input.authorizedContactPhone?.trim() || null,
      preferredTransferDate: input.preferredTransferDate
        ? new Date(input.preferredTransferDate)
        : null,
      statusHistoryJson: history,
    },
  });

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: {
      settingsJson: {
        ...settings,
        personalServiceState: "PORTING_OUT",
        portStatus: "porting_out",
        portOutGainingCarrier: input.destinationCarrier?.trim() || rule?.label || null,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "number.port_out_initiated",
      detail: `${row.e164}:${portOut.id}`,
    },
  });

  const packet = await buildCustomerPortOutPacket(
    input.workspaceId,
    input.phoneNumberId,
    input.userId,
  );

  return { portOut: mapRowToCustomer(portOut), packet };
}

export async function transitionPortOutStatus(input: {
  workspaceId: string;
  portOutId: string;
  status: PortOutStatus;
  byUserId?: string | null;
  note?: string | null;
  rejectionCategory?: string | null;
  rejectionDetailsInternal?: string | null;
  providerPortOutId?: string | null;
  focDate?: Date | null;
  voicePortStatus?: string | null;
  messagingPortStatus?: string | null;
  providerPayload?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const existing = await prisma.portOutRequest.findFirst({
    where: { id: input.portOutId, workspaceId: input.workspaceId },
  });
  if (!existing) throw new Error("Port-out request not found");

  const history = parseHistory(existing.statusHistoryJson);
  addHistory(history, input.status, input.note, input.byUserId);

  const customerActionRequired =
    input.status === "ACTION_REQUIRED" ||
    (input.rejectionCategory && isCorrectableRejection(input.rejectionCategory));

  let guaranteeReviewStatus = existing.guaranteeReviewStatus;
  if (
    input.status === "PORTABILITY_REVIEW" ||
    (input.rejectionCategory && isPortabilityReviewRejection(input.rejectionCategory))
  ) {
    guaranteeReviewStatus = "open";
  }

  const data: Record<string, unknown> = {
    status: input.status,
    statusHistoryJson: history,
    customerActionRequired,
    guaranteeReviewStatus,
  };

  if (input.rejectionCategory !== undefined) data.rejectionCategory = input.rejectionCategory;
  if (input.rejectionDetailsInternal !== undefined) {
    data.rejectionDetailsInternal = input.rejectionDetailsInternal;
  }
  if (input.providerPortOutId) data.providerPortOutId = input.providerPortOutId;
  if (input.focDate) data.focDate = input.focDate;
  if (input.voicePortStatus) data.voicePortStatus = input.voicePortStatus;
  if (input.messagingPortStatus) data.messagingPortStatus = input.messagingPortStatus;
  if (input.providerPayload) {
    const prev =
      existing.providerPayloadJson && typeof existing.providerPayloadJson === "object"
        ? (existing.providerPayloadJson as Record<string, unknown>)
        : {};
    data.providerPayloadJson = { ...prev, ...input.providerPayload };
  }

  if (input.status === "REQUEST_RECEIVED" && !existing.carrierRequestReceivedAt) {
    data.carrierRequestReceivedAt = new Date();
  }
  if (input.status === "AUTHORIZED" && !existing.authorizedAt) {
    data.authorizedAt = new Date();
  }
  if (input.status === "COMPLETED") {
    data.completedAt = new Date();
  }

  const updated = await prisma.portOutRequest.update({
    where: { id: existing.id },
    data,
  });

  if (input.status === "COMPLETED") {
    await completePortOutNumber(input.workspaceId, existing.phoneNumberId);
  }

  return mapRowToCustomer(updated);
}

export async function completePortOutNumber(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!row) return;

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      status: "Released",
      releasedAt: new Date(),
      settingsJson: {
        ...settings,
        personalServiceState: "PORTED_OUT",
        portStatus: "ported_out",
      },
    },
  });
}

export async function unlockPortOutCredentials(
  workspaceId: string,
  phoneNumberId: string,
  pin?: string,
) {
  return setPersonalPortOutPin(workspaceId, phoneNumberId, pin || "", false);
}

export async function lockPortOutCredentials(workspaceId: string, phoneNumberId: string) {
  const creds = await revealPersonalPortOutCredentials(workspaceId, phoneNumberId);
  return setPersonalPortOutPin(workspaceId, phoneNumberId, creds.pin || "", true);
}

export async function resolveGuaranteeChoice(input: {
  workspaceId: string;
  portOutId: string;
  userId: string;
  choice: "keep" | "refund";
  refundAcknowledged?: boolean;
}) {
  const prisma = getPrisma();
  const portOut = await prisma.portOutRequest.findFirst({
    where: { id: input.portOutId, workspaceId: input.workspaceId },
  });
  if (!portOut) throw new Error("Port-out request not found");
  if (portOut.guaranteeReviewStatus !== "open") {
    throw new Error("No portability review is open for this transfer.");
  }

  if (input.choice === "keep") {
    const updated = await prisma.portOutRequest.update({
      where: { id: portOut.id },
      data: {
        guaranteeReviewStatus: "customer_kept_number",
        status: portOut.status === "PORTABILITY_REVIEW" ? "ACTION_REQUIRED" : portOut.status,
      },
    });
    return mapRowToCustomer(updated);
  }

  if (!input.refundAcknowledged) {
    throw new Error(
      "You must acknowledge that you relinquish rights to this number before accepting a refund.",
    );
  }

  const updated = await prisma.portOutRequest.update({
    where: { id: portOut.id },
    data: {
      guaranteeReviewStatus: "refund_requested",
      refundStatus: "pending_review",
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "number.port_out_guarantee_refund_requested",
      detail: portOut.phone,
    },
  });

  return mapRowToCustomer(updated);
}
