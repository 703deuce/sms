/**
 * Number porting status center — real lifecycle, no fake completion.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { PORT_STATUSES, portStatusLabel, type PortStatus } from "./port-constants";

export { PORT_STATUSES, portStatusLabel, type PortStatus };

export type PortHistoryEntry = {
  status: string;
  at: string;
  note?: string | null;
  byUserId?: string | null;
};

export type PortDocument = {
  id: string;
  label: string;
  required: boolean;
  status: "missing" | "uploaded" | "waived";
  uploadedAt?: string | null;
  note?: string | null;
};

const DEFAULT_DOCS: Omit<PortDocument, "id">[] = [
  { label: "Signed Letter of Authorization (LOA)", required: true, status: "missing" },
  { label: "Recent carrier bill or CSR", required: true, status: "missing" },
  { label: "Proof of business ownership (toll-free)", required: false, status: "missing" },
];

function parseHistory(raw: unknown): PortHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object" && "status" in e) as PortHistoryEntry[];
}

function parseDocs(raw: unknown): PortDocument[] {
  if (!Array.isArray(raw) || !raw.length) {
    return DEFAULT_DOCS.map((d, i) => ({ ...d, id: `doc_${i + 1}` }));
  }
  return raw as PortDocument[];
}

export async function createPortRequest(input: {
  workspaceId: string;
  userId: string;
  phone: string;
  currentCarrier?: string | null;
  accountNumber?: string | null;
  accountPin?: string | null;
  billingPhone?: string | null;
  businessName?: string | null;
  address?: string | null;
  authorizedName?: string | null;
  numberType?: string | null;
  notes?: string | null;
  temporaryForwardNumber?: string | null;
}) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const now = new Date().toISOString();
  const history: PortHistoryEntry[] = [
    {
      status: "pending",
      at: now,
      note: "Port request created",
      byUserId: input.userId,
    },
  ];
  const docs = DEFAULT_DOCS.map((d, i) => ({
    ...d,
    id: `doc_${i + 1}`,
    required: input.numberType === "tollfree" ? true : d.required,
  }));

  const portRequest = await prisma.portRequest.create({
    data: {
      workspaceId: input.workspaceId,
      phone,
      currentCarrier: input.currentCarrier?.trim() || null,
      accountNumber: input.accountNumber?.trim() || null,
      accountPin: input.accountPin?.trim() || null,
      billingPhone: input.billingPhone?.trim() || null,
      businessName: input.businessName?.trim() || null,
      address: input.address?.trim() || null,
      authorizedName: input.authorizedName?.trim() || null,
      numberType: input.numberType?.trim() || "local",
      notes: input.notes?.trim() || null,
      temporaryForwardNumber: input.temporaryForwardNumber?.trim() || null,
      requestedByUserId: input.userId,
      status: "pending",
      statusHistoryJson: history,
      documentsJson: docs,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "number.port_requested",
      detail: phone,
    },
  });

  return hydratePort(portRequest);
}

export function hydratePort(row: Record<string, unknown>) {
  return {
    ...row,
    statusLabel: portStatusLabel(String(row.status || "")),
    statusHistory: parseHistory(row.statusHistoryJson),
    documents: parseDocs(row.documentsJson),
  };
}

export async function listPortRequests(workspaceId: string) {
  const rows = await getPrisma().portRequest.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r: Record<string, unknown>) => hydratePort(r));
}

export async function getPortRequest(workspaceId: string, id: string) {
  const row = await getPrisma().portRequest.findFirst({
    where: { id, workspaceId },
  });
  return row ? hydratePort(row) : null;
}

export async function updatePortStatus(input: {
  workspaceId: string;
  id: string;
  status: string;
  byUserId: string;
  note?: string | null;
  rejectionReason?: string | null;
  focDate?: string | null;
  temporaryForwardNumber?: string | null;
  providerPortId?: string | null;
}) {
  if (!PORT_STATUSES.includes(input.status as PortStatus)) {
    throw new Error(`Invalid status. Allowed: ${PORT_STATUSES.join(", ")}`);
  }
  // Never auto-complete — completed only via explicit operator action.
  const prisma = getPrisma();
  const existing = await prisma.portRequest.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
  });
  if (!existing) throw new Error("Port request not found");

  const history = parseHistory(existing.statusHistoryJson);
  history.push({
    status: input.status,
    at: new Date().toISOString(),
    note: input.note || portStatusLabel(input.status),
    byUserId: input.byUserId,
  });

  const data: Record<string, unknown> = {
    status: input.status,
    statusHistoryJson: history,
  };
  if (input.rejectionReason !== undefined) data.rejectionReason = input.rejectionReason;
  if (input.status === "rejected" && input.rejectionReason) {
    data.rejectionReason = input.rejectionReason;
  }
  if (input.focDate) data.focDate = new Date(input.focDate);
  if (input.temporaryForwardNumber !== undefined) {
    data.temporaryForwardNumber = input.temporaryForwardNumber;
  }
  if (input.providerPortId !== undefined) data.providerPortId = input.providerPortId;

  const updated = await prisma.portRequest.update({
    where: { id: input.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.byUserId,
      event: "number.port_status",
      detail: `${existing.phone}:${input.status}`,
    },
  });

  return hydratePort(updated);
}

export async function updatePortDocuments(input: {
  workspaceId: string;
  id: string;
  byUserId: string;
  documents: PortDocument[];
}) {
  const prisma = getPrisma();
  const existing = await prisma.portRequest.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
  });
  if (!existing) throw new Error("Port request not found");

  const docs = input.documents.map((d) => ({
    ...d,
    uploadedAt:
      d.status === "uploaded" ? d.uploadedAt || new Date().toISOString() : d.uploadedAt || null,
  }));

  const history = parseHistory(existing.statusHistoryJson);
  const allRequiredUploaded = docs.filter((d) => d.required).every((d) => d.status !== "missing");
  let nextStatus = existing.status;
  if (existing.status === "docs_needed" && allRequiredUploaded) {
    nextStatus = "pending";
    history.push({
      status: nextStatus,
      at: new Date().toISOString(),
      note: "Required documents marked uploaded — back in review",
      byUserId: input.byUserId,
    });
  } else {
    history.push({
      status: existing.status,
      at: new Date().toISOString(),
      note: "Document checklist updated",
      byUserId: input.byUserId,
    });
  }

  const updated = await prisma.portRequest.update({
    where: { id: input.id },
    data: {
      documentsJson: docs,
      status: nextStatus,
      statusHistoryJson: history,
    },
  });
  return hydratePort(updated);
}
