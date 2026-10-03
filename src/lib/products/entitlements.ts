import { getPrisma } from "@/lib/db";
import { DbError } from "@/lib/supabase/prisma-compat";
import type { ProductAccessStatus, ProductKey, UserProductAccess } from "@/lib/products/types";
import { isActiveEntitlement } from "@/lib/products/types";
import {
  PRODUCT_ACCESS_COOKIE,
  parseProductAccessCookie,
  serializeProductAccessCookie,
} from "@/lib/products/access-cookie";
import {
  appProductKeyToPrisma,
  prismaProductKeyToApp,
  productOfferPath,
} from "@/lib/products/paths";
import { ensureMctbWorkspaceBootstrap } from "@/lib/mctb/provisioning/workspace-bootstrap";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";
import {
  ensureOwnerMembership,
  ensureOwnerMembershipsForOwnedWorkspaces,
  resolveOwnedWorkspaceForUser,
} from "@/lib/workspace/owner-membership";
import type { WorkspaceType } from "@/lib/workspace/types";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";

export {
  PRODUCT_ACCESS_COOKIE,
  parseProductAccessCookie,
  serializeProductAccessCookie,
};

function isProductEntitlementSchemaUnavailable(err: unknown): boolean {
  if (!(err instanceof DbError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("unknown model: productentitlement") ||
    msg.includes("productentitlement") ||
    msg.includes("lastactiveproduct") ||
    msg.includes("productintent") ||
    err.code === "PGRST204"
  );
}

async function inferProductAccessFromWorkspaces(userId: string): Promise<UserProductAccess> {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { type: true } } },
  });

  let hasVoice = false;
  let hasNumbers = false;
  for (const m of memberships) {
    const wsType = (m.workspace as { type?: string }).type;
    if (wsType === "PERSONAL") hasNumbers = true;
    if (wsType === "BUSINESS" || !wsType) hasVoice = true;
  }
  if (!memberships.length) {
    hasVoice = true;
  }

  return {
    products: [],
    hasVoice,
    hasSms: false,
    hasNumbers,
    lastActiveProduct: null,
    productIntent: null,
  };
}

function prismaStatusToApp(status: string): ProductAccessStatus {
  const s = status.toLowerCase();
  if (s === "active" || s === "inactive" || s === "trial") return s;
  return "inactive";
}

/** Infer default entitlements from workspace type when none exist yet. */
export function defaultEntitlementsForWorkspaceType(
  workspaceType: WorkspaceType,
): Array<{ productKey: ProductKey; status: ProductAccessStatus }> {
  if (workspaceType === "PERSONAL") {
    return [{ productKey: "numbers", status: "active" }];
  }
  return [{ productKey: "voice", status: "active" }];
}

/** Ensure workspace has baseline product entitlements (idempotent). */
export async function ensureWorkspaceEntitlements(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { type: true, productEntitlements: { select: { productKey: true } } },
    });
    if (!workspace) return;

    const existing = new Set(
      (workspace.productEntitlements ?? []).map((e: { productKey: string }) => e.productKey),
    );
    const defaults = defaultEntitlementsForWorkspaceType(
      workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    );

    for (const def of defaults) {
      const prismaKey = appProductKeyToPrisma(def.productKey);
      if (existing.has(prismaKey)) continue;
      await prisma.productEntitlement.create({
        data: {
          workspaceId,
          productKey: prismaKey,
          status: def.status.toUpperCase() as "ACTIVE" | "TRIAL" | "INACTIVE",
          activatedAt: new Date(),
        },
      });
    }

    const { ensureWorkspaceProductFeatures } = await import(
      "@/lib/products/feature-entitlements"
    );
    await ensureWorkspaceProductFeatures(workspaceId);
  } catch (err) {
    if (isProductEntitlementSchemaUnavailable(err)) return;
    throw err;
  }
}

/** Aggregate product access across all workspaces the user belongs to. */
export async function getUserProductAccess(userId: string): Promise<UserProductAccess> {
  try {
    return await loadUserProductAccess(userId);
  } catch (err) {
    if (isProductEntitlementSchemaUnavailable(err)) {
      return inferProductAccessFromWorkspaces(userId);
    }
    throw err;
  }
}

