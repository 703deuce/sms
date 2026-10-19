import "server-only";

import type { NumberProduct } from "@/lib/numbers";
import { getPrisma } from "@/lib/server/db";
import {
  readTelephonyProvision,
  type TelephonyProvisionRecord,
} from "@/lib/server/telephony/telephony-record";

export type ParkedIngressSnapshot = {
  product: NumberProduct;
  telephony: TelephonyProvisionRecord;
  telnyxConnectionId: string | null;
  workspacePolicySnapshot?: Record<string, unknown>;
  savedAt: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function routingModeToProduct(
  mode: TelephonyProvisionRecord["routingMode"],
): NumberProduct | null {
  if (mode === "livekit_sip") return "receptionist";
  if (mode === "mctb_texml") return "mctb";
  if (mode === "telnyx_call_control") return "phone";
  return null;
}

export function readParkedSnapshots(settingsJson: unknown): ParkedIngressSnapshot[] {
  const settings = asRecord(settingsJson) || {};
  const park = asRecord(settings.telephonyPark);
  const raw = park?.snapshots;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === "object") as ParkedIngressSnapshot[];
}

export async function parkIngressSnapshot(input: {
  phoneNumberId: string;
  product: NumberProduct;
  telephony: TelephonyProvisionRecord;
  telnyxConnectionId: string | null;
  workspacePolicySnapshot?: Record<string, unknown>;
}): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: input.phoneNumberId },
    select: { settingsJson: true },
  });
  const settings = asRecord(row?.settingsJson) || {};
  const existing = readParkedSnapshots(settings).filter((s) => s.product !== input.product);
  const snapshot: ParkedIngressSnapshot = {
    product: input.product,
    telephony: input.telephony,
    telnyxConnectionId: input.telnyxConnectionId,
    workspacePolicySnapshot: input.workspacePolicySnapshot,
    savedAt: new Date().toISOString(),
  };
  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: {
      settingsJson: {
        ...settings,
        telephonyPark: {
          snapshots: [...existing, snapshot],
        },
      } as object,
    },
  });
}

/** Park current carrier + telephony state before changing ingress. */
export async function parkCurrentIngressIfNeeded(input: {
  phoneNumberId: string;
  telnyxConnectionId: string | null;
  workspacePolicySnapshot?: Record<string, unknown>;
}): Promise<{ parkedProduct: NumberProduct | null; actions: string[] }> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: input.phoneNumberId },
    select: { settingsJson: true },
  });
  if (!row) return { parkedProduct: null, actions: [] };

  const telephony = readTelephonyProvision(row.settingsJson);
  const product = routingModeToProduct(telephony.routingMode);
  if (!product || telephony.state !== "active") {
    return { parkedProduct: null, actions: ["park_skipped_no_active_ingress"] };
  }

  await parkIngressSnapshot({
    phoneNumberId: input.phoneNumberId,
    product,
    telephony,
    telnyxConnectionId: input.telnyxConnectionId,
    workspacePolicySnapshot: input.workspacePolicySnapshot,
  });

  return { parkedProduct: product, actions: [`parked_${product}_ingress`] };
}

export function findParkedSnapshot(
  settingsJson: unknown,
  product: NumberProduct,
): ParkedIngressSnapshot | null {
  return readParkedSnapshots(settingsJson).find((s) => s.product === product) || null;
}
