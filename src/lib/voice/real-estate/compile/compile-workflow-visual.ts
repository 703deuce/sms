import {
  createEdgeId,
  createNodeId,
  type AutomationDefinition,
} from "@/lib/automations/types";
import type { RealEstateIntent } from "../types";
import type { CompiledRealEstateFrontDesk, CompiledRealEstateSpeedToLead } from "./types";

const INTENT_FLOW_LABELS: Record<RealEstateIntent, string> = {
  buyer: "Buyer qualification",
  seller: "Seller qualification",
  showing: "Showing flow",
  existing_client: "Existing client",
  agent_to_agent: "Agent-to-agent",
  general: "General front desk",
};

function outcomeNodeLabel(outcome: string): string {
  switch (outcome) {
    case "book":
      return "Book appointment";
    case "transfer":
      return "Transfer";
    case "notify":
      return "Notify realtor";
    case "message":
      return "Take message";
    default:
      return "Complete";
  }
}

/** Build a visual workflow graph from compiled front desk config — reflects enabled intents only. */
export function buildFrontDeskWorkflowDefinition(
  compiled: Pick<CompiledRealEstateFrontDesk, "intents" | "booking" | "identity">,
): AutomationDefinition {
  const nodes: AutomationDefinition["nodes"] = [];
  const edges: AutomationDefinition["edges"] = [];

  const inboundId = createNodeId();
  const classifyId = createNodeId();
  const endId = createNodeId();

  nodes.push(
    {
      id: inboundId,
      type: "trigger",
      position: { x: 280, y: 40 },
      data: {
        blockType: "inbound_call",
        label: "Inbound call",
        config: {},
        origin: "template_managed",
        templateNodeKey: "inbound_call",
      },
    },
    {
      id: classifyId,
      type: "logic",
      position: { x: 280, y: 160 },
      data: {
        blockType: "voice_intent_router",
        label: "Identify caller / intent",
        config: { multiIntent: true },
        origin: "template_managed",
        templateNodeKey: "intent_router",
      },
    },
  );

  const enabledIntents = (Object.entries(compiled.intents) as [RealEstateIntent, { enabled: boolean }][])
    .filter(([, cfg]) => cfg.enabled)
    .map(([intent]) => intent);

  let y = 300;
  const outcomeIds: string[] = [];

  for (const intent of enabledIntents) {
    const intentCfg = compiled.intents[intent];
    const intentNodeId = createNodeId();
    const outcomeId = createNodeId();

    nodes.push({
      id: intentNodeId,
      type: "action",
      position: { x: 80 + enabledIntents.indexOf(intent) * 180, y },
      data: {
        blockType: "voice_intent_flow",
        label: INTENT_FLOW_LABELS[intent],
        config: {
          intent,
          fieldCount: intentCfg.fields.length,
          qualifiedOutcome: intentCfg.qualifiedOutcome,
        },
        origin: "template_managed",
        templateNodeKey: `intent_${intent}`,
      },
    });

    const outcomeLabel =
      intentCfg.qualifiedOutcome === "book" && !compiled.booking.enabled
        ? "Notify realtor"
        : outcomeNodeLabel(intentCfg.qualifiedOutcome);

    nodes.push({
      id: outcomeId,
      type: "action",
      position: { x: 80 + enabledIntents.indexOf(intent) * 180, y: y + 120 },
      data: {
        blockType: "voice_outcome",
        label: outcomeLabel,
        config: { outcome: intentCfg.qualifiedOutcome },
        origin: "template_managed",
        templateNodeKey: `outcome_${intent}`,
      },
    });

    edges.push(
      { id: createEdgeId(), source: classifyId, target: intentNodeId, sourceHandle: intent },
      { id: createEdgeId(), source: intentNodeId, target: outcomeId },
    );
    outcomeIds.push(outcomeId);
  }

  if (compiled.booking.enabled) {
    const bookId = createNodeId();
    nodes.push({
      id: bookId,
      type: "action",
      position: { x: 280, y: y + 280 },
      data: {
        blockType: "book_appointment",
        label: "Book appointment",
        config: { appointmentTypes: compiled.booking.appointmentTypes },
        origin: "template_managed",
        templateNodeKey: "booking",
      },
    });
    for (const outcomeId of outcomeIds) {
      edges.push({ id: createEdgeId(), source: outcomeId, target: bookId, sourceHandle: "book" });
    }
    edges.push({ id: createEdgeId(), source: bookId, target: endId });
  }

  nodes.push({
    id: endId,
    type: "end",
    position: { x: 280, y: y + 420 },
    data: {
      blockType: "end",
      label: "End call",
      config: {},
      origin: "system_required",
      templateNodeKey: "end",
    },
  });

  edges.push({ id: createEdgeId(), source: inboundId, target: classifyId });

  for (const outcomeId of outcomeIds) {
    if (!compiled.booking.enabled) {
      edges.push({ id: createEdgeId(), source: outcomeId, target: endId });
    }
  }

  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 0.85 },
    nodes,
    edges,
  };
}

/** Speed-to-Lead follow-up automation visualization from compiled config. */
export function buildSpeedToLeadWorkflowDefinition(
  compiled: Pick<CompiledRealEstateSpeedToLead, "calling" | "followUp" | "identity">,
  agentId: string,
): AutomationDefinition {
  const triggerId = createNodeId();
  const callId = createNodeId();
  const outcomeId = createNodeId();
  const endId = createNodeId();

  const nodes: AutomationDefinition["nodes"] = [
    {
      id: triggerId,
      type: "trigger",
      position: { x: 260, y: 40 },
      data: {
        blockType: "customer_added",
        label: "New lead",
        config: {},
        origin: "template_managed",
        templateNodeKey: "trigger",
      },
    },
    {
      id: callId,
      type: "action",
      position: { x: 260, y: 160 },
      data: {
        blockType: "start_ai_call",
        label: compiled.calling.callImmediately ? "Amy calls immediately" : "Amy calls (scheduled)",
        config: {
          agentId,
          agentInstanceReference: true,
          purpose: "Speed-to-Lead qualification",
          leadTypes: compiled.calling.leadTypes,
        },
        origin: "template_managed",
        templateNodeKey: "initial_call",
      },
    },
    {
      id: outcomeId,
      type: "logic",
      position: { x: 260, y: 300 },
      data: {
        blockType: "wait_for_call_result",
        label: "Call outcome",
        config: {
          outcomes: [
            "answered",
            "qualified",
            "appointment_booked",
            "no_answer",
            "voicemail",
            "not_interested",
            "opt_out",
            "wrong_number",
            "callback_scheduled",
            "needs_human",
            "failed",
          ],
        },
        origin: "template_managed",
        templateNodeKey: "call_outcome",
      },
    },
    {
      id: endId,
      type: "end",
      position: { x: 260, y: 440 },
      data: {
        blockType: "end",
        label: "Done",
        config: {},
        origin: "system_required",
        templateNodeKey: "end",
      },
    },
  ];

  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 0.9 },
    nodes,
    edges: [
      { id: createEdgeId(), source: triggerId, target: callId },
      { id: createEdgeId(), source: callId, target: outcomeId },
      { id: createEdgeId(), source: outcomeId, target: endId },
    ],
  };
}
