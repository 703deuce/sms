import { getPrisma } from "@/lib/db";
import { isNumberPurchaseAllowed } from "@/lib/numbers/number-purchase-guard";

export type NumberPurchaseSource = "standard" | "premium";

const PERSONAL_MAX_ACTIVE = 10;
const BUSINESS_MAX_ACTIVE = 50;

export async function countActiveWorkspaceNumbers(workspaceId: string): Promise<number> {
  return getPrisma().phoneNumber.count({
    where: { workspaceId, releasedAt: null, status: { not: "Released" } },
  });
}

export async function assertCanPurchaseNumber(
  workspaceId: string,
  input?: { source?: NumberPurchaseSource },
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  if (!isNumberPurchaseAllowed()) {
    return {
      ok: false,
      error:
        "Number purchase is disabled in this environment. Set TRANSOVO_ALLOW_NUMBER_PURCHASE=1 only for intentional live purchases.",
      code: "PURCHASE_DISABLED",
    };
  }

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true },
  });
  if (!workspace) {
    return { ok: false, error: "Workspace not found", code: "WORKSPACE_NOT_FOUND" };
  }

  const active = await countActiveWorkspaceNumbers(workspaceId);
  const max =
    workspace.type === "PERSONAL" ? PERSONAL_MAX_ACTIVE : BUSINESS_MAX_ACTIVE;

  if (active >= max) {
    return {
      ok: false,
      error: `This workspace already has ${active} active numbers (limit ${max}). Release a number before purchasing another.`,
      code: "NUMBER_LIMIT_REACHED",
    };
  }

  // Standard buy path still uses messagingRegistration one-number gate for SMS onboarding.
  if (input?.source === "standard") {
    const reg = await prisma.messagingRegistration.findUnique({
      where: { workspaceId },
      select: { phoneSid: true },
    });
    if (reg?.phoneSid && !reg.phoneSid.startsWith("PENDING:")) {
      return {
        ok: false,
        error:
          "A phone number is already registered for messaging on this workspace. Use premium checkout or release the existing number first.",
        code: "MESSAGING_NUMBER_EXISTS",
      };
    }
  }

  return { ok: true };
}
