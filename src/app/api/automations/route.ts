import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/domain";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapAutomation } from "@/lib/mappers";
import { loadAutomations } from "@/lib/workspace-data";
import { EMPTY_DEFINITION, findTriggerNode, parseAutomationDefinition } from "@/lib/automations/types";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadAutomations(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      trigger?: string;
      definition?: Record<string, unknown>;
      status?: string;
      activate?: boolean;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const status =
      body.activate || body.status === "Active" || body.status === "ACTIVE"
        ? "ACTIVE"
        : "DRAFT";
    const definition = body.definition
      ? body.definition
      : EMPTY_DEFINITION;
    const def = parseAutomationDefinition(definition);
    const triggerNode = findTriggerNode(def);
    const triggerLabel = triggerNode
      ? triggerFromBlockType(triggerNode.data.blockType)
      : body.trigger || "Manual enrollment";

    const row = await getPrisma().automationFlow.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        trigger: triggerLabel,
        definition: definition as Prisma.InputJsonValue,
        status: status as "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED",
      },
    });
    if (status === "ACTIVE") {
      await enqueueJob({
        jobType: "automation_tick",
        queueName: "automations",
        workspaceId: auth.workspaceId,
        payload: { flowId: row.id, workspaceId: auth.workspaceId },
        idempotencyKey: `automation-tick:${row.id}:${new Date().toISOString().slice(0, 16)}`,
      });
    }
    return NextResponse.json({ data: mapAutomation(row) }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      trigger?: string;
      definition?: Record<string, unknown>;
      status?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().automationFlow.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED" | undefined;
    if (body.status) {
      const s = body.status.toUpperCase();
      if (s === "ACTIVE" || body.status === "Active") status = "ACTIVE";
      else if (s === "PAUSED" || body.status === "Paused") status = "PAUSED";
      else if (s === "ARCHIVED" || body.status === "Archived") status = "ARCHIVED";
      else status = "DRAFT";
    }

    const row = await getPrisma().automationFlow.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim() || undefined,
        trigger: body.trigger || undefined,
        definition: body.definition
          ? (body.definition as Prisma.InputJsonValue)
          : undefined,
        status,
      },
    });

    if (row.status === "ACTIVE") {
      await enqueueJob({
        jobType: "automation_tick",
        queueName: "automations",
        workspaceId: auth.workspaceId,
        payload: { flowId: row.id, workspaceId: auth.workspaceId },
        idempotencyKey: `automation-tick:${row.id}:${new Date().toISOString().slice(0, 16)}`,
      });
    }

    return NextResponse.json({ data: mapAutomation(row) });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
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