async function loadUserProductAccess(userId: string): Promise<UserProductAccess> {
  const prisma = getPrisma();
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveProduct: true, productIntent: true },
    }),
    prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: {
          include: { productEntitlements: true },
        },
      },
    }),
  ]);

  // Backfill entitlements for each workspace lazily.
  await Promise.all(
    memberships.map((m: { workspaceId: string }) => ensureWorkspaceEntitlements(m.workspaceId)),
  );

  const refreshed = await prisma.membership.findMany({
    where: { userId },
    include: {
      workspace: { include: { productEntitlements: true } },
    },
  });

  const byProduct = new Map<ProductKey, ProductAccessStatus>();
  for (const m of refreshed) {
    for (const ent of m.workspace.productEntitlements ?? []) {
      const key = prismaProductKeyToApp(ent.productKey);
      if (!key) continue;
      const status = prismaStatusToApp(ent.status);
      const prev = byProduct.get(key);
      if (!prev || (isActiveEntitlement(status) && !isActiveEntitlement(prev))) {
        byProduct.set(key, status);
      } else if (isActiveEntitlement(status) && isActiveEntitlement(prev)) {
        byProduct.set(key, status);
      }
    }
  }

  const products = [...byProduct.entries()].map(([productKey, status]) => ({
    productKey,
    status,
    activatedAt: null,
    deactivatedAt: null,
  }));

  const hasVoice = products.some(
    (p) => p.productKey === "voice" && isActiveEntitlement(p.status),
  );
  const hasNumbers = products.some(
    (p) => p.productKey === "numbers" && isActiveEntitlement(p.status),
  );

  let hasMassTexting = false;
  try {
    const { getWorkspaceProductFeatures } = await import(
      "@/lib/products/feature-entitlements"
    );
    for (const m of refreshed) {
      const features = await getWorkspaceProductFeatures(m.workspaceId);
      if (isActiveEntitlement(features.mass_texting)) {
        hasMassTexting = true;
        break;
      }
    }
  } catch {
    // feature table may be unavailable in older envs
  }

  const hasSms =
    products.some((p) => p.productKey === "sms" && isActiveEntitlement(p.status)) ||
    hasMassTexting;

  const lastActive =
    user?.lastActiveProduct != null
      ? prismaProductKeyToApp(user.lastActiveProduct)
      : null;
  const intent =
    user?.productIntent != null ? prismaProductKeyToApp(user.productIntent) : null;

  return {
    products,
    hasVoice,
    hasSms,
    hasNumbers,
    lastActiveProduct: lastActive,
    productIntent: intent,
  };
}

/** Grant or activate a product entitlement on a workspace. */
export async function grantProductEntitlement(
  workspaceId: string,
  productKey: ProductKey,
  status: ProductAccessStatus = "active",
): Promise<void> {
  const prisma = getPrisma();
  const prismaKey = appProductKeyToPrisma(productKey);
  const prismaStatus = status.toUpperCase() as "ACTIVE" | "TRIAL" | "INACTIVE";

  try {
    await prisma.productEntitlement.upsert({
      where: {
        workspaceId_productKey: { workspaceId, productKey: prismaKey },
      },
      create: {
        workspaceId,
        productKey: prismaKey,
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
    if (isProductEntitlementSchemaUnavailable(err)) return;
    throw err;
  }
}

/** Pick workspace for a product (PERSONAL for numbers, BUSINESS for sms). */
export async function resolveWorkspaceForProduct(
  userId: string,
  product: ProductKey,
): Promise<{ workspaceId: string; workspaceType: WorkspaceType } | null> {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, type: true } } },
  });

  const preferredType: WorkspaceType = product === "numbers" ? "PERSONAL" : "BUSINESS";
  const match =
    memberships.find(
      (m: { workspace: { type: string }; workspaceId: string }) =>
        m.workspace.type === preferredType,
    ) ?? memberships[0];
  if (!match) return null;

  if (product === "voice" && isMctbV1Primary()) {
    await ensureMctbWorkspaceBootstrap(match.workspaceId).catch(() => undefined);
  }
  await ensureWorkspaceEntitlements(match.workspaceId);
  const wsType =
    product === "voice" && isMctbV1Primary()
      ? "BUSINESS"
      : match.workspace.type === "PERSONAL"
        ? "PERSONAL"
        : "BUSINESS";
  return {
    workspaceId: match.workspaceId,
    workspaceType: wsType,
  };
}

/** @deprecated Use ensureOwnerMembershipsForOwnedWorkspaces from @/lib/workspace/owner-membership */
export async function repairOwnedWorkspaceMemberships(userId: string): Promise<number> {
  return ensureOwnerMembershipsForOwnedWorkspaces(userId);
}

