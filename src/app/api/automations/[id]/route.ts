import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapAutomation } from "@/lib/mappers";
import { parseAutomationDefinition, findTriggerNode } from "@/lib/automations/types";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import { detectAdvancedCustomization } from "@/lib/solutions/missed-call-text-back/sync";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const flow = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      data: {
        ...mapAutomation(flow),
        description: flow.description,
        definition: flow.definition,
        publishedDefinition: flow.publishedDefinition,
        version: flow.version,
        sourceSolutionSetupId: flow.sourceSolutionSetupId ?? null,
        advancedCustomized: Boolean(flow.advancedCustomized),
        linkedAgentIds: flow.linkedAgentIds || [],
        publishedAt: flow.publishedAt?.toISOString() ?? null,
        createdAt: flow.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      definition?: unknown;
      status?: string;
      action?: "pause" | "resume" | "archive" | "duplicate";
    };

    const existing = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "duplicate") {
      const def = parseAutomationDefinition(existing.definition);
      const dup = await getPrisma().automationFlow.create({
        data: {
          workspaceId: auth.workspaceId,
          name: `${existing.name} (copy)`,
          description: existing.description,
          trigger: existing.trigger,
          definition: existing.definition as object,
          status: "DRAFT",
        },
      });
      return NextResponse.json({ data: mapAutomation(dup) }, { status: 201 });
    }

    let status = existing.status;
    if (body.action === "pause") status = "PAUSED";
    if (body.action === "resume") status = "ACTIVE";
    if (body.action === "archive") status = "ARCHIVED";

    if (body.status) {
      const s = body.status.toUpperCase();
      if (s === "ACTIVE") status = "ACTIVE";
      else if (s === "PAUSED") status = "PAUSED";
      else if (s === "DRAFT") status = "DRAFT";
      else if (s === "ARCHIVED") status = "ARCHIVED";
    }

    let trigger = existing.trigger;
    let advancedCustomized = Boolean(existing.advancedCustomized);
    if (body.definition) {
      const def = parseAutomationDefinition(body.definition);
      const triggerNode = findTriggerNode(def);
      if (triggerNode) {
        trigger = triggerFromBlockType(triggerNode.data.blockType);
      }
      // Once a solution-linked flow is structurally customized in the builder,
      // lock advancedCustomized so wizards cannot silently overwrite it.
      if (
        existing.sourceSolutionSetupId &&
        detectAdvancedCustomization(body.definition)
      ) {
        advancedCustomized = true;
      }
    }

    const row = await getPrisma().automationFlow.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        description: body.description ?? undefined,
        definition: body.definition ? (body.definition as object) : undefined,
        trigger,
        status,
        advancedCustomized,
      },
    });

    return NextResponse.json({
      data: {
        ...mapAutomation(row),
        advancedCustomized: Boolean(row.advancedCustomized),
        sourceSolutionSetupId: row.sourceSolutionSetupId ?? null,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const existing = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().automationFlow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
