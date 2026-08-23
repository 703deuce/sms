import { getPrisma } from "@/lib/db";
import { DbError } from "@/lib/supabase/prisma-compat";
import type { ProductAccessStatus } from "@/lib/products/types";
import { isActiveEntitlement } from "@/lib/products/types";

/** Transovo sellable product features (workspace-scoped). */
export type TransovoProductFeature =
  | "mctb"
  | "smart_routing"
  | "visual_voicemail"
  | "callback_requests";

const FEATURE_KEYS: TransovoProductFeature[] = [
  "mctb",
  "smart_routing",
  "visual_voicemail",
  "callback_requests",
];

const PRISMA_FEATURE_MAP: Record<
  TransovoProductFeature,
  "MCTB" | "SMART_ROUTING" | "VISUAL_VOICEMAIL" | "CALLBACK_REQUESTS"
> = {
  mctb: "MCTB",
  smart_routing: "SMART_ROUTING",
  visual_voicemail: "VISUAL_VOICEMAIL",
  callback_requests: "CALLBACK_REQUESTS",
};

export type WorkspaceFeatureSnapshot = Record<TransovoProductFeature, ProductAccessStatus>;

function defaultSnapshot(): WorkspaceFeatureSnapshot {
  return {
    mctb: "inactive",
    smart_routing: "inactive",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  };
}

function isSchemaUnavailable(err: unknown): boolean {
  if (!(err instanceof DbError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("workspaceproductfeature") ||
    msg.includes("workspace_product_features") ||
    err.code === "PGRST204"
  );
}

function prismaStatusToApp(status: string): ProductAccessStatus {
  const s = status.toLowerCase();
  if (s === "active" || s === "inactive" || s === "trial") return s;
  return "inactive";
}

/** Default features for new workspaces — preserves current launch behavior. */
export function defaultFeaturesForWorkspaceType(
  workspaceType: string,
): Array<{ feature: TransovoProductFeature; status: ProductAccessStatus }> {
  if (workspaceType === "PERSONAL") {
    return [
      { feature: "smart_routing", status: "active" },
      { feature: "visual_voicemail", status: "trial" },
    ];
  }
  return [
    { feature: "mctb", status: "active" },
    { feature: "smart_routing", status: "active" },
    { feature: "visual_voicemail", status: "trial" },
  ];
}

/** Idempotent baseline feature rows for a workspace. */
export async function ensureWorkspaceProductFeatures(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        type: true,
        productEntitlements: { select: { productKey: true, status: true } },
        workspaceProductFeatures: { select: { featureKey: true } },
      },
    });
    if (!workspace) return;

    const existing = new Set(
      (workspace.workspaceProductFeatures ?? []).map((r: { featureKey: string }) => r.featureKey),
    );
    const defaults = defaultFeaturesForWorkspaceType(workspace.type ?? "BUSINESS");

    const hasVoice = (workspace.productEntitlements ?? []).some(
      (e: { productKey: string; status: string }) =>
        e.productKey === "VOICE" && isActiveEntitlement(prismaStatusToApp(e.status)),
    );

    for (const def of defaults) {
      const prismaKey = PRISMA_FEATURE_MAP[def.feature];
      if (existing.has(prismaKey)) continue;
      await prisma.workspaceProductFeature.create({
        data: {
          workspaceId,
          featureKey: prismaKey,
          status: def.status.toUpperCase() as "ACTIVE" | "TRIAL" | "INACTIVE",
          activatedAt: def.status !== "inactive" ? new Date() : null,
        },
      });
    }

    // Voice entitlement implies MCTB for backward compatibility.
    if (hasVoice && !existing.has("MCTB")) {
      await prisma.workspaceProductFeature.upsert({
        where: {
          workspaceId_featureKey: { workspaceId, featureKey: "MCTB" },
        },
        create: {
          workspaceId,
          featureKey: "MCTB",
          status: "ACTIVE",
          activatedAt: new Date(),
        },
        update: { status: "ACTIVE", activatedAt: new Date(), deactivatedAt: null },
      });
    }
  } catch (err) {
    if (isSchemaUnavailable(err)) return;
    throw err;
  }
}

export async function getWorkspaceProductFeatures(
  workspaceId: string,
): Promise<WorkspaceFeatureSnapshot> {
  await ensureWorkspaceProductFeatures(workspaceId);
  const prisma = getPrisma();
  try {
    const rows = await prisma.workspaceProductFeature.findMany({
      where: { workspaceId },
    });
    const snap = defaultSnapshot();
    for (const row of rows) {
      const mapped =
        row.featureKey === "MCTB"
          ? "mctb"
          : row.featureKey === "SMART_ROUTING"
            ? "smart_routing"
            : row.featureKey === "VISUAL_VOICEMAIL"
              ? "visual_voicemail"
              : row.featureKey === "CALLBACK_REQUESTS"
                ? "callback_requests"
                : null;
      if (mapped) snap[mapped] = prismaStatusToApp(row.status);
    }
    return snap;
  } catch (err) {
    if (isSchemaUnavailable(err)) {
      const fallback = defaultSnapshot();
      fallback.mctb = "active";
      fallback.smart_routing = "active";
      return fallback;
    }
    throw err;
  }
}

export async function hasWorkspaceProductFeature(
  workspaceId: string,
  feature: TransovoProductFeature,
): Promise<boolean> {
  const snap = await getWorkspaceProductFeatures(workspaceId);
  return isActiveEntitlement(snap[feature]);
}

export async function grantWorkspaceProductFeature(
  workspaceId: string,
  feature: TransovoProductFeature,
  status: ProductAccessStatus = "active",
): Promise<void> {
  const prisma = getPrisma();
  const prismaKey = PRISMA_FEATURE_MAP[feature];
  const prismaStatus = status.toUpperCase() as "ACTIVE" | "TRIAL" | "INACTIVE";
  try {
    await prisma.workspaceProductFeature.upsert({
      where: { workspaceId_featureKey: { workspaceId, featureKey: prismaKey } },
      create: {
        workspaceId,
        featureKey: prismaKey,
        status: prismaStatus,
        activatedAt: status !== "inactive" ? new Date() : null,
      },
      update: {
        status: prismaStatus,
        activatedAt: status !== "inactive" ? new Date() : undefined,
        deactivatedAt: status === "inactive" ? new Date() : null,
      },
    });
  } catch (err) {
    if (isSchemaUnavailable(err)) return;
    throw err;
  }
}

export function activeTransovoFeatures(snap: WorkspaceFeatureSnapshot): TransovoProductFeature[] {
  return FEATURE_KEYS.filter((f) => isActiveEntitlement(snap[f]));
}
