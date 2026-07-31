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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { definition?: unknown; name?: string };

    const flow = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const definition = body.definition ?? flow.definition;
    const def = parseAutomationDefinition(definition);
    const issues = validateAutomationForPublish(body.name || flow.name, def);
    if (hasBlockingErrors(issues)) {
      return NextResponse.json({ error: "Validation failed", issues }, { status: 400 });
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
        detail: `flow=${id} version=${newVersion}`,
      },
    });

    return NextResponse.json({ data: mapAutomation(row), version: newVersion });
  } catch (err) {
    return jsonError(err, 400);
  }
}
