/**
 * When DEV_AUTH_BYPASS=1, resolve a real workspace session without visiting
 * /api/auth/dev-bypass or the login UI. Cached for the server process lifetime.
 */
import type { Session, WorkspaceTypeCookie } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getUserProductAccess } from "@/lib/products/entitlements";
import type { UserProductAccess } from "@/lib/products/types";
import { devAuthBypassEmailHint, isDevAuthBypassEnabled } from "@/lib/auth/dev-auth-bypass";

export type DevAutoSession = {
  session: Session;
  workspaceId: string;
  workspaceType: WorkspaceTypeCookie;
  access: UserProductAccess;
};

let cached: DevAutoSession | null | undefined;

async function findBypassUser(emailHint: string) {
  const prisma = getPrisma();
  const normalized = emailHint.trim().toLowerCase();
  if (normalized.includes("@")) {
    return prisma.user.findUnique({ where: { email: normalized } });
  }
  return prisma.user.findFirst({
    where: { email: { startsWith: normalized } },
    orderBy: { createdAt: "asc" },
  });
}

export function clearDevAutoSessionCache() {
  cached = undefined;
}

/** Returns a cached dev session or null when bypass is off / user missing. */
export async function resolveDevAutoSession(): Promise<DevAutoSession | null> {
  if (!isDevAuthBypassEnabled()) return null;
  if (cached !== undefined) return cached;

  try {
    const user = await findBypassUser(devAuthBypassEmailHint());
    if (!user) {
      cached = null;
      return null;
    }

    const memberships = await getPrisma().membership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true, type: true } } },
    });
    if (!memberships.length) {
      cached = null;
      return null;
    }

    let membership = memberships[0];
    const { resolvePreferredBusinessWorkspaceId } = await import(
      "@/lib/workspace/preferred-business-workspace"
    );
    const preferredId = await resolvePreferredBusinessWorkspaceId(user.id, membership.workspaceId);
    const preferred = memberships.find((m) => m.workspaceId === preferredId);
    if (preferred) membership = preferred;

    const access = await getUserProductAccess(user.id);
    cached = {
      session: {
        userId: user.id,
        email: user.email,
        name: user.name || user.email,
        isAdmin: Boolean(user.isPlatformAdmin),
      },
      workspaceId: membership.workspaceId,
      workspaceType: membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
      access,
    };
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
