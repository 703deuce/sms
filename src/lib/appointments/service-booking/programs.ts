import "server-only";

import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type ProgramStep = {
  id: string;
  label: string;
  appointmentTypeId?: string;
  serviceName?: string;
  quantity: number;
};

export type ServiceProgram = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  steps: ProgramStep[];
  active: boolean;
  durationWeeks?: number;
};

type CommerceStore = {
  programs?: ServiceProgram[];
  paymentPlans?: import("./payment-plans").PaymentPlanProduct[];
};

async function loadCommerceStore(workspaceId: string): Promise<CommerceStore> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return ((platform as { commerceStore?: CommerceStore }).commerceStore || {}) as CommerceStore;
}

async function saveCommerceStore(workspaceId: string, patch: Partial<CommerceStore>) {
  const current = await loadCommerceStore(workspaceId);
  await saveAppointmentPlatformConfig(workspaceId, {
    commerceStore: { ...current, ...patch },
  } as object);
  return { ...current, ...patch };
}

export async function listServicePrograms(workspaceId: string) {
  const store = await loadCommerceStore(workspaceId);
  return (store.programs || []).filter((p) => p.active !== false);
}

export async function upsertServiceProgram(
  workspaceId: string,
  input: Omit<ServiceProgram, "id"> & { id?: string },
) {
  const store = await loadCommerceStore(workspaceId);
  const programs = [...(store.programs || [])];
  const id = input.id || `prog_${Date.now()}`;
  const row: ServiceProgram = {
    id,
    name: input.name.trim(),
    description: input.description,
    priceCents: input.priceCents ?? 0,
    currency: input.currency || "usd",
    steps: input.steps || [],
    active: input.active ?? true,
    durationWeeks: input.durationWeeks,
  };
  const idx = programs.findIndex((p) => p.id === id);
  if (idx >= 0) programs[idx] = row;
  else programs.push(row);
  await saveCommerceStore(workspaceId, { programs });
  return row;
}

export async function enrollContactInProgram(
  workspaceId: string,
  contactId: string,
  programId: string,
) {
  const programs = await listServicePrograms(workspaceId);
  const program = programs.find((p) => p.id === programId);
  if (!program) throw new Error("Program not found");

  const { purchasePackageForContact } = await import("./packages");
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  const creditRules: Record<string, number> = {};
  for (const step of program.steps) {
    const key = step.appointmentTypeId || step.serviceName || step.id;
    creditRules[key] = (creditRules[key] || 0) + step.quantity;
  }

  let product = await prisma.packageProduct.findFirst({
    where: { workspaceId, slug: `program-${programId}` },
  });
  if (!product) {
    product = await prisma.packageProduct.create({
      data: {
        workspaceId,
        name: program.name,
        slug: `program-${programId}`,
        description: program.description,
        priceCents: program.priceCents,
        currency: program.currency,
        creditRules: Object.entries(creditRules).map(([k, v]) => ({ key: k, credits: v })),
        metadata: { productKind: "program", programId },
        active: true,
      },
    });
  }

  const balance = await purchasePackageForContact(workspaceId, product.id, contactId);
  return { program, balanceId: balance.id };
}
