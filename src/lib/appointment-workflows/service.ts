import "server-only";

import { getPrisma } from "@/lib/db";
import {
  parseAppointmentTypeScope,
  parseWorkflowSteps,
  type AppointmentTypeScope,
  type AppointmentWorkflowChannel,
  type AppointmentWorkflowRecord,
  type AppointmentWorkflowStep,
  type AppointmentWorkflowTrigger,
  type WorkflowConditionGroup,
} from "./types";
import { getPrebuiltTemplate } from "./templates";
import { getOrganizationPolicy, isManagedAutomation } from "@/lib/appointments/org-permissions";

function parseConditionGroup(raw: unknown): WorkflowConditionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.conditions)) return null;
  return {
    logic: o.logic === "or" ? "or" : "and",
    conditions: o.conditions as WorkflowConditionGroup["conditions"],
  };
}

function mapRow(row: {
  id: string;
  workspaceId: string;
  name: string;
  sourceType: string;
  templateId: string | null;
  active: boolean;
  status: string;
  trigger: string;
  appointmentTypeScope: unknown;
  channels: unknown;
  conditions: unknown;
  stepsJson: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentWorkflowRecord {
  const channels = Array.isArray(row.channels)
    ? (row.channels.filter((c): c is AppointmentWorkflowChannel =>
        c === "sms" || c === "email" || c === "both",
      ))
    : [];
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    sourceType: row.sourceType === "template" ? "template" : "custom",
    templateId: row.templateId,
    active: row.active,
    status:
      row.status === "paused" || row.status === "draft"
        ? row.status
        : "active",
    trigger: row.trigger as AppointmentWorkflowTrigger,
    appointmentTypeScope: parseAppointmentTypeScope(row.appointmentTypeScope),
    channels,
    conditions: parseConditionGroup(row.conditions),
    steps: parseWorkflowSteps(row.stepsJson),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateAppointmentWorkflowInput = {
  name: string;
  sourceType?: "template" | "custom";
  templateId?: string;
  active?: boolean;
  status?: "active" | "paused" | "draft";
  trigger: AppointmentWorkflowTrigger;
  appointmentTypeScope?: AppointmentTypeScope;
  channels?: AppointmentWorkflowChannel[];
  conditions?: WorkflowConditionGroup | null;
  steps?: AppointmentWorkflowStep[];
};

export type UpdateAppointmentWorkflowInput = Partial<CreateAppointmentWorkflowInput>;

export async function listAppointmentWorkflows(
  workspaceId: string,
): Promise<AppointmentWorkflowRecord[]> {
  const rows = await getPrisma().appointmentWorkflow.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapRow);
}

export async function getAppointmentWorkflow(
  workspaceId: string,
  id: string,
): Promise<AppointmentWorkflowRecord | null> {
  const row = await getPrisma().appointmentWorkflow.findFirst({
    where: { id, workspaceId },
  });
  return row ? mapRow(row) : null;
}

export async function createAppointmentWorkflow(
  workspaceId: string,
  input: CreateAppointmentWorkflowInput,
): Promise<AppointmentWorkflowRecord> {
  const orgPolicy = await getOrganizationPolicy(workspaceId);
  const sourceType = input.sourceType || (input.templateId ? "template" : "custom");
  if (
    orgPolicy.managedAutomationsOnly &&
    !isManagedAutomation({ sourceType, templateId: input.templateId }, orgPolicy)
  ) {
    throw new Error("Organization policy allows only managed (template) automations");
  }

  const template = input.templateId ? getPrebuiltTemplate(input.templateId) : null;
  const steps = input.steps?.length
    ? input.steps
    : template?.defaultSteps || [];

  if (!steps.length) throw new Error("At least one workflow step is required");

  const conditions =
    input.conditions !== undefined
      ? input.conditions
      : template?.defaultConditions ?? null;

  const row = await getPrisma().appointmentWorkflow.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      sourceType: input.sourceType || (input.templateId ? "template" : "custom"),
      templateId: input.templateId || null,
      active: input.active ?? true,
      status: input.status || "active",
      trigger: input.trigger,
      appointmentTypeScope: (input.appointmentTypeScope || { mode: "all" }) as object,
      channels: (input.channels || ["sms"]) as object,
      conditions: conditions as object,
      stepsJson: steps as object,
      version: 1,
    },
  });
  return mapRow(row);
}

