import "server-only";

import type { RoutingForm, RoutingFormRule } from "@/lib/appointments/scheduling-capabilities";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function listRoutingForms(workspaceId: string): Promise<RoutingForm[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { routingForms?: RoutingForm[] }).routingForms || [];
}

export async function saveRoutingForm(workspaceId: string, form: RoutingForm) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const forms = (platform as { routingForms?: RoutingForm[] }).routingForms || [];
  const idx = forms.findIndex((f) => f.id === form.id);
  const next = idx >= 0 ? forms.map((f, i) => (i === idx ? form : f)) : [...forms, form];
  await saveAppointmentPlatformConfig(workspaceId, { routingForms: next } as object);
  return form;
}

export async function deleteRoutingForm(workspaceId: string, formId: string) {
  const forms = await listRoutingForms(workspaceId);
  const next = forms.filter((f) => f.id !== formId);
  await saveAppointmentPlatformConfig(workspaceId, { routingForms: next } as object);
}

function evaluateRoutingCondition(
  fieldId: string,
  operator: RoutingFormRule["conditions"][0]["operator"],
  value: string,
  answers: Record<string, string>,
): boolean {
  const answer = answers[fieldId] || "";
  switch (operator) {
    case "equals":
      return answer === value;
    case "contains":
      return answer.toLowerCase().includes(value.toLowerCase());
    case "gt":
      return Number(answer) > Number(value);
    case "lt":
      return Number(answer) < Number(value);
    case "in":
      return value.split(",").map((v) => v.trim()).includes(answer);
    default:
      return false;
  }
}

export function resolveRoutingFormDestination(
  form: RoutingForm,
  answers: Record<string, string>,
): RoutingFormRule["destination"] | null {
  const sorted = [...form.rules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  for (const rule of sorted) {
    if (rule.fallback) continue;
    const logic = rule.logic || "and";
    const results = rule.conditions.map((c) =>
      evaluateRoutingCondition(c.fieldId, c.operator, c.value, answers),
    );
    const match = logic === "or" ? results.some(Boolean) : results.every(Boolean);
    if (match) return rule.destination;
  }
  const fallbackRule = sorted.find((r) => r.fallback);
  return fallbackRule?.destination || form.fallbackDestination || null;
}

export type RoutingSubmission = {
  id: string;
  formId: string;
  submittedAt: string;
  visitorName?: string;
  visitorEmail?: string;
  answers: Record<string, string>;
  destination?: RoutingFormRule["destination"];
  destinationLabel?: string;
  outcome: "routed" | "booked";
};

export async function recordRoutingAnalytics(
  workspaceId: string,
  formId: string,
  destination: RoutingFormRule["destination"],
  input?: { answers?: Record<string, string>; visitorName?: string; visitorEmail?: string },
) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const stats = (platform as { routingAnalytics?: Record<string, { views: number; routes: Record<string, number> }> }).routingAnalytics || {};
  const entry = stats[formId] || { views: 0, routes: {} };
  entry.views += 1;
  const destKey =
    destination.externalUrl ||
    destination.appointmentTypeId ||
    destination.staffId ||
    destination.schedulingGroupId ||
    "unknown";
  entry.routes[destKey] = (entry.routes[destKey] || 0) + 1;
  stats[formId] = entry;

  const submissions = (platform as { routingSubmissions?: Record<string, RoutingSubmission[]> }).routingSubmissions || {};
  const list = submissions[formId] || [];
  const submission: RoutingSubmission = {
    id: `rs_${Date.now()}`,
    formId,
    submittedAt: new Date().toISOString(),
    visitorName: input?.visitorName,
    visitorEmail: input?.visitorEmail,
    answers: input?.answers || {},
    destination,
    outcome: "routed",
  };
  submissions[formId] = [submission, ...list].slice(0, 100);

  await saveAppointmentPlatformConfig(workspaceId, {
    routingAnalytics: stats,
    routingSubmissions: submissions,
  } as object);
}

export async function listRoutingSubmissions(workspaceId: string, formId: string): Promise<RoutingSubmission[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const submissions = (platform as { routingSubmissions?: Record<string, RoutingSubmission[]> }).routingSubmissions || {};
  return submissions[formId] || [];
}

export async function getRoutingAnalytics(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { routingAnalytics?: Record<string, { views: number; routes: Record<string, number> }> }).routingAnalytics || {};
}