/** Ensure the user has a workspace for the requested product (creates one if missing). */
export async function ensureProductWorkspace(
  userId: string,
  product: ProductKey,
): Promise<{ workspaceId: string; workspaceType: WorkspaceType }> {
  const prisma = getPrisma();
  const preferredType: WorkspaceType = product === "numbers" ? "PERSONAL" : "BUSINESS";
  const allMemberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, type: true } } },
  });
  const memberships = allMemberships.filter(
    (m: { workspace: { type: string } }) => m.workspace.type === preferredType,
  );

  if (memberships.length) {
    let best = memberships[0] as (typeof memberships)[number];
    let bestCount = -1;
    for (const m of memberships) {
      const count = await prisma.phoneNumber.count({ where: { workspaceId: m.workspaceId } });
      if (count > bestCount) {
        best = m;
        bestCount = count;
      }
    }
    if (product === "voice") {
      await ensureMctbWorkspaceBootstrap(best.workspaceId).catch(() => undefined);
    }
    await ensureWorkspaceEntitlements(best.workspaceId);
    return {
      workspaceId: best.workspaceId,
      workspaceType: best.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    };
  }

  const ownedOfType = await prisma.workspace.findMany({
    where: { ownerUserId: userId, type: preferredType },
    select: { id: true, type: true },
  });
  if (ownedOfType.length) {
    let best = ownedOfType[0]!;
    let bestScore = -1;
    for (const ws of ownedOfType) {
      const phoneCount = await prisma.phoneNumber.count({ where: { workspaceId: ws.id } });
      const mctbFeature = await prisma.workspaceProductFeature
        .findFirst({
          where: { workspaceId: ws.id, featureKey: "MCTB", status: "ACTIVE" },
          select: { id: true },
        })
        .catch(() => null);
      const score = phoneCount * 10 + (mctbFeature ? 1000 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = ws;
      }
    }
    const existingMembership = await prisma.membership.findFirst({
      where: { userId, workspaceId: best.id },
    });
    if (!existingMembership) {
      await ensureOwnerMembership(userId, best.id);
    }
    await ensureWorkspaceEntitlements(best.id);
    if (product === "voice") {
      await ensureMctbWorkspaceBootstrap(best.id).catch(() => undefined);
    }
    return {
      workspaceId: best.id,
      workspaceType: best.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    };
  }

  const ownedFallback = await resolveOwnedWorkspaceForUser(userId, product);
  if (ownedFallback) {
    if (product === "voice") {
      await ensureMctbWorkspaceBootstrap(ownedFallback.workspaceId).catch(() => undefined);
    }
    await ensureWorkspaceEntitlements(ownedFallback.workspaceId);
    return ownedFallback;
  }

  const ownedCount = await prisma.workspace.count({ where: { ownerUserId: userId } });
  if (ownedCount > 0) {
    throw new Error(
      "Refusing to create workspace: user already owns workspace(s) (missing membership repair failed)",
    );
  }

  const workspace = await createWorkspaceForUser(
    userId,
    product === "numbers" ? "Personal" : "Business",
    preferredType,
  );
  if (product === "voice") {
    await ensureMctbWorkspaceBootstrap(workspace.id).catch(() => undefined);
  }
  await ensureWorkspaceEntitlements(workspace.id);
  return {
    workspaceId: workspace.id,
    workspaceType: preferredType,
  };
}

export function activeProductKeys(access: UserProductAccess): ProductKey[] {
  const keys = new Set<ProductKey>(
    access.products
      .filter((p) => isActiveEntitlement(p.status))
      .map((p) => p.productKey),
  );
  if (access.hasVoice) keys.add("voice");
  if (access.hasNumbers) keys.add("numbers");
  if (access.hasSms) keys.add("sms");
  return Array.from(keys);
}

export function productAccessCookieValue(access: UserProductAccess): string {
  return serializeProductAccessCookie(activeProductKeys(access));
}

/** Server-side guard — throws redirect path if access denied. */
export function assertProductAccess(
  access: UserProductAccess,
  product: ProductKey,
): { ok: true } | { ok: false; redirect: string } {
  const entitled =
    product === "voice"
      ? access.hasVoice
      : product === "sms"
        ? access.hasSms
        : product === "numbers"
          ? access.hasNumbers
          : false;
  if (entitled) return { ok: true };
  return { ok: false, redirect: productOfferPath(product) };
}
