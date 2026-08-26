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
import { ensureMctbWorkspaceSeeded } from "@/lib/mctb/provisioning/seed-workspace";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";
import type { WorkspaceType } from "@/lib/workspace/types";

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

  await ensureWorkspaceEntitlements(match.workspaceId);
  return {
    workspaceId: match.workspaceId,
    workspaceType: match.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  };
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
      await ensureMctbWorkspaceSeeded(best.workspaceId);
    }
    await ensureWorkspaceEntitlements(best.workspaceId);
    return {
      workspaceId: best.workspaceId,
      workspaceType: best.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    };
  }

  const ownedWithNumbers = await prisma.workspace.findFirst({
    where: { ownerUserId: userId, type: preferredType },
    select: { id: true, type: true },
  });
  if (ownedWithNumbers) {
    const count = await prisma.phoneNumber.count({ where: { workspaceId: ownedWithNumbers.id } });
    if (count > 0) {
      const existingMembership = await prisma.membership.findFirst({
        where: { userId, workspaceId: ownedWithNumbers.id },
      });
      if (!existingMembership) {
        await prisma.membership.create({
          data: { userId, workspaceId: ownedWithNumbers.id, role: "OWNER" },
        });
      }
      await ensureWorkspaceEntitlements(ownedWithNumbers.id);
      if (product === "voice") {
        await ensureMctbWorkspaceSeeded(ownedWithNumbers.id);
      }
      return {
        workspaceId: ownedWithNumbers.id,
        workspaceType: ownedWithNumbers.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
      };
    }
  }

  const workspace = await createWorkspaceForUser(
    userId,
    product === "numbers" ? "Personal" : "Business",
    preferredType,
  );
  if (product === "voice") {
    await ensureMctbWorkspaceSeeded(workspace.id);
  }
  await ensureWorkspaceEntitlements(workspace.id);
  return {
    workspaceId: workspace.id,
    workspaceType: preferredType,
  };
}

export function activeProductKeys(access: UserProductAccess): ProductKey[] {
  const fromProducts = access.products
    .filter((p) => isActiveEntitlement(p.status))
    .map((p) => p.productKey);
  if (fromProducts.length) return fromProducts;
  const keys: ProductKey[] = [];
  if (access.hasVoice) keys.push("voice");
  if (access.hasNumbers) keys.push("numbers");
  if (access.hasSms) keys.push("sms");
  return keys;
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
