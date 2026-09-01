import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { getPrimaryFaxNumber } from "./fax-number-provisioning";

export type FaxPortOutStatus =
  | "requested"
  | "documentation_needed"
  | "submitted_to_carrier"
  | "scheduled"
  | "completed"
  | "cancelled";

export type FaxPortOutRequest = {
  id: string;
  faxNumberId: string;
  e164: string;
  status: FaxPortOutStatus;
  requestedAt: string;
  notes?: string;
  loaRequired: boolean;
  providerFeeCents: number;
  steps: string[];
};

const PORT_OUT_STEPS = [
  "Submit a port-out request in Transovo Fax settings.",
  "Download and sign the Letter of Authorization (LOA) when provided.",
  "Give your new carrier the account number, PIN, and LOA.",
  "Your new carrier submits the port request to the losing carrier.",
  "Transovo releases the number after carrier confirmation — no arbitrary lock-in fee.",
];

/** Telnyx may charge a small carrier fee — pass through only if unavoidable. */
export function estimatedFaxPortOutProviderFeeCents(): number {
  const raw = Number(process.env.FAX_PORT_OUT_PROVIDER_FEE_CENTS);
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  return 0;
}

function readPortOutRequests(metadata: unknown): FaxPortOutRequest[] {
  if (!metadata || typeof metadata !== "object") return [];
  const list = (metadata as { portOutRequests?: FaxPortOutRequest[] }).portOutRequests;
  return Array.isArray(list) ? list : [];
}

export async function listFaxPortOutRequests(workspaceId: string): Promise<FaxPortOutRequest[]> {
  const prisma = getPrisma();
  const account = await prisma.faxAccount.findUnique({ where: { workspaceId } });
  return readPortOutRequests(account?.metadataJson);
}

export async function createFaxPortOutRequest(input: {
  workspaceId: string;
  faxNumberId?: string;
  notes?: string;
}): Promise<FaxPortOutRequest> {
  const prisma = getPrisma();
  const number =
    input.faxNumberId
      ? await prisma.faxNumber.findFirst({
          where: { id: input.faxNumberId, workspaceId: input.workspaceId, status: "active" },
        })
      : await getPrimaryFaxNumber(input.workspaceId);

  if (!number) throw new Error("No active fax number to port out");

  const account = await prisma.faxAccount.findUnique({ where: { workspaceId: input.workspaceId } });
  if (!account) throw new Error("FAX_ACCOUNT_NOT_FOUND");

  const existing = readPortOutRequests(account.metadataJson).find(
    (r) => r.faxNumberId === number.id && !["completed", "cancelled"].includes(r.status),
  );
  if (existing) return existing;

  const request: FaxPortOutRequest = {
    id: createId(),
    faxNumberId: number.id,
    e164: number.e164,
    status: "requested",
    requestedAt: new Date().toISOString(),
    notes: input.notes,
    loaRequired: true,
    providerFeeCents: estimatedFaxPortOutProviderFeeCents(),
    steps: PORT_OUT_STEPS,
  };

  const metadata = {
    ...((account.metadataJson || {}) as object),
    portOutRequests: [...readPortOutRequests(account.metadataJson), request],
  };

  await prisma.faxAccount.update({
    where: { workspaceId: input.workspaceId },
    data: { metadataJson: metadata as object },
  });

  return request;
}
