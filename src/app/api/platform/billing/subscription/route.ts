import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  managePlatformProductSubscription,
  type PlatformSubscriptionManageAction,
} from "@/lib/products/platform-subscriptions";

const ALLOWED_FAMILIES = new Set(["mctb", "mctb_own_sender", "mctb_ai_recovery"]);
const ALLOWED_ACTIONS = new Set<PlatformSubscriptionManageAction>([
  "cancel_at_period_end",
  "cancel_now",
  "resume",
]);

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const productFamily = String(body.productFamily || "").trim();
    const action = String(body.action || "").trim() as PlatformSubscriptionManageAction;
    if (!ALLOWED_FAMILIES.has(productFamily)) {
      return jsonError(new Error("invalid productFamily"), 400);
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      return jsonError(new Error("invalid action"), 400);
    }

    const result = await managePlatformProductSubscription({
      workspaceId: auth.workspaceId,
      productFamily,
      action,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
