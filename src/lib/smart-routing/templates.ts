import type { DraftConfig, SmartRoutingFlowType } from "./types";

type TemplateDef = {
  type: SmartRoutingFlowType;
  title: string;
  subtitle: string;
  bestFor: string[];
  draftConfig: DraftConfig;
};

function node(
  id: string,
  type: DraftConfig["nodes"][0]["type"],
  config: Record<string, unknown> = {},
): DraftConfig["nodes"][0] {
  return { id, type, config };
}

function edge(
  from: string,
  to: string,
  conditionType = "always",
  conditionValue?: string,
): DraftConfig["edges"][0] {
  return {
    id: `${from}_${conditionType}_${conditionValue ?? "next"}_${to}`,
    fromNodeId: from,
    toNodeId: to,
    conditionType,
    conditionValue,
  };
}

export const SMART_ROUTING_TEMPLATES: TemplateDef[] = [
  {
    type: "phone_menu",
    title: "Phone Menu",
    subtitle: "Press 1 for New Service · Press 2 for Appointments · Press 3 for Billing",
    bestFor: ["departments", "multiple employees", "call routing"],
    draftConfig: {
      greeting: { source: "elevenlabs", text: "Thanks for calling. Please listen to the options." },
      menuOptions: [
        { digit: "1", label: "New Service", action: "transfer", phoneNumber: "" },
        { digit: "2", label: "Existing Appointment", action: "transfer", phoneNumber: "" },
        { digit: "3", label: "Billing", action: "transfer", phoneNumber: "" },
      ],
      nodes: [
        node("entry", "ENTRY"),
        node("menu", "MENU", { promptText: "Thanks for calling. Please listen to the options." }),
        node("opt1", "TRANSFER_EXTERNAL", { label: "New Service" }),
        node("opt2", "TRANSFER_EXTERNAL", { label: "Existing Appointment" }),
        node("opt3", "TRANSFER_EXTERNAL", { label: "Billing" }),
        node("vm", "VOICEMAIL"),
        node("hangup", "HANGUP"),
      ],
      edges: [
        edge("entry", "menu"),
        edge("menu", "opt1", "digit", "1"),
        edge("menu", "opt2", "digit", "2"),
        edge("menu", "opt3", "digit", "3"),
        edge("menu", "vm", "timeout"),
        edge("opt1", "vm", "no_answer"),
        edge("opt2", "vm", "no_answer"),
        edge("opt3", "vm", "no_answer"),
        edge("vm", "hangup"),
      ],
    },
  },
  {
    type: "missed_call_recovery",
    title: "Missed Call Recovery",
    subtitle: "Sorry we missed your call. Press 1 and we'll text you now.",
    bestFor: ["Missed Call Text Back", "A2P SMS consent", "after-hours recovery"],
    draftConfig: {
      greeting: {
        source: "elevenlabs",
        text: "Sorry we missed your call. If you'd like us to text you now, press 1.",
      },
      nodes: [
        node("entry", "ENTRY"),
        node("consent", "SMS_CONSENT", {
          consentDigit: "1",
          promptText: "Sorry we missed your call. If you'd like us to text you now, press 1.",
        }),
        node("confirm", "PLAY_CONFIRMATION", {
          text: "Perfect. Check your phone. We've just sent you a message.",
        }),
        node("hangup", "HANGUP"),
      ],
      edges: [
        edge("entry", "consent"),
        edge("consent", "confirm", "digit", "1"),
        edge("confirm", "hangup"),
      ],
    },
  },
  {
    type: "call_gate",
    title: "Call Gate",
    subtitle: "Press 1 to continue — reduce robocalls before ringing your team",
    bestFor: ["robocall reduction", "simple screening", "front-door gate"],
    draftConfig: {
      greeting: {
        source: "elevenlabs",
        text: "Thanks for calling. Press 1 to continue.",
      },
      menuOptions: [{ digit: "1", label: "Continue", action: "transfer", phoneNumber: "" }],
      nodes: [
        node("entry", "ENTRY"),
        node("gate", "GATHER_DTMF", {
          promptText: "Thanks for calling. Press 1 to continue.",
          validDigits: "1",
        }),
        node("route", "TRANSFER_EXTERNAL", { label: "Main line" }),
        node("vm", "VOICEMAIL"),
        node("hangup", "HANGUP"),
      ],
      edges: [
        edge("entry", "gate"),
        edge("gate", "route", "digit", "1"),
        edge("gate", "gate", "invalid"),
        edge("gate", "vm", "timeout"),
        edge("route", "vm", "no_answer"),
        edge("vm", "hangup"),
      ],
    },
  },
  {
    type: "after_hours",
    title: "After-Hours Routing",
    subtitle: "For emergency service, press 1. Otherwise, leave us a message.",
    bestFor: ["night coverage", "weekends", "holiday routing"],
    draftConfig: {
      nodes: [
        node("entry", "ENTRY"),
        node("hours", "BUSINESS_HOURS"),
        node("open_menu", "MENU", { promptText: "Thanks for calling." }),
        node("closed_menu", "MENU", {
          promptText: "We are currently closed. For emergency service, press 1. Otherwise leave a message.",
        }),
        node("emergency", "TRANSFER_EXTERNAL", { label: "Emergency" }),
        node("vm", "VOICEMAIL"),
        node("hangup", "HANGUP"),
      ],
      edges: [
        edge("entry", "hours"),
        edge("hours", "open_menu", "open"),
        edge("hours", "closed_menu", "closed"),
        edge("closed_menu", "emergency", "digit", "1"),
        edge("closed_menu", "vm", "timeout"),
        edge("emergency", "vm", "no_answer"),
        edge("vm", "hangup"),
      ],
    },
  },
  {
    type: "department",
    title: "Department Routing",
    subtitle: "Sales · Service · Billing · Appointments",
    bestFor: ["teams", "departments", "multi-location"],
    draftConfig: {
      menuOptions: [
        { digit: "1", label: "Sales", action: "transfer" },
        { digit: "2", label: "Service", action: "transfer" },
        { digit: "3", label: "Billing", action: "transfer" },
        { digit: "4", label: "Appointments", action: "transfer" },
      ],
      nodes: [
        node("entry", "ENTRY"),
        node("menu", "MENU"),
        node("sales", "TRANSFER_EXTERNAL", { label: "Sales" }),
        node("service", "TRANSFER_EXTERNAL", { label: "Service" }),
        node("billing", "TRANSFER_EXTERNAL", { label: "Billing" }),
        node("appts", "TRANSFER_EXTERNAL", { label: "Appointments" }),
        node("vm", "VOICEMAIL"),
        node("hangup", "HANGUP"),
      ],
      edges: [
        edge("entry", "menu"),
        edge("menu", "sales", "digit", "1"),
        edge("menu", "service", "digit", "2"),
        edge("menu", "billing", "digit", "3"),
        edge("menu", "appts", "digit", "4"),
        edge("menu", "vm", "timeout"),
        edge("sales", "vm", "no_answer"),
        edge("service", "vm", "no_answer"),
        edge("billing", "vm", "no_answer"),
        edge("appts", "vm", "no_answer"),
        edge("vm", "hangup"),
      ],
    },
  },
  {
    type: "custom",
    title: "Custom Call Flow",
    subtitle: "Start with a blank advanced flow.",
    bestFor: ["advanced routing", "custom logic"],
    draftConfig: {
      nodes: [node("entry", "ENTRY"), node("hangup", "HANGUP")],
      edges: [edge("entry", "hangup")],
    },
  },
];

export function templateForType(type: SmartRoutingFlowType) {
  return SMART_ROUTING_TEMPLATES.find((t) => t.type === type) ?? SMART_ROUTING_TEMPLATES[0];
}
