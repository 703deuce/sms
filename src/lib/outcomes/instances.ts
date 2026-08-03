import { getPrisma } from "@/lib/db";
import { outcomeHref, outcomeSolutions } from "@/lib/outcomes/registry";
import type { SolutionNavInstance } from "@/lib/solutions-nav";

type AgentRow = {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  purpose: string | null;
  draftConfig: unknown;
};

function readAnswerWhen(draftConfig: unknown): string | null {
  if (!draftConfig || typeof draftConfig !== "object") return null;
  const cfg = draftConfig as Record<string, unknown>;
  if (typeof cfg.answerWhen === "string") return cfg.answerWhen;
  const wizard = (cfg.wizardState ?? cfg.appointmentReceptionist ?? null) as Record<
    string,
    unknown
  > | null;
  if (!wizard) return null;
  const goals = (wizard.goals ?? wizard) as Record<string, unknown>;
  const answerWhen = goals.answerWhen ?? wizard.answerWhen;
  return typeof answerWhen === "string" ? answerWhen : null;
}

function hasBooking(draftConfig: unknown): boolean {
  if (!draftConfig || typeof draftConfig !== "object") return false;
  const cfg = draftConfig as Record<string, unknown>;
  const caps = cfg.capabilities ?? cfg.enabledCapabilities;
  if (Array.isArray(caps)) {
    return caps.some(
      (c) =>
        c === "book_appointments" ||
        c === "booking" ||
        (typeof c === "object" &&
          c &&
          ((c as { id?: string }).id === "book_appointments" ||
            (c as { key?: string }).key === "book_appointments")),
    );
  }
  const tools = cfg.tools;
  if (Array.isArray(tools)) {
    return tools.some(
      (t) =>
        typeof t === "string" &&
        /book|appointment|calendar|calendly/i.test(t),
    );
  }
  return Boolean(
    (cfg as { bookingEnabled?: boolean }).bookingEnabled ||
      (cfg as { capabilityPack?: string }).capabilityPack === "appointment_receptionist",
  );
}

function statusLabel(status: string): string {
  if (status === "ACTIVE" || status === "PUBLISHED") return "Active";
  if (status === "DRAFT") return "Draft";
  if (status === "PAUSED") return "Paused";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function matchesSolution(
  agent: AgentRow,
  match: NonNullable<(typeof outcomeSolutions)[number]["agentMatch"]>,
): boolean {
  if (match.purposes?.length) {
    const purpose = agent.purpose || "";
    if (!match.purposes.includes(purpose)) {
      // Still allow purpose-null agents that look like receptionists via booking pack.
      if (!(match.booking && hasBooking(agent.draftConfig))) return false;
    }
  }
  if (match.answerWhen?.length) {
    const when = readAnswerWhen(agent.draftConfig);
    if (!when || !match.answerWhen.includes(when)) return false;
  }
  if (match.booking && !hasBooking(agent.draftConfig) && agent.purpose !== "appointment_receptionist") {
    return false;
  }
  return true;
}

function instanceChildren(
  solutionSlug: string,
  agentId: string,
): { label: string; href: string }[] {
  const base = `/voice/agents/${agentId}`;
  switch (solutionSlug) {
    case "appointment-booking":
      return [
        { label: "Calendar", href: "/voice/calendars" },
        { label: "Appointment Types", href: "/voice/calendars" },
        { label: "Booking Rules", href: `${base}` },
        { label: "Confirmations", href: "/templates" },
        { label: "Test", href: "/voice/testing" },
        { label: "Results", href: outcomeHref(solutionSlug, "results") },
      ];
    case "missed-overflow":
      return [
        { label: "Ring Rules", href: "/voice/inbound-routing" },
        { label: "Call Handling", href: base },
        { label: "Follow-Up", href: "/automations" },
        { label: "Notifications", href: "/settings/notifications" },
        { label: "Results", href: outcomeHref(solutionSlug, "results") },
      ];
    default:
      return [
        { label: "Open agent", href: base },
        { label: "Results", href: outcomeHref(solutionSlug, "results") },
      ];
  }
}

/** Load voice agents and map them into Solutions-nav instance shortcuts. */
export async function loadOutcomeInstances(
  workspaceId: string,
): Promise<Record<string, SolutionNavInstance[]>> {
  if (!workspaceId) return {};

  try {
    const prisma = getPrisma();
    const agents = (await prisma.voiceAgent.findMany({
      where: { workspaceId, archivedAt: null },
      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
        purpose: true,
        draftConfig: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })) as AgentRow[];

    const out: Record<string, SolutionNavInstance[]> = {};

    for (const solution of outcomeSolutions) {
      if (!solution.agentMatch) continue;
      const matched = agents.filter((a) => matchesSolution(a, solution.agentMatch!));
      if (!matched.length) continue;

      out[solution.slug] = matched.map((agent) => {
        const label = agent.displayName?.trim() || agent.name;
        return {
          id: agent.id,
          label,
          status: statusLabel(String(agent.status)),
          href: `/voice/agents/${agent.id}`,
          children: instanceChildren(solution.slug, agent.id),
        };
      });
    }

    // AI Receptionist overview lists every receptionist-purpose agent.
    const receptionists = agents.filter(
      (a) =>
        a.purpose === "appointment_receptionist" ||
        hasBooking(a.draftConfig),
    );
    if (receptionists.length) {
      out["ai-receptionist"] = receptionists.map((agent) => ({
        id: agent.id,
        label: agent.displayName?.trim() || agent.name,
        status: statusLabel(String(agent.status)),
        href: `/voice/agents/${agent.id}`,
        children: [
          { label: "Open agent", href: `/voice/agents/${agent.id}` },
          { label: "Inbound routing", href: "/voice/inbound-routing" },
        ],
      }));
    }

    return out;
  } catch {
    return {};
  }
}
