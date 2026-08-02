import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  approveAiIntegrationAction,
  requestAiIntegrationAction,
} from "@/lib/integrations/framework/supervised-ai";
import {
  getWorkspaceAiPolicy,
  saveWorkspaceAiPolicy,
  type WorkspaceAiIntegrationPolicy,
} from "@/lib/integrations/framework/ai-policy";
import type { IntegrationActionId } from "@/lib/integrations/framework/actions-registry";

async function membershipRole(workspaceId: string, userId: string) {
  const m = await getPrisma().membership.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });
  return (m as { role?: string } | null)?.role || null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    if (searchParams.get("view") === "policy") {
      const policy = await getWorkspaceAiPolicy(auth.workspaceId);
      return NextResponse.json({ data: { policy } });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const role = await membershipRole(auth.workspaceId, auth.session.userId);
    const body = (await request.json()) as {
      op?: string;
      provider?: string;
      actionId?: string;
      params?: Record<string, unknown>;
      contactId?: string | null;
      contactLabel?: string | null;
      approvalId?: string;
      decision?: "approved" | "rejected";
      policy?: Partial<WorkspaceAiIntegrationPolicy>;
      recordCount?: number;
    };

    if (body.op === "save_policy") {
      if (!["OWNER", "ADMINISTRATOR"].includes(String(role || ""))) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const policy = await saveWorkspaceAiPolicy(auth.workspaceId, body.policy || {});
      return NextResponse.json({ data: { policy } });
    }

    if (body.op === "approve") {
      const result = await approveAiIntegrationAction({
        workspaceId: auth.workspaceId,
        approvalId: String(body.approvalId || ""),
        approverUserId: auth.session.userId,
        decision: body.decision === "rejected" ? "rejected" : "approved",
      });
      return NextResponse.json({ data: result }, { status: result.ok ? 200 : 400 });
    }

    const result = await requestAiIntegrationAction({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      role,
      provider: String(body.provider || ""),
      actionId: String(body.actionId || "") as IntegrationActionId,
      params: body.params || {},
      contactId: body.contactId,
      contactLabel: body.contactLabel,
      recordCount: body.recordCount || 1,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}
