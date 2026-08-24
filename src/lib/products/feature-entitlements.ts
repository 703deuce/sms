import { getPrisma } from "@/lib/db";
import { DbError } from "@/lib/supabase/prisma-compat";
import type { ProductAccessStatus } from "@/lib/products/types";
import { isActiveEntitlement } from "@/lib/products/types";
import { transovoEntitlementGrandfatherEnv } from "@/lib/products/transovo-launch";
import {
  isAdminMctbTestWorkspace,
  type AdminMctbTestFlags,
} from "@/lib/mctb/admin-test-workspace-shared";

/** Transovo sellable product features (workspace-scoped). */
export type TransovoProductFeature =
  | "mctb"
  | "smart_routing"
  | "visual_voicemail"
  | "callback_requests"
  | "ai_transcription";

const FEATURE_KEYS: TransovoProductFeature[] = [
  "mctb",
  "smart_routing",
  "visual_voicemail",
  "callback_requests",
  "ai_transcription",
];

const PRISMA_FEATURE_MAP: Record<
  TransovoProductFeature,
  "MCTB" | "SMART_ROUTING" | "VISUAL_VOICEMAIL" | "CALLBACK_REQUESTS" | "AI_TRANSCRIPTION"
> = {
  mctb: "MCTB",
  smart_routing: "SMART_ROUTING",
  visual_voicemail: "VISUAL_VOICEMAIL",
  callback_requests: "CALLBACK_REQUESTS",
  ai_transcription: "AI_TRANSCRIPTION",
};

export type WorkspaceFeatureSnapshot = Record<TransovoProductFeature, ProductAccessStatus>;

export type FeatureEntitlementOptions = {
  /** Logged-in platform admin — grant full Transovo features for QA. */
  isPlatformAdmin?: boolean;
};

function allActiveSnapshot(): WorkspaceFeatureSnapshot {
  return {
    mctb: "active",
    smart_routing: "active",
    visual_voicemail: "active",
    callback_requests: "active",
    ai_transcription: "active",
  };
}

function defaultSnapshot(): WorkspaceFeatureSnapshot {
  return {
    mctb: "inactive",
    smart_routing: "inactive",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
    ai_transcription: "inactive",
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

/** Default features for newly created workspace rows — commercial purchase/trial driven. */
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
    { feature: "mctb", status: "inactive" },
    { feature: "smart_routing", status: "inactive" },
    { feature: "visual_voicemail", status: "inactive" },
    { feature: "callback_requests", status: "inactive" },
    { feature: "ai_transcription", status: "inactive" },
  ];
}

async function resolveGrandfatherFeatureStatus(
  workspaceId: string,
  feature: TransovoProductFeature,
  hasVoice: boolean,
): Promise<ProductAccessStatus> {
  if (transovoEntitlementGrandfatherEnv()) return "active";

  const prisma = getPrisma();

  if (feature === "mctb") {
    if (hasVoice) return "active";
    const [eventCount, config] = await Promise.all([
      prisma.missedCallEvent.count({ where: { workspaceId } }),
      prisma.missedCallTextConfig.findUnique({
        where: { workspaceId },
        select: { enabled: true },
      }),
    ]);
    if (eventCount > 0 || config?.enabled) return "active";
    return "inactive";
  }

  if (feature === "smart_routing") {
    const flowCount = await prisma.smartRoutingCallFlow.count({
      where: { workspaceId },
    });
    if (flowCount > 0) return "active";
    return "inactive";
  }

  if (feature === "visual_voicemail") {
    const vmCount = await prisma.voicemailMessage.count({
      where: { workspaceId },
    });
    if (vmCount > 0) return "trial";
    return "inactive";
  }

  if (feature === "callback_requests") {
    const cbCount = await prisma.callbackRequest.count({
      where: { workspaceId },
    });
    if (cbCount > 0) return "active";
    return "inactive";
  }

  return "inactive";
}

function isCompatRepoMissing(err: unknown): boolean {
  return err instanceof TypeError;
}

async function workspaceHasPlatformAdminMember(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.membership.findFirst({
    where: { workspaceId, user: { isPlatformAdmin: true } },
    select: { id: true },
  });
  return Boolean(row);
}

