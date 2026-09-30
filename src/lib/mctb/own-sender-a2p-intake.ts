import "server-only";

import { getPrisma } from "@/lib/db";

export const MCTB_OWN_SENDER_A2P_INTAKE_STATUSES = [
  "not_started",
  "draft",
  "submitted",
] as const;

export type MctbOwnSenderA2pIntakeStatus = (typeof MCTB_OWN_SENDER_A2P_INTAKE_STATUSES)[number];

export type MctbOwnSenderA2pIntake = {
  status: MctbOwnSenderA2pIntakeStatus;
  legalBusinessName: string;
  einOrTaxId: string;
  businessWebsite: string;
  businessAddressLine1: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  contactEmail: string;
  contactPhone: string;
  desiredAreaCode: string;
  useCaseDescription: string;
  submittedAt?: string | null;
  submittedByUserId?: string | null;
  updatedAt?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function emptyIntake(): MctbOwnSenderA2pIntake {
  return {
    status: "not_started",
    legalBusinessName: "",
    einOrTaxId: "",
    businessWebsite: "",
    businessAddressLine1: "",
    businessCity: "",
    businessState: "",
    businessPostalCode: "",
    contactEmail: "",
    contactPhone: "",
    desiredAreaCode: "",
    useCaseDescription: "",
    submittedAt: null,
    submittedByUserId: null,
    updatedAt: null,
  };
}

function parseIntake(raw: unknown): MctbOwnSenderA2pIntake {
  const base = emptyIntake();
  const row = asRecord(raw);
  const status = String(row.status || "not_started");
  if (MCTB_OWN_SENDER_A2P_INTAKE_STATUSES.includes(status as MctbOwnSenderA2pIntakeStatus)) {
    base.status = status as MctbOwnSenderA2pIntakeStatus;
  }
  const str = (key: keyof MctbOwnSenderA2pIntake) =>
    typeof row[key] === "string" ? String(row[key]).trim() : "";
  base.legalBusinessName = str("legalBusinessName");
  base.einOrTaxId = str("einOrTaxId");
  base.businessWebsite = str("businessWebsite");
  base.businessAddressLine1 = str("businessAddressLine1");
  base.businessCity = str("businessCity");
  base.businessState = str("businessState");
  base.businessPostalCode = str("businessPostalCode");
  base.contactEmail = str("contactEmail");
  base.contactPhone = str("contactPhone");
  base.desiredAreaCode = str("desiredAreaCode");
  base.useCaseDescription = str("useCaseDescription");
  base.submittedAt = typeof row.submittedAt === "string" ? row.submittedAt : null;
  base.submittedByUserId =
    typeof row.submittedByUserId === "string" ? row.submittedByUserId : null;
  base.updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : null;
  return base;
}

export async function loadMctbOwnSenderA2pIntake(
  workspaceId: string,
): Promise<MctbOwnSenderA2pIntake> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb = asRecord(asRecord(ws?.customFieldsConfig).mctb);
  return parseIntake(mctb.ownSenderA2pIntake);
}

export type SaveMctbOwnSenderA2pIntakeInput = Omit<
  MctbOwnSenderA2pIntake,
  "submittedAt" | "submittedByUserId" | "updatedAt"
> & { submit?: boolean };

export function validateMctbOwnSenderA2pIntakeForSubmit(
  intake: MctbOwnSenderA2pIntake,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!intake.legalBusinessName.trim()) errors.legalBusinessName = "Legal business name is required.";
  if (!intake.contactEmail.trim()) errors.contactEmail = "Contact email is required.";
  if (!intake.useCaseDescription.trim()) {
    errors.useCaseDescription = "Describe how you text customers after missed calls.";
  }
  if (!intake.businessAddressLine1.trim()) {
    errors.businessAddressLine1 = "Business street address is required.";
  }
  if (!intake.businessCity.trim()) errors.businessCity = "City is required.";
  if (!intake.businessState.trim()) errors.businessState = "State is required.";
  if (!intake.businessPostalCode.trim()) errors.businessPostalCode = "Postal code is required.";
  return errors;
}

export async function saveMctbOwnSenderA2pIntake(
  workspaceId: string,
  input: SaveMctbOwnSenderA2pIntakeInput,
  userId: string,
): Promise<MctbOwnSenderA2pIntake> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(root.mctb);
  const prior = parseIntake(mctb.ownSenderA2pIntake);

  const next: MctbOwnSenderA2pIntake = {
    ...prior,
    ...input,
    status: input.submit ? "submitted" : input.status === "submitted" ? "submitted" : "draft",
    updatedAt: new Date().toISOString(),
  };

  if (input.submit) {
    const fieldErrors = validateMctbOwnSenderA2pIntakeForSubmit(next);
    if (Object.keys(fieldErrors).length > 0) {
      const err = new Error("validation_failed");
      (err as Error & { fieldErrors: Record<string, string> }).fieldErrors = fieldErrors;
      throw err;
    }
    next.submittedAt = new Date().toISOString();
    next.submittedByUserId = userId;
    next.status = "submitted";
  }

  const merged = {
    ...root,
    mctb: {
      ...mctb,
      ownSenderA2pIntake: next,
    },
  };

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig: merged as object },
  });

  if (input.submit && prior.status !== "submitted") {
    const { notifyMctbOwnSenderA2pSubmitted } = await import(
      "@/lib/mctb/own-sender-a2p-intake-notify"
    );
    void notifyMctbOwnSenderA2pSubmitted({ workspaceId, intake: next }).catch((err) => {
      console.error("[mctb] own-sender A2P submit notify failed", workspaceId, err);
    });
  }

  return next;
}

export type MctbOwnSenderA2pAdminRow = {
  workspaceId: string;
  workspaceName: string;
  submittedAt: string | null;
  intake: MctbOwnSenderA2pIntake;
};

/** Submitted Own Local Number A2P intake forms for manual carrier submission. */
export async function listMctbOwnSenderA2pSubmissionsForAdmin(
  limit = 200,
): Promise<MctbOwnSenderA2pAdminRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string; intake: unknown }>
  >`
    SELECT w.id, w.name, w."customFieldsConfig"->'mctb'->'ownSenderA2pIntake' AS intake
    FROM "Workspace" w
    WHERE w.type = 'BUSINESS'
      AND w."customFieldsConfig"->'mctb'->'ownSenderA2pIntake'->>'status' = 'submitted'
    ORDER BY w."customFieldsConfig"->'mctb'->'ownSenderA2pIntake'->>'submittedAt' DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    workspaceId: row.id,
    workspaceName: row.name,
    submittedAt:
      typeof asRecord(row.intake).submittedAt === "string"
        ? String(asRecord(row.intake).submittedAt)
        : null,
    intake: parseIntake(row.intake),
  }));
}
