import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapAutomation } from "@/lib/mappers";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  hasBlockingErrors,
  validateAutomationForPublish,
} from "@/lib/automations/validation";
import { parseAutomationDefinition } from "@/lib/automations/types";
import {
  activateFlowTriggers,
  inboundCallRequiresNumber,
} from "@/lib/automations/trigger-deployments";
import { ensureIntegrationSubscriptionsForFlow } from "@/lib/automations/integration-subscriptions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      definition?: unknown;
      name?: string;
      forceTakeover?: boolean;
    };

    const flow = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const definition = body.definition ?? flow.definition;
    const def = parseAutomationDefinition(definition);
    const issues = validateAutomationForPublish(body.name || flow.name, def);
    for (const node of def.nodes) {
      if (inboundCallRequiresNumber(node)) {
        issues.push({
          severity: "error",
          message:
            "Inbound Call trigger requires a phone number before Activate.",
          nodeId: node.id,
        });
      }
    }
    if (hasBlockingErrors(issues)) {
      return NextResponse.json(
        { error: "Validation failed", issues },
        { status: 400 },
      );
    }

    let triggerResult;
    try {
      triggerResult = await activateFlowTriggers(
        auth.workspaceId,
        id,
        definition,
        { forceTakeover: Boolean(body.forceTakeover) },
      );
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Trigger activation failed",
        },
        { status: 400 },
      );
    }

    if (triggerResult.conflicts.length) {
      return NextResponse.json(
        {
          error: "Trigger conflict",
          conflicts: triggerResult.conflicts,
          message: triggerResult.conflicts[0]?.message,
        },
        { status: 409 },
      );
    }

    const needsTelnyx = def.nodes.some(
      (n) =>
        n.type === "trigger" &&
        n.data.blockType === "inbound_call" &&
        String(n.data.config?.phoneNumberId || "").trim() &&
        n.data.config?.mode !== "test",
    );
    if (needsTelnyx && !triggerResult.telnyxPublished) {
      return NextResponse.json(
        {
          error:
            "Activation did not publish Telnyx routing — workflow left inactive",
        },
        { status: 400 },
      );
    }

    const integrationSubscriptions = await ensureIntegrationSubscriptionsForFlow(
      auth.workspaceId,
      definition,
    );
    const blockingIntegration = integrationSubscriptions.find((s) => !s.ok);
    if (blockingIntegration) {
      return NextResponse.json(
        {
          error: "Integration not ready",
          integrationSubscriptions,
          message: blockingIntegration.message,
        },
        { status: 400 },
      );
    }

    const newVersion = flow.version + 1;
    const row = await getPrisma().automationFlow.update({
      where: { id },
      data: {
        name: body.name?.trim() || flow.name,
        definition: definition as object,
        publishedDefinition: definition as object,
        version: newVersion,
        status: "ACTIVE",
        publishedAt: new Date(),
      },
    });

    await enqueueJob({
      jobType: "automation_batch",
      queueName: "automations",
      workspaceId: auth.workspaceId,
      payload: { flowId: id },
      idempotencyKey: `automation-publish:${id}:v${newVersion}`,
    });

    await getPrisma().auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        event: "automation.published",
        detail: `flow=${id} version=${newVersion} triggers=${triggerResult.deployments.length} telnyx=${triggerResult.telnyxPublished}`,
      },
    });

    return NextResponse.json({
      data: mapAutomation(row),
      version: newVersion,
      triggerDeployments: triggerResult.deployments,
      telnyxPublished: triggerResult.telnyxPublished,
      integrationSubscriptions,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
