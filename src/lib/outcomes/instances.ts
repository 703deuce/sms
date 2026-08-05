import { getPrisma } from "@/lib/db";
import {
  getOutcomeSolution,
  outcomeHref,
  outcomeSolutions,
} from "@/lib/outcomes/registry";
import { outcomeSlugFromWizard } from "@/lib/solutions/appointment-receptionist/save-setup";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  outcomeSlugFromAgentType,
  agentTypeFromOutcomeSlug,
} from "@/lib/agents/types";
import type { SolutionNavInstance } from "@/lib/solutions-nav";

type AgentRow = {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  purpose: string | null;
  agentType: string | null;
  draftConfig: unknown;
  sourceSolutionSetupId: string | null;
};

type SetupRow = {
  id: string;
  name: string;
  status: string;
  solutionType: string;
  configJson: unknown;
  linkedAgentIds: string[];
  linkedAutomationIds: string[];
  externalKey: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function statusLabel(status: string): string {
  if (status === "ACTIVE" || status === "PUBLISHED" || status === "LIVE")
    return "Active";
  if (status === "DRAFT") return "Draft";
  if (status === "PAUSED") return "Paused";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function readWizardBits(draftConfig: unknown): {
  answerWhen?: string;
  capabilities?: string[];
  preset?: string | null;
  outcomeSlug?: string | null;
} {
  const cfg = asRecord(draftConfig);
  if (!cfg) return {};
  const advanced = asRecord(cfg.advanced);
  const snap = asRecord(advanced?.appointmentReceptionistWizard);
  const wizard =
    asRecord(cfg.wizardState) || asRecord(cfg.appointmentReceptionist);
  const goals = asRecord(wizard?.goals) || wizard;

  const capsRaw =
    snap?.capabilities ??
    cfg.capabilities ??
    cfg.enabledCapabilities ??
    goals?.capabilities;
  const capabilities = Array.isArray(capsRaw)
    ? capsRaw.filter((c): c is string => typeof c === "string")
    : undefined;

  const answerWhen =
    (typeof snap?.answerWhen === "string" && snap.answerWhen) ||
    (typeof cfg.answerWhen === "string" && cfg.answerWhen) ||
    (typeof goals?.answerWhen === "string" && goals.answerWhen) ||
    (typeof wizard?.answerWhen === "string" && wizard.answerWhen) ||
    undefined;

  return {
    answerWhen,
    capabilities,
    preset:
      (typeof snap?.preset === "string" && snap.preset) ||
      (typeof cfg.preset === "string" && cfg.preset) ||
      null,
    outcomeSlug:
      (typeof snap?.outcomeSlug === "string" && snap.outcomeSlug) ||
      (typeof cfg.outcomeSlug === "string" && cfg.outcomeSlug) ||
      null,
  };
}

/** Resolve the single outcome slug that owns a SolutionSetup. */
export function outcomeSlugFromSetup(setup: {
  solutionType: string;
  configJson?: unknown;
}): string {
  const cfg = asRecord(setup.configJson);
  if (typeof cfg?.outcomeSlug === "string" && cfg.outcomeSlug.trim()) {
    return cfg.outcomeSlug.trim();
  }
  if (typeof cfg?.agentType === "string" && cfg.agentType.trim()) {
    const fromType = outcomeSlugFromAgentType(cfg.agentType);
    if (fromType) return fromType;
  }
  if (setup.solutionType === "appointment-receptionist") {
    return "appointment-booking";
  }
  if (getOutcomeSolution(setup.solutionType)) {
    return setup.solutionType;
  }
  return setup.solutionType;
}

function inferOutcomeSlugForOrphanAgent(agent: AgentRow): string | null {
  // Explicit product type wins — never re-infer from capabilities.
  const fromType = outcomeSlugFromAgentType(agent.agentType);
  if (fromType) return fromType;

  if (
    agent.purpose !== "appointment_receptionist" &&
    agent.purpose !== "ai_receptionist"
  ) {
    const bits = readWizardBits(agent.draftConfig);
    if (!bits.capabilities?.includes("book_appointments") && !bits.answerWhen) {
      return null;
    }
  }
  const bits = readWizardBits(agent.draftConfig);
  return outcomeSlugFromWizard({
    outcomeSlug: bits.outcomeSlug,
    preset: bits.preset,
    answerWhen: (bits.answerWhen ||
      "every_call") as AppointmentReceptionistWizardState["answerWhen"],
    capabilities:
      (bits.capabilities as AppointmentReceptionistWizardState["capabilities"]) ||
      [],
  });
}

function instanceChildren(
  solutionSlug: string,
  instanceId: string,
  kind: "agent" | "setup",
): { label: string; href: string }[] {
  const solution = getOutcomeSolution(solutionSlug);
  const slugs = solution?.instanceShortcutSlugs;
  if (!slugs?.length) {
    return [
      {
        label: "Open",
        href:
          kind === "agent"
            ? `/voice/agents/${instanceId}`
            : outcomeHref(solutionSlug, "setup"),
      },
      { label: "Results", href: outcomeHref(solutionSlug, "results") },
    ];
  }
  const q =
    kind === "agent"
      ? `agentId=${encodeURIComponent(instanceId)}`
      : `setupId=${encodeURIComponent(instanceId)}`;
  return slugs
    .map((slug) => {
      const page = solution!.pages.find((p) => p.slug === slug);
      if (!page) return null;
      return {
        label: page.label,
        href: `${outcomeHref(solutionSlug, slug)}?${q}`,
      };
    })
    .filter((x): x is { label: string; href: string } => Boolean(x));
}

function pushInstance(
  out: Record<string, SolutionNavInstance[]>,
  outcomeSlug: string,
  instance: SolutionNavInstance,
) {
  if (!getOutcomeSolution(outcomeSlug) && outcomeSlug !== "ai-receptionist") {
    return;
  }
  if (!out[outcomeSlug]) out[outcomeSlug] = [];
  if (out[outcomeSlug].some((i) => i.id === instance.id)) return;
  out[outcomeSlug].push(instance);
}

/**
 * Load created agents into catalog instance shortcuts.
 * Ownership is exclusive via SolutionSetup.outcomeSlug / VoiceAgent.agentType.
 */
export async function loadOutcomeInstances(
  workspaceId: string,
): Promise<Record<string, SolutionNavInstance[]>> {
  if (!workspaceId) return {};

  try {
    const prisma = getPrisma();
    const [setups, agents] = await Promise.all([
      prisma.solutionSetup.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          status: true,
          solutionType: true,
          configJson: true,
          linkedAgentIds: true,
          linkedAutomationIds: true,
          externalKey: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }) as Promise<SetupRow[]>,
      prisma.voiceAgent.findMany({
        where: { workspaceId, archivedAt: null },
        select: {
          id: true,
          name: true,
          displayName: true,
          status: true,
          purpose: true,
          agentType: true,
          draftConfig: true,
          sourceSolutionSetupId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }) as Promise<AgentRow[]>,
    ]);

    const agentById = new Map(agents.map((a) => [a.id, a]));
    const claimedAgentIds = new Set<string>();
    const claimedSetupIds = new Set<string>();
    const out: Record<string, SolutionNavInstance[]> = {};

    for (const setup of setups) {
      const outcomeSlug = outcomeSlugFromSetup(setup);
      const linkedAgents = (setup.linkedAgentIds || [])
        .map((id) => agentById.get(id))
        .filter((a): a is AgentRow => Boolean(a));

      if (linkedAgents.length) {
        for (const agent of linkedAgents) {
          if (claimedAgentIds.has(agent.id)) continue;
          claimedAgentIds.add(agent.id);
          claimedSetupIds.add(setup.id);
          const typeSlug = outcomeSlugFromAgentType(agent.agentType);
          // Setup outcomeSlug is ownership; agentType is kept in sync on save.
          const ownedSlug = outcomeSlug || typeSlug || "appointment-booking";
          const label = agent.displayName?.trim() || agent.name || setup.name;
          pushInstance(out, ownedSlug, {
            id: agent.id,
            label,
            status: statusLabel(String(agent.status)),
            href: `/voice/agents/${agent.id}`,
            children: instanceChildren(ownedSlug, agent.id, "agent"),
          });
        }
        continue;
      }

      if (claimedSetupIds.has(setup.id)) continue;
      claimedSetupIds.add(setup.id);
      const href =
        setup.solutionType === "missed-call-text-back"
          ? `/solutions/missed-call-text-back/setup?setupId=${encodeURIComponent(setup.id)}`
          : outcomeHref(outcomeSlug, "setup") +
            `?setupId=${encodeURIComponent(setup.id)}`;
      pushInstance(out, outcomeSlug, {
        id: setup.id,
        label: setup.name,
        status: statusLabel(String(setup.status)),
        href,
        children: instanceChildren(outcomeSlug, setup.id, "setup"),
      });
    }

    for (const agent of agents) {
      if (claimedAgentIds.has(agent.id)) continue;
      const outcomeSlug = inferOutcomeSlugForOrphanAgent(agent);
      if (!outcomeSlug) continue;
      claimedAgentIds.add(agent.id);
      const label = agent.displayName?.trim() || agent.name;
      pushInstance(out, outcomeSlug, {
        id: agent.id,
        label,
        status: statusLabel(String(agent.status)),
        href: `/voice/agents/${agent.id}`,
        children: instanceChildren(outcomeSlug, agent.id, "agent"),
      });
    }

    const receptionistSlugs = new Set(
      outcomeSolutions
        .filter((s) => s.category === "calls-ai")
        .map((s) => s.slug),
    );
    const umbrella: SolutionNavInstance[] = [];
    const seen = new Set<string>();
    for (const slug of receptionistSlugs) {
      for (const inst of out[slug] || []) {
        if (seen.has(inst.id)) continue;
        if (!agentById.has(inst.id)) continue;
        seen.add(inst.id);
        umbrella.push({
          ...inst,
          children: [
            { label: "Open agent", href: `/voice/agents/${inst.id}` },
            { label: "Inbound routing", href: "/voice/inbound-routing" },
          ],
        });
      }
    }
    if (umbrella.length) out["ai-receptionist"] = umbrella;

    return out;
  } catch {
    return {};
  }
}

/** Re-export for callers that stamp VoiceAgent.agentType from an outcome. */
export { agentTypeFromOutcomeSlug };