async function loadAdminMctbTestFlagsForWorkspace(workspaceId: string): Promise<AdminMctbTestFlags> {
  const prisma = getPrisma();
  const [ws, limitsRow] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    }),
    prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    }),
  ]);
  const cfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const limits =
    limitsRow?.limits && typeof limitsRow.limits === "object"
      ? (limitsRow.limits as Record<string, unknown>)
      : {};
  return {
    adminTestAccount: mctb.adminTestAccount === true,
    unlimitedMctbTesting: mctb.unlimitedMctbTesting === true,
    adminUnlimitedMctb: limits.adminUnlimitedMctb === true,
  };
}

/** Admin QA workspaces and platform-admin memberships get every sellable feature. */
export async function workspaceHasAdminFullEntitlements(
  workspaceId: string,
  options?: FeatureEntitlementOptions,
): Promise<boolean> {
  if (options?.isPlatformAdmin) return true;
  const flags = await loadAdminMctbTestFlagsForWorkspace(workspaceId);
  if (isAdminMctbTestWorkspace(flags)) return true;
  return workspaceHasPlatformAdminMember(workspaceId);
}

async function persistAdminFullEntitlements(workspaceId: string): Promise<void> {
  for (const feature of FEATURE_KEYS) {
    await grantWorkspaceProductFeature(workspaceId, feature, "active");
  }
}

/** Idempotent baseline feature rows for a workspace. */
export async function ensureWorkspaceProductFeatures(
  workspaceId: string,
  options?: FeatureEntitlementOptions,
): Promise<void> {
  if (await workspaceHasAdminFullEntitlements(workspaceId, options)) {
    await persistAdminFullEntitlements(workspaceId);
    return;
  }
  const prisma = getPrisma();
  const repo = prisma.workspaceProductFeature as { create?: unknown } | undefined;
  if (!repo?.create) return;
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

      let status = def.status;
      if ((workspace.type ?? "BUSINESS") === "BUSINESS") {
        status = await resolveGrandfatherFeatureStatus(
          workspaceId,
          def.feature,
          hasVoice,
        );
      }

      await prisma.workspaceProductFeature.create({
        data: {
          workspaceId,
          featureKey: prismaKey,
          status: status.toUpperCase() as "ACTIVE" | "TRIAL" | "INACTIVE",
          activatedAt: status !== "inactive" ? new Date() : null,
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
    if (isSchemaUnavailable(err) || isCompatRepoMissing(err)) return;
    console.warn("[ensureWorkspaceProductFeatures] non-fatal:", err);
  }
}

export async function getWorkspaceProductFeatures(
  workspaceId: string,
  options?: FeatureEntitlementOptions,
): Promise<WorkspaceFeatureSnapshot> {
  if (await workspaceHasAdminFullEntitlements(workspaceId, options)) {
    await persistAdminFullEntitlements(workspaceId);
    return allActiveSnapshot();
  }
  await ensureWorkspaceProductFeatures(workspaceId, options);
  const prisma = getPrisma();
  const repo = prisma.workspaceProductFeature as { findMany?: unknown } | undefined;
  if (!repo?.findMany) {
    return defaultSnapshot();
  }
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
                : row.featureKey === "AI_TRANSCRIPTION"
                  ? "ai_transcription"
                  : null;
      if (mapped) snap[mapped] = prismaStatusToApp(row.status);
    }
    return snap;
  } catch (err) {
    if (isSchemaUnavailable(err) || isCompatRepoMissing(err)) {
      return defaultSnapshot();
    }
    throw err;
  }
}

export async function hasWorkspaceProductFeature(
  workspaceId: string,
  feature: TransovoProductFeature,
  options?: FeatureEntitlementOptions,
): Promise<boolean> {
  if (await workspaceHasAdminFullEntitlements(workspaceId, options)) return true;
  const snap = await getWorkspaceProductFeatures(workspaceId, options);
  return isActiveEntitlement(snap[feature]);
}

export async function grantWorkspaceProductFeature(
  workspaceId: string,
  feature: TransovoProductFeature,
  status: ProductAccessStatus = "active",
): Promise<void> {
  const prisma = getPrisma();
  const repo = prisma.workspaceProductFeature as { upsert?: unknown } | undefined;
  if (!repo?.upsert) return;
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
    if (isSchemaUnavailable(err) || isCompatRepoMissing(err)) return;
    console.warn("[grantWorkspaceProductFeature] non-fatal:", err);
  }
}

export function activeTransovoFeatures(snap: WorkspaceFeatureSnapshot): TransovoProductFeature[] {
  return FEATURE_KEYS.filter((f) => isActiveEntitlement(snap[f]));
}
