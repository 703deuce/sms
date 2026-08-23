import type { DraftConfig } from "../types";
import type { AiRoutingContextDestination } from "./types";

function labelForPhone(
  phone: string | undefined | null,
  destinations: AiRoutingContextDestination[],
): string {
  if (!phone?.trim()) return "—";
  const norm = phone.replace(/\D/g, "");
  const match = destinations.find(
    (d) => d.phoneNumber && d.phoneNumber.replace(/\D/g, "") === norm,
  );
  return match ? match.label : phone;
}

function summarizeRingTarget(
  config: Record<string, unknown>,
  destinations: AiRoutingContextDestination[],
): string {
  const mode = String(config.mode ?? "sequential");
  const destIds = (config.destinationIds as string[] | undefined) ?? [];
  const phones = (config.phoneNumbers as string[] | undefined) ?? [];
  const labels: string[] = [];
  for (const id of destIds) {
    const d = destinations.find((x) => x.id === id);
    if (d) labels.push(d.label);
  }
  for (const p of phones) {
    labels.push(labelForPhone(p, destinations));
  }
  if (!labels.length) {
    const phone = String(config.phoneNumber ?? "").trim();
    if (phone) return labelForPhone(phone, destinations);
    return "—";
  }
  if (mode === "simultaneous") return labels.join(" + ");
  return labels.join(" → ");
}

export function summarizeDraftConfig(
  draft: DraftConfig,
  destinations: AiRoutingContextDestination[] = [],
): string {
  const lines: string[] = [];
  const greeting = draft.greeting?.text?.trim();
  if (greeting) lines.push(`Greeting: ${greeting.slice(0, 120)}`);

  const menuOpts = draft.menuOptions ?? [];
  if (menuOpts.length) {
    lines.push("Main menu:");
    for (const opt of menuOpts) {
      const dest =
        opt.destinationId
          ? destinations.find((d) => d.id === opt.destinationId)?.label
          : labelForPhone(opt.phoneNumber, destinations);
      lines.push(`  ${opt.digit} — ${opt.label} → ${dest ?? "not set"}`);
    }
  }

  const ring = draft.nodes?.find((n) => n.type === "RING_GROUP");
  if (ring) {
    const label = String(ring.config.label ?? "Ring group");
    lines.push(
      `${label}: ${summarizeRingTarget(ring.config, destinations)} (${String(ring.config.mode ?? "sequential")})`,
    );
  }

  for (const n of draft.nodes ?? []) {
    if (n.type === "TRANSFER_EXTERNAL") {
      const label = String(n.config.label ?? n.name ?? "Transfer");
      const target = summarizeRingTarget(n.config, destinations);
      lines.push(`${label}: ${target}`);
    }
    if (n.type === "BUSINESS_HOURS") {
      lines.push("Business hours node configured");
    }
    if (n.type === "VOICEMAIL") {
      lines.push("Fallback: Business Voicemail");
    }
    if (n.type === "GATHER_DTMF" || n.type === "MENU") {
      const prompt = String(n.config.promptText ?? "").trim();
      if (prompt && !menuOpts.length) lines.push(`Prompt: ${prompt.slice(0, 80)}`);
    }
  }

  const meta = draft.metadata as Record<string, unknown> | undefined;
  if (meta?.temporaryRoutingRestore) {
    const t = meta.temporaryRoutingRestore as { expiresAt?: string };
    lines.push(`Temporary routing override until ${t.expiresAt ?? "unknown"}`);
  }

  return lines.length ? lines.join("\n") : "No routing configured yet.";
}

export function summarizeMenuOptionRoute(
  draft: DraftConfig,
  menuLabel: string,
  destinations: AiRoutingContextDestination[] = [],
): string | null {
  const opt = (draft.menuOptions ?? []).find(
    (o) => o.label.toLowerCase() === menuLabel.toLowerCase(),
  );
  if (!opt) return null;
  const edge = (draft.edges ?? []).find(
    (e) =>
      e.conditionType === "digit" &&
      e.conditionValue === opt.digit &&
      (draft.nodes ?? []).some((n) => n.id === e.fromNodeId && n.type === "MENU"),
  );
  if (!edge) {
    if (opt.phoneNumber || opt.destinationId) {
      return labelForPhone(opt.phoneNumber, destinations);
    }
    return null;
  }
  const target = (draft.nodes ?? []).find((n) => n.id === edge.toNodeId);
  if (!target) return null;
  if (target.type === "RING_GROUP" || target.type === "TRANSFER_EXTERNAL") {
    return summarizeRingTarget(target.config, destinations);
  }
  if (target.type === "VOICEMAIL") return "Business Voicemail";
  return target.type;
}

export function explainRoutingBehavior(
  draft: DraftConfig,
  destinations: AiRoutingContextDestination[] = [],
  question?: string,
): string {
  const q = (question ?? "").toLowerCase();
  if (q.includes("after 6") || q.includes("after hours") || q.includes("after hour")) {
    const closedMenu = (draft.nodes ?? []).find(
      (n) =>
        n.type === "MENU" &&
        String(n.config.promptText ?? "").toLowerCase().includes("closed"),
    );
    if (closedMenu) {
      return `After hours, callers hear your after-hours greeting. ${summarizeDraftConfig(
        { ...draft, menuOptions: draft.menuOptions },
        destinations,
      )}`;
    }
    const vm = (draft.nodes ?? []).some((n) => n.type === "VOICEMAIL");
    if (vm) return "After hours, calls go to Business Voicemail.";
  }
  if (q.includes("service")) {
    const route = summarizeMenuOptionRoute(draft, "Service", destinations);
    if (route) return `Service calls: ${route}`;
  }
  if (q.includes("sales")) {
    const route = summarizeMenuOptionRoute(draft, "Sales", destinations);
    if (route) return `Sales calls: ${route}`;
  }
  if (q.includes("billing")) {
    const route = summarizeMenuOptionRoute(draft, "Billing", destinations);
    if (route) return `Billing calls: ${route}`;
  }
  if (q.includes("callback") && q.includes("mike")) {
    return "Employees use the Business Callback Number (not the public Routing Number), authenticate with phone + PIN, then choose latest missed caller or enter a number. Customers see your verified business caller ID.";
  }
  return summarizeDraftConfig(draft, destinations);
}
