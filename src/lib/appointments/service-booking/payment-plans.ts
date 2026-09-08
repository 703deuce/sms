import "server-only";

import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type PaymentPlanInstallment = {
  id: string;
  label: string;
  amountCents: number;
  dueDaysFromStart: number;
};

export type PaymentPlanProduct = {
  id: string;
  name: string;
  description?: string;
  totalCents: number;
  currency: string;
  installments: PaymentPlanInstallment[];
  entitlementProductId?: string;
  active: boolean;
};

type CommerceStore = {
  programs?: unknown[];
  paymentPlans?: PaymentPlanProduct[];
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

export async function listPaymentPlans(workspaceId: string) {
  const store = await loadCommerceStore(workspaceId);
  return (store.paymentPlans || []).filter((p) => p.active !== false);
}

export async function upsertPaymentPlan(
  workspaceId: string,
  input: Omit<PaymentPlanProduct, "id"> & { id?: string },
) {
  const store = await loadCommerceStore(workspaceId);
  const plans = [...(store.paymentPlans || [])];
  const id = input.id || `plan_${Date.now()}`;
  const row: PaymentPlanProduct = {
    id,
    name: input.name.trim(),
    description: input.description,
    totalCents: input.totalCents,
    currency: input.currency || "usd",
    installments: input.installments || [],
    entitlementProductId: input.entitlementProductId,
    active: input.active ?? true,
  };
  const idx = plans.findIndex((p) => p.id === id);
  if (idx >= 0) plans[idx] = row;
  else plans.push(row);
  await saveCommerceStore(workspaceId, { paymentPlans: plans });
  return row;
}

export function summarizePaymentPlan(plan: PaymentPlanProduct) {
  const paid = plan.installments.reduce((s, i) => s + i.amountCents, 0);
  return {
    installmentCount: plan.installments.length,
    totalCents: plan.totalCents,
    scheduleTotalCents: paid,
    balanced: paid === plan.totalCents,
  };
}