export async function updateAppointmentWorkflow(
  workspaceId: string,
  id: string,
  input: UpdateAppointmentWorkflowInput,
): Promise<AppointmentWorkflowRecord> {
  const existing = await getAppointmentWorkflow(workspaceId, id);
  if (!existing) throw new Error("Workflow not found");

  const orgPolicy = await getOrganizationPolicy(workspaceId);
  const nextSourceType = input.sourceType ?? existing.sourceType;
  const nextTemplateId = input.templateId ?? existing.templateId;
  if (
    orgPolicy.managedAutomationsOnly &&
    !isManagedAutomation({ sourceType: nextSourceType, templateId: nextTemplateId }, orgPolicy)
  ) {
    throw new Error("Organization policy allows only managed (template) automations");
  }

  const steps = input.steps ?? existing.steps;
  if (!steps.length) throw new Error("At least one workflow step is required");

  const row = await getPrisma().appointmentWorkflow.update({
    where: { id, workspaceId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      ...(input.appointmentTypeScope !== undefined
        ? { appointmentTypeScope: input.appointmentTypeScope as object }
        : {}),
      ...(input.channels !== undefined ? { channels: input.channels as object } : {}),
      ...(input.conditions !== undefined ? { conditions: input.conditions as object } : {}),
      ...(input.steps !== undefined ? { stepsJson: steps as object, version: existing.version + 1 } : {}),
    },
  });
  return mapRow(row);
}

export async function duplicateAppointmentWorkflow(
  workspaceId: string,
  id: string,
): Promise<AppointmentWorkflowRecord> {
  const existing = await getAppointmentWorkflow(workspaceId, id);
  if (!existing) throw new Error("Workflow not found");
  return createAppointmentWorkflow(workspaceId, {
    name: `${existing.name} (copy)`,
    sourceType: "custom",
    active: false,
    status: "draft",
    trigger: existing.trigger,
    appointmentTypeScope: existing.appointmentTypeScope,
    channels: existing.channels,
    conditions: existing.conditions,
    steps: existing.steps,
  });
}

export async function deleteAppointmentWorkflow(workspaceId: string, id: string): Promise<void> {
  const existing = await getAppointmentWorkflow(workspaceId, id);
  if (!existing) throw new Error("Workflow not found");
  await getPrisma().appointmentWorkflow.delete({ where: { id, workspaceId } });
}

export async function listActiveWorkflowsForTrigger(
  workspaceId: string,
  trigger: AppointmentWorkflowTrigger,
): Promise<AppointmentWorkflowRecord[]> {
  const rows = await getPrisma().appointmentWorkflow.findMany({
    where: { workspaceId, trigger, active: true, status: "active" },
  });
  return rows.map(mapRow);
}

/** Idempotent install from a prebuilt template — returns existing workflow when already installed. */
export async function installWorkflowFromTemplate(
  workspaceId: string,
  templateId: string,
  input?: Partial<CreateAppointmentWorkflowInput>,
): Promise<AppointmentWorkflowRecord> {
  const template = getPrebuiltTemplate(templateId);
  if (!template) throw new Error("Workflow template not found");

  const existing = (await listAppointmentWorkflows(workspaceId)).find(
    (w) => w.templateId === templateId,
  );
  if (existing) return existing;

  return createAppointmentWorkflow(workspaceId, {
    name: input?.name?.trim() || template.name,
    sourceType: "template",
    templateId: template.id,
    active: input?.active ?? true,
    status: input?.status || "active",
    trigger: input?.trigger || template.trigger,
    channels: input?.channels || template.channels,
    conditions: input?.conditions !== undefined ? input.conditions : template.defaultConditions,
    steps: input?.steps?.length ? input.steps : template.defaultSteps,
    appointmentTypeScope: input?.appointmentTypeScope,
  });
}
