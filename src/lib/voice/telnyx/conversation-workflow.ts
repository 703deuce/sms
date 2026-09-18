/**
 * Telnyx Conversation Workflow graph for Amy receptionist (capability scopes).
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isAfterHoursVoiceProfile } from "@/lib/voice/runtime/voice-profile";
import { isVoiceCanonicalAiBookingPublishMode } from "@/lib/voice/workflow-engine/tool-publish";
import {
  isVoiceV2PstnLiveBookingMode,
  isVoiceV2PstnOneAmyMode,
  resolveVoiceV2BookingStrategy,
} from "@/lib/voice-receptionist-wizard/pstn-workflow-mode";
import { voiceV2StrategyAllowsFindBook } from "@/lib/voice-receptionist-wizard/booking-strategy";
import {
  expressionEdgeCondition,
  exprVarEqualsBool,
  exprVarEqualsString,
  llmEdgeCondition,
} from "./workflow-expression";
import { ONE_AMY_V2_WORKFLOW_APPEND } from "@/lib/voice-receptionist-wizard/one-amy/amy-core-static-prompt";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/runtime-isolation";

export const WORKFLOW_NODE_IDS = {
  GENERAL: "n_general",
  ACTION: "n_action",
  LIVE_BOOKING: "n_live_booking",
  DETAILED_LOOKUP: "n_detailed_lookup",
  HUMAN: "n_human",
  RECOVERY: "n_recovery",
  CLOSING: "n_closing",
} as const;

export type WorkflowSharedToolIds = {
  sendResource?: string | null;
  searchDetails?: string | null;
  voiceAiBooking?: string | null;
  voiceV2Find?: string | null;
  voiceV2Book?: string | null;
  voiceV2SaveIntake?: string | null;
  voiceV2FinalizeRequest?: string | null;
  voiceV2SendBookingLink?: string | null;
  voiceV2FindExisting?: string | null;
  voiceV2Reschedule?: string | null;
  voiceV2Cancel?: string | null;
  voiceV2SearchKnowledge?: string | null;
  hangup?: string | null;
  transfer?: string | null;
  retrieval?: string | null;
};

const ACTION_INSTRUCTIONS = [
  "The caller wants a live action — usually a texted resource link.",
  "Use send_resource once with the resource_type that matches what they asked for (booking, quote, financing, directions, photo_upload).",
  "Do not claim the text was sent until send_resource returns success.",
  "If they change subject to a general question, stop trying to send a link.",
].join(" ");

const AFTER_HOURS_ACTION_INSTRUCTIONS = [
  "The caller agreed to receive a text message with a link.",
  "Call send_resource exactly once with resource_type booking (or quote/financing/directions as appropriate). Include verbal_sms_consent true when the caller said yes to texting.",
  "If send_resource says consent is required, return to normal conversation and ask for permission to text — do not repeat the same sentence.",
  "Confirm the text only after send_resource returns success, then continue the call if they have more questions.",
].join(" ");

const AFTER_HOURS_GENERAL_APPEND = [
  "For scheduling or booking: explain you can text a booking link (not live calendar booking on this call).",
  "Gather any minimum details the business needs, then ask: \"Is it okay if I send that by text? Message and data rates may apply.\"",
  "Do not call send_resource until they clearly say yes to texting.",
  "Do not say you are saving a request or that the team will follow up unless SMS is declined or send_resource failed.",
  "Never repeat the same opening line twice — always advance the conversation.",
].join(" ");

const CANONICAL_BOOKING_GENERAL_APPEND = [
  "For scheduling: you can check the live Microsoft calendar and book on this call.",
  "When they want to schedule or ask what is open, move to Live Booking and use voice_ai_booking_turn.",
  "Only offer a text booking link if they refuse live scheduling or the calendar tool fails.",
  "Never repeat the same opening line twice — always advance the conversation.",
].join(" ");

const LIVE_BOOKING_INSTRUCTIONS = [
  "The caller wants to schedule, check availability, or confirm an appointment time on the live calendar.",
  "Call voice_ai_booking_turn with structured action fields (FIND_AVAILABILITY, BOOK_OFFERED_SLOT, etc.) — you interpret the caller; do not pass raw utterance for semantics.",
  "Use confirm_booking true only after they clearly agree to a specific offered time.",
  "Speak naturally from the tool response — never invent times or claim booked without tool success.",
  "If the tool suggests fallback, offer a booking link by text only with consent.",
].join(" ");

const V2_PSTN_GENERAL_APPEND = [
  "For scheduling: you CAN book on the live Microsoft calendar on this call.",
  "When the caller wants an appointment, move to Live Booking immediately — never say you do not have live booking on this call.",
  "Use voice_v2_save_intake_fields for caller details, then voice_v2_find_availability, then voice_v2_book_offered_slot.",
  "After-hours affects greeting and escalation only; it does not disable live V2 booking when this capability is enabled.",
  "Callback or text link is fallback only after a tool failure or if the caller declines live scheduling.",
].join(" ");

const V2_REQUEST_ONLY_GENERAL_APPEND = [
  "Appointment handling: take the caller's preferred day/time and details — do NOT check live calendar availability.",
  "Use voice_v2_save_intake_fields for configured fields and scheduling preferences.",
  "When enough information is collected, call voice_v2_finalize_caller_request.",
  "Never say the appointment is confirmed, booked, or that a time is available.",
  "Tell the caller the team will follow up to confirm.",
].join(" ");

const V2_SEND_LINK_GENERAL_APPEND = [
  "Appointment handling: text the business configured booking link when the caller wants to schedule.",
  "Use voice_v2_save_intake_fields for configured caller information.",
  "Offer to text the booking link; after SMS consent, call voice_v2_send_booking_link.",
  "Do NOT check live calendar availability, do NOT book on the call, and do NOT say the caller is booked or confirmed.",
  "Only say the link was sent after voice_v2_send_booking_link succeeds.",
].join(" ");

const V2_MESSAGE_ONLY_GENERAL_APPEND = [
  "Take a message or callback request — do not steer into live booking.",
  "Use voice_v2_save_intake_fields for configured caller information.",
  "When ready, call voice_v2_finalize_caller_request to send the message to the business.",
].join(" ");

const LIVE_BOOKING_V2_INSTRUCTIONS = [
  "Live Voice V2 booking on this call.",
  "Save intake with voice_v2_save_intake_fields when the caller provides configured fields.",
  "After every save, obey voice_v2_next_stage and booking_continue_required from the tool JSON — runtime authority, not your guess.",
  "When booking_continue_required is true: NEVER close with callback, follow-up only, or message-taking; continue live booking.",
  "When voice_v2_next_stage is COLLECT_SCHEDULING_PREFERENCE: ask what day works (natural wording); do not call FIND without a date.",
  "When voice_v2_next_stage is FIND_AVAILABILITY: call voice_v2_find_availability with requested_date and time_window.",
  "When they pick a slot, call voice_v2_book_offered_slot with offer_set_id and selected_slot_id only.",
  "Only confirm booked after BOOKING_CONFIRMED. Never call voice_ai_booking_turn.",
].join(" ");

const DETAILED_LOOKUP_INSTRUCTIONS = [
  "The caller needs detailed or long-tail business/product information not covered in the base prompt.",
  "Use search_business_details with their question.",
  "Answer concisely in spoken language. Do not read URLs.",
].join(" ");

const HUMAN_INSTRUCTIONS = [
  "The caller wants a person. Use the Transfer tool to connect them.",
  "If transfer is unavailable, apologize and offer to take their information for a callback.",
  "Do not claim you connected them until transfer succeeds.",
].join(" ");

const RECOVERY_INSTRUCTIONS = [
  "A requested action could not be completed (link unavailable, SMS failed, or transfer unavailable).",
  "Apologize briefly. Use information already given in this call — do not re-ask for name, phone, address, or issue if the caller already provided them.",
  "Confirm you have their details and that the team will follow up; only ask for a missing field if truly unknown.",
  "Do not call tools unless the caller explicitly asks for a different action you can complete.",
].join(" ");

const CLOSING_INSTRUCTIONS = [
  "The caller is done. Thank them warmly and use hangup when the conversation is fully finished.",
].join(" ");

const VOICE_V3_PSTN_GENERAL_APPEND = [
  "Microsoft calendar booking on this call is handled by the Transovo Voice V3 backend (OpenAI Live + deterministic runtime) — not Telnyx assistant tools.",
  "Never call voice_v2_find_availability, voice_v2_book_offered_slot, voice_ai_booking_turn, calendar_availability, continue_workflow, or record_current_field for scheduling.",
  "Collect information conversationally; FIND, slot offers, selection, revalidation, and BOOK run asynchronously after semantic meaning is applied.",
  "Never say the caller is booked, confirmed, or scheduled until backend confirmation context states Microsoft confirmed the appointment.",
  "While scheduling runs, you may acknowledge naturally without claiming success.",
].join(" ");

function wizardFromConfig(config?: VoiceAgentConfig | null) {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.appointmentReceptionistWizard as
    | import("@/lib/solutions/appointment-receptionist/types").AppointmentReceptionistWizardState
    | undefined;
}

export function buildAmyConversationWorkflow(
  toolIds: WorkflowSharedToolIds,
  config?: VoiceAgentConfig | null,
): Record<string, unknown> {
  const wizard = wizardFromConfig(config);
  const voiceV3Pstn = config ? isAppointmentReceptionistAgent(config) : false;
  const afterHours = wizard ? isAfterHoursVoiceProfile(wizard) : false;
  const canonicalBooking = voiceV3Pstn ? false : isVoiceCanonicalAiBookingPublishMode(config);
  const bookingStrategy = resolveVoiceV2BookingStrategy(config);
  const v2PstnLiveBooking = voiceV3Pstn ? false : isVoiceV2PstnLiveBookingMode(config);
  const v2OneAmy = voiceV3Pstn ? false : isVoiceV2PstnOneAmyMode(config);
  const v2LiveToolsReady = Boolean(
    toolIds.voiceV2Find && toolIds.voiceV2Book && toolIds.voiceV2SaveIntake,
  );
  const v2IntakeToolsReady = Boolean(
    toolIds.voiceV2SaveIntake &&
      (toolIds.voiceV2FinalizeRequest || toolIds.voiceV2SendBookingLink),
  );
  const liveBookingPath = v2PstnLiveBooking && v2LiveToolsReady;
  const oneAmyV2 = v2OneAmy && (v2IntakeToolsReady || liveBookingPath);
  const modeAppend =
    bookingStrategy === "MICROSOFT_365" || bookingStrategy === "CALENDLY"
      ? V2_PSTN_GENERAL_APPEND
      : bookingStrategy === "REQUEST_ONLY"
        ? V2_REQUEST_ONLY_GENERAL_APPEND
        : bookingStrategy === "SEND_LINK"
          ? V2_SEND_LINK_GENERAL_APPEND
          : bookingStrategy === "NONE"
            ? V2_MESSAGE_ONLY_GENERAL_APPEND
            : "";
  const generalInstructions = voiceV3Pstn
    ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${VOICE_V3_PSTN_GENERAL_APPEND}`
    : oneAmyV2
    ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${modeAppend} ${ONE_AMY_V2_WORKFLOW_APPEND}`
    : liveBookingPath
    ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${V2_PSTN_GENERAL_APPEND}`
    : canonicalBooking
      ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${CANONICAL_BOOKING_GENERAL_APPEND}`
      : afterHours
        ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${AFTER_HOURS_GENERAL_APPEND}`
        : "Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs.";
  const actionInstructions = afterHours ? AFTER_HOURS_ACTION_INSTRUCTIONS : ACTION_INSTRUCTIONS;
  const actionEdgeLlm = afterHours
    ? "The caller clearly agreed to receive a text message with a booking, quote, financing, or directions link (yes to SMS)."
    : "The caller wants to schedule, book, get a quote, receive financing information, directions, or asks to be texted a link.";
  const liveBookingEdgeLlm =
    "The caller wants to schedule an appointment, check availability, pick a time, or continue booking on the live calendar (not merely asking for a link by text).";

  const completionToolId =
    bookingStrategy === "SEND_LINK"
      ? toolIds.voiceV2SendBookingLink
      : toolIds.voiceV2FinalizeRequest;
  const v2ToolIds = [
    toolIds.voiceV2SaveIntake,
    completionToolId,
    toolIds.voiceV2SearchKnowledge,
    ...(voiceV2StrategyAllowsFindBook(bookingStrategy)
      ? [
          toolIds.voiceV2Find,
          toolIds.voiceV2Book,
          toolIds.voiceV2FindExisting,
          toolIds.voiceV2Reschedule,
          toolIds.voiceV2Cancel,
        ]
      : []),
  ].filter(Boolean) as string[];

  const nodes: Record<string, unknown>[] = [
    {
      id: WORKFLOW_NODE_IDS.GENERAL,
      name: "General",
      type: "prompt",
      instructions_mode: "append",
      instructions: generalInstructions,
      shared_tool_ids: oneAmyV2 ? v2ToolIds : [],
      tools_mode: "replace",
      position: { x: 80, y: 80 },
    },
    {
      id: WORKFLOW_NODE_IDS.ACTION,
      name: "Send Resource",
      type: "prompt",
      instructions_mode: "append",
      instructions: actionInstructions,
      shared_tool_ids: toolIds.sendResource ? [toolIds.sendResource] : [],
      tools_mode: "replace",
      position: { x: 360, y: 40 },
    },
    ...(liveBookingPath && !oneAmyV2
      ? [
          {
            id: WORKFLOW_NODE_IDS.LIVE_BOOKING,
            name: "Live Booking",
            type: "prompt",
            instructions_mode: "append",
            instructions: LIVE_BOOKING_V2_INSTRUCTIONS,
            shared_tool_ids: v2ToolIds,
            tools_mode: "replace",
            position: { x: 360, y: 120 },
          },
        ]
      : canonicalBooking && toolIds.voiceAiBooking
        ? [
            {
              id: WORKFLOW_NODE_IDS.LIVE_BOOKING,
              name: "Live Booking",
              type: "prompt",
              instructions_mode: "append",
              instructions: LIVE_BOOKING_INSTRUCTIONS,
              shared_tool_ids: [toolIds.voiceAiBooking],
              tools_mode: "replace",
              position: { x: 360, y: 120 },
            },
          ]
        : []),
    {
      id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP,
      name: "Detailed Lookup",
      type: "prompt",
      instructions_mode: "append",
      instructions: DETAILED_LOOKUP_INSTRUCTIONS,
      shared_tool_ids: [
        ...(toolIds.searchDetails ? [toolIds.searchDetails] : []),
        ...(toolIds.retrieval ? [toolIds.retrieval] : []),
      ].filter(Boolean),
      tools_mode: "replace",
      position: { x: 360, y: 200 },
    },
    {
      id: WORKFLOW_NODE_IDS.HUMAN,
      name: "Human Transfer",
      type: "prompt",
      instructions_mode: "append",
      instructions: HUMAN_INSTRUCTIONS,
      shared_tool_ids: toolIds.transfer ? [toolIds.transfer] : [],
      tools_mode: "replace",
      position: { x: 360, y: 360 },
    },
    {
      id: WORKFLOW_NODE_IDS.RECOVERY,
      name: "Recovery",
      type: "prompt",
      instructions_mode: "append",
      instructions: RECOVERY_INSTRUCTIONS,
      shared_tool_ids: [],
      tools_mode: "replace",
      position: { x: 640, y: 200 },
    },
    {
      id: WORKFLOW_NODE_IDS.CLOSING,
      name: "Closing",
      type: "prompt",
      instructions_mode: "append",
      instructions: CLOSING_INSTRUCTIONS,
      shared_tool_ids: toolIds.hangup ? [toolIds.hangup] : [],
      tools_mode: "replace",
      position: { x: 640, y: 360 },
    },
  ];

  const edges: Record<string, unknown>[] = [
    ...((!oneAmyV2 && (liveBookingPath || (canonicalBooking && toolIds.voiceAiBooking)))
      ? [
          {
            id: "e_general_live_booking",
            start_node_id: WORKFLOW_NODE_IDS.GENERAL,
            target: { type: "node", node_id: WORKFLOW_NODE_IDS.LIVE_BOOKING },
            condition: llmEdgeCondition(liveBookingEdgeLlm),
          },
          {
            id: "e_live_booking_general",
            start_node_id: WORKFLOW_NODE_IDS.LIVE_BOOKING,
            target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
            condition: llmEdgeCondition(
              "The scheduling step is done for now, the caller changed subject, or they only have a general business question.",
            ),
          },
        ]
      : []),
    {
      id: "e_general_action",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.ACTION },
      condition: llmEdgeCondition(
        canonicalBooking
          ? "The caller wants a quote, financing, directions, or other resource sent by text (not live calendar scheduling)."
          : actionEdgeLlm,
      ),
    },
    {
      id: "e_general_lookup",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP },
      condition: llmEdgeCondition(
        "The caller asks for specific detailed technical, product, warranty, or document-based information not answered by basic company overview.",
      ),
    },
    {
      id: "e_general_human",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.HUMAN },
      condition: llmEdgeCondition("The caller wants to speak with a person, agent, or human."),
    },
    {
      id: "e_general_closing",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.CLOSING },
      condition: llmEdgeCondition("The caller is clearly saying goodbye and ending the call."),
    },
    {
      id: "e_action_general",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition(
        "The caller changed subject to a general business question not about sending a link.",
      ),
    },
    {
      id: "e_action_recovery_not_configured",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "not_configured"),
      ),
    },
    {
      id: "e_action_recovery_failed",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "temporarily_unavailable"),
      ),
    },
    {
      id: "e_action_general_consent",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "consent_required"),
      ),
    },
    {
      id: "e_lookup_general",
      start_node_id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition("The detailed question has been answered or the caller moved on."),
    },
    {
      id: "e_human_recovery",
      start_node_id: WORKFLOW_NODE_IDS.HUMAN,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(exprVarEqualsBool("transfer_available", false)),
    },
    {
      id: "e_recovery_general",
      start_node_id: WORKFLOW_NODE_IDS.RECOVERY,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition("The caller has a new general question or changed subject."),
    },
    {
      id: "e_recovery_closing",
      start_node_id: WORKFLOW_NODE_IDS.RECOVERY,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.CLOSING },
      condition: llmEdgeCondition("The caller is done and ready to end the call."),
    },
  ];

  return {
    start_node_id: WORKFLOW_NODE_IDS.GENERAL,
    nodes,
    edges,
  };
}

export function workflowNodeExpectedTools(
  nodeId: string,
  toolIds: WorkflowSharedToolIds,
): string[] {
  switch (nodeId) {
    case WORKFLOW_NODE_IDS.GENERAL:
      if (toolIds.voiceV2SaveIntake && toolIds.voiceV2SendBookingLink) {
        const names = ["voice_v2_save_intake_fields", "voice_v2_send_booking_link"];
        if (toolIds.voiceV2SearchKnowledge) names.push("voice_v2_search_knowledge");
        return names;
      }
      if (toolIds.voiceV2SaveIntake && toolIds.voiceV2FinalizeRequest) {
        const names = ["voice_v2_save_intake_fields", "voice_v2_finalize_caller_request"];
        if (toolIds.voiceV2Find && toolIds.voiceV2Book) {
          names.push("voice_v2_find_availability", "voice_v2_book_offered_slot");
        }
        if (toolIds.voiceV2SearchKnowledge) {
          names.push("voice_v2_search_knowledge");
        }
        return names;
      }
      return [];
    // Legacy canonical booking only — V2 PSTN uses one-Amy tools on GENERAL.
    case WORKFLOW_NODE_IDS.RECOVERY:
      return [];
    case WORKFLOW_NODE_IDS.ACTION:
      return toolIds.sendResource ? ["send_resource"] : [];
    case WORKFLOW_NODE_IDS.LIVE_BOOKING:
      if (toolIds.voiceV2Find && toolIds.voiceV2Book) {
        return [
          ...(toolIds.voiceV2SaveIntake ? ["voice_v2_save_intake_fields"] : []),
          "voice_v2_find_availability",
          "voice_v2_book_offered_slot",
        ];
      }
      return toolIds.voiceAiBooking ? ["voice_ai_booking_turn"] : [];
    case WORKFLOW_NODE_IDS.DETAILED_LOOKUP:
      return [
        ...(toolIds.searchDetails ? ["search_business_details"] : []),
        ...(toolIds.retrieval ? ["retrieval"] : []),
      ];
    case WORKFLOW_NODE_IDS.HUMAN:
      return toolIds.transfer ? ["transfer"] : [];
    case WORKFLOW_NODE_IDS.CLOSING:
      return toolIds.hangup ? ["hangup"] : [];
    default:
      return [];
  }
}
