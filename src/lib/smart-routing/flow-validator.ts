import type {
  DraftConfig,
  FlowValidationIssue,
  FlowValidationResult,
  SmartRoutingNodeType,
} from "./types";
import { compileDraftConfig } from "./flow-compiler";

const TERMINATING: SmartRoutingNodeType[] = ["HANGUP", "VOICEMAIL", "AI_RECEPTIONIST"];

export function validateDraftConfig(
  draft: DraftConfig,
  options?: { requireAudio?: boolean; requireSmsApproval?: boolean },
): FlowValidationResult {
  const issues: FlowValidationIssue[] = [];
  const nodes = draft.nodes ?? [];
  const edges = draft.edges ?? [];

  if (nodes.length === 0) {
    issues.push({ code: "no_nodes", message: "Flow must contain at least one node." });
    return { valid: false, issues };
  }

  const entryNodes = nodes.filter((n) => n.type === "ENTRY");
  if (entryNodes.length !== 1) {
    issues.push({
      code: "entry_count",
      message: "Flow must have exactly one ENTRY node.",
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!nodeIds.has(e.fromNodeId) || !nodeIds.has(e.toNodeId)) {
      issues.push({
        code: "dangling_edge",
        message: "An edge references a missing node.",
        nodeId: e.fromNodeId,
      });
    }
  }

  const menuDigits = new Map<string, string>();
  for (const opt of draft.menuOptions ?? []) {
    if (menuDigits.has(opt.digit)) {
      issues.push({
        code: "duplicate_digit",
        message: `Duplicate menu digit ${opt.digit}.`,
      });
    }
    menuDigits.set(opt.digit, opt.label);
    if (opt.action === "transfer" && !opt.phoneNumber?.trim() && !opt.destinationId) {
      issues.push({
        code: "missing_destination",
        message: `Menu option ${opt.digit} needs a destination.`,
      });
    }
  }

  for (const n of nodes) {
    if (n.type === "TRANSFER_EXTERNAL") {
      const phone = String(n.config.phoneNumber ?? "").trim();
      const destId = String(n.config.destinationId ?? "").trim();
      if (!phone && !destId) {
        issues.push({
          code: "transfer_missing_target",
          message: "Transfer node needs a phone number or destination.",
          nodeId: n.id,
        });
      }
    }
    if (n.type === "AI_RECEPTIONIST" && !String(n.config.aiAgentId ?? "").trim()) {
      issues.push({
        code: "ai_missing_agent",
        message: "AI Receptionist node needs an agent.",
        nodeId: n.id,
      });
    }
    if ((n.type === "SMS_CONSENT" || n.type === "SEND_SMS") && options?.requireSmsApproval) {
      issues.push({
        code: "sms_not_approved",
        message: "Messaging is not approved for SMS nodes.",
        nodeId: n.id,
      });
    }
  }

  if (options?.requireAudio) {
    const hasAudio =
      Boolean(draft.greeting?.audioAssetId) ||
      Boolean(draft.greeting?.text?.trim()) ||
      nodes.some((n) => n.type === "MENU" && String(n.config.promptText ?? "").trim());
    if (!hasAudio) {
      issues.push({ code: "missing_audio", message: "Greeting or menu prompt is required." });
    }
  }

  // Reachability from entry
  try {
    const compiled = compileDraftConfig(draft);
    const reachable = new Set<string>();
    const stack = [compiled.entryNodeId];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const node = compiled.nodes[id];
      if (!node) continue;
      for (const target of Object.values(node.edges)) stack.push(target);
    }
    for (const n of nodes) {
      if (!reachable.has(n.id) && n.type !== "HANGUP") {
        issues.push({
          code: "unreachable",
          message: `Node "${n.name ?? n.id}" is not reachable from entry.`,
          nodeId: n.id,
        });
      }
    }
    const hasTerminal = nodes.some(
      (n) => reachable.has(n.id) && TERMINATING.includes(n.type),
    );
    if (!hasTerminal) {
      issues.push({
        code: "no_terminal",
        message: "Flow must include a terminating path (hangup, voicemail, or AI).",
      });
    }
  } catch (err) {
    issues.push({
      code: "compile_error",
      message: err instanceof Error ? err.message : "Failed to compile flow.",
    });
  }

  return { valid: issues.length === 0, issues };
}
