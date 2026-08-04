import type { AutomationDefinition } from "@/lib/automations/types";
import {
  MCTB_NODES,
  type MissedCallTextBackConfig,
} from "@/lib/solutions/missed-call-text-back/types";

function waitConfig(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return { days: 0, hours, minutes: rem, weeks: 0, respectBusinessHours: false };
}

/** Build the canonical Missed Call Text Back AutomationFlow graph. */
export function buildMissedCallTextBackDefinition(
  config: MissedCallTextBackConfig,
): AutomationDefinition {
  const N = MCTB_NODES;
  const nodes: AutomationDefinition["nodes"] = [
    {
      id: N.TRIGGER,
      type: "trigger",
      position: { x: 80, y: 120 },
      data: {
        blockType: "call_missed",
        label: "Missed call",
        config: {},
      },
    },
    {
      id: N.WAIT_INITIAL,
      type: "logic",
      position: { x: 320, y: 120 },
      data: {
        blockType: "wait",
        label: "Wait before texting",
        config: waitConfig(config.initialDelayMinutes),
      },
    },
    {
      id: N.SEND_INITIAL_SMS,
      type: "action",
      position: { x: 560, y: 120 },
      data: {
        blockType: "send_sms",
        label: "Send first SMS",
        config: {
          body: config.firstMessage,
          stopOnReply: config.stopOnReply,
          phoneNumberId: config.phoneNumberId || "",
        },
      },
    },
    {
      id: N.WAIT_FOR_REPLY,
      type: "logic",
      position: { x: 800, y: 120 },
      data: {
        blockType: "wait",
        label: "Wait for reply",
        config: waitConfig(config.replyWindowMinutes),
      },
    },
    {
      id: N.CONDITION_REPLY,
      type: "logic",
      position: { x: 1040, y: 120 },
      data: {
        blockType: "condition_has_responded",
        label: "Reply received?",
        config: {
          field: "customer_replied",
          operator: "equals",
          value: "true",
        },
      },
    },
    {
      id: N.END_REPLIED,
      type: "end",
      position: { x: 1280, y: 40 },
      data: {
        blockType: "end_automation",
        label: "End — replied",
        config: {},
      },
    },
    {
      id: N.END_DONE,
      type: "end",
      position: { x: 1760, y: 200 },
      data: {
        blockType: "end_automation",
        label: "End",
        config: {},
      },
    },
  ];

  const edges: AutomationDefinition["edges"] = [
    { id: "e_trigger_wait", source: N.TRIGGER, target: N.WAIT_INITIAL },
    { id: "e_wait_send", source: N.WAIT_INITIAL, target: N.SEND_INITIAL_SMS },
    { id: "e_send_wait_reply", source: N.SEND_INITIAL_SMS, target: N.WAIT_FOR_REPLY },
    { id: "e_wait_cond", source: N.WAIT_FOR_REPLY, target: N.CONDITION_REPLY },
    {
      id: "e_cond_yes",
      source: N.CONDITION_REPLY,
      target: N.END_REPLIED,
      sourceHandle: "yes",
    },
  ];

  if (config.followUpEnabled) {
    nodes.splice(
      nodes.length - 1,
      0,
      {
        id: N.WAIT_FOLLOW_UP,
        type: "logic",
        position: { x: 1280, y: 200 },
        data: {
          blockType: "wait",
          label: "Wait before follow-up",
          config: waitConfig(config.followUpDelayMinutes),
        },
      },
      {
        id: N.SEND_FOLLOW_UP_SMS,
        type: "action",
        position: { x: 1520, y: 200 },
        data: {
          blockType: "send_sms",
          label: "Send follow-up SMS",
          config: {
            body: config.followUpMessage,
            stopOnReply: config.stopOnReply,
            phoneNumberId: config.phoneNumberId || "",
          },
        },
      },
    );
    edges.push(
      {
        id: "e_cond_no",
        source: N.CONDITION_REPLY,
        target: N.WAIT_FOLLOW_UP,
        sourceHandle: "no",
      },
      {
        id: "e_follow_wait_send",
        source: N.WAIT_FOLLOW_UP,
        target: N.SEND_FOLLOW_UP_SMS,
      },
      {
        id: "e_follow_end",
        source: N.SEND_FOLLOW_UP_SMS,
        target: N.END_DONE,
      },
    );
  } else {
    edges.push({
      id: "e_cond_no",
      source: N.CONDITION_REPLY,
      target: N.END_DONE,
      sourceHandle: "no",
    });
  }

  return {
    version: 1,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
}

/** Semantic node IDs the wizard owns. */
export const WIZARD_OWNED_NODE_IDS = new Set<string>(Object.values(MCTB_NODES));
