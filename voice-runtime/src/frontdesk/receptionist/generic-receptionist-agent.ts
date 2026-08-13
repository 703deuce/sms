import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { withHybridStreamingAgentOptions } from "../../hybrid-streaming-tts-node";
import type { FrontDeskUserData } from "../userdata";
import { buildReceptionistTools } from "./receptionist-tools";

function buildInstructions(snapshot: ReceptionistCompiledSnapshot, businessLabel: string): string {
  const caps = snapshot.capabilities.map((c) => c.replace(/_/g, " ")).join(", ");
  const fields =
    snapshot.fieldManifest.length
      ? `Collect: ${snapshot.fieldManifest.map((f) => f.label).join(", ")}.`
      : "";

  return [
    `You are ${snapshot.agentDisplayName}, the AI receptionist for ${businessLabel}. `,
    snapshot.businessDescription.trim(),
    " ",
    `Your capabilities: ${caps}. `,
    fields,
    " ",
    "Speak naturally — your output is synthesized to speech. Use brief fillers and reactions when appropriate. ",
    "Never speak internal planning aloud. If you promise to check the calendar, book, or transfer — call the matching tool in the same turn. ",
    snapshot.capabilities.includes("answer_questions")
      ? "Use get_business_answer for hours, services, pricing, and FAQs. "
      : "",
    snapshot.capabilities.includes("take_messages")
      ? "Use take_message when they want a callback instead of booking. "
      : "",
    snapshot.capabilities.includes("collect_info")
      ? "Use collect_caller_fields when you need caller details not yet captured. "
      : "",
    snapshot.capabilities.includes("book_appointments")
      ? "For booking: list_available_slots, then schedule_appointment after they confirm a time. "
      : "",
    snapshot.capabilities.includes("transfer_calls")
      ? "Use transfer_to_human only after the caller confirms they want a person. "
      : "",
    snapshot.capabilities.includes("send_text")
      ? "Use send_sms only after the caller agrees to receive a text. "
      : "",
    "When the caller is done, end the call once with a brief farewell.",
  ].join("");
}

export function createGenericReceptionistAgent(input: {
  snapshot: ReceptionistCompiledSnapshot;
  businessName: string;
  timezone: string;
}) {
  const label = input.businessName.trim() || input.snapshot.businessName || "our office";
  const instructions = buildInstructions(input.snapshot, label);

  const agent = voice.Agent.create<FrontDeskUserData>(
    withHybridStreamingAgentOptions({
      instructions,
      tools: llm.toToolContext(
        buildReceptionistTools({
          snapshot: input.snapshot,
          timezone: input.timezone,
        }).toolDefs as never,
      ),
      onEnter: async (agentCtx) => {
        const session = agentCtx.session as AgentSession<FrontDeskUserData>;
        const greeting = input.snapshot.greeting.trim();
        if (greeting) {
          await session.generateReply({
            instructions: `Say exactly this greeting to the caller (warm and natural): ${greeting}`,
            toolChoice: "none",
          });
          return;
        }
        await session.generateReply({
          instructions: `Welcome the caller to ${label}. Ask how you can help today. Keep it brief and warm.`,
          toolChoice: "none",
        });
      },
    }),
  );

  return agent;
}

