/**
 * Level B — real model + production prompt + canonical tool schemas + production tool webhooks.
 */
import { openAiChatWithTools, type OpenAiChatMessage } from "@/lib/voice/testing/openai-tool-chat";
import { invokeToolWebhook } from "@/lib/voice/testing/preprod-harness";
import { compileVoiceAgentPromptFromWizard } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { fixturePromptMetadata } from "./woodbridge-fixture";
import { openAiToolsForConversationWorkflow } from "./telnyx-tool-schemas";
import {
  getRecordingSmsOutbox,
  clearRecordingSmsOutbox,
} from "./recording-sms";
import type { HeadlessFixtureContext, HeadlessScenarioResult } from "./types";
import { emptyTurn, fail, formatHeadlessTrace } from "./trace";

const SUCCESS_CLAIM_RE =
  /\b(sent|texted|just sent|on its way|you('ll| will) receive)\b/i;

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { _parseError: raw };
  }
}

function mapToolNameToWebhook(toolName: string): string {
  return toolName.replace(/-/g, "_");
}

export async function runHeadlessScenario(input: {
  fixture: HeadlessFixtureContext;
  name: string;
  callerTurns: string[];
  expectSendResource?: boolean;
  forbidTools?: string[];
}): Promise<HeadlessScenarioResult> {
  const failures: HeadlessScenarioResult["failures"] = [];
  const turns: HeadlessScenarioResult["turns"] = [];
  const meta = fixturePromptMetadata(input.fixture.wizard);
  const systemPrompt = compileVoiceAgentPromptFromWizard(input.fixture.wizard);
  const tools = openAiToolsForConversationWorkflow();

  const messages: OpenAiChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  let sendResourceCount = 0;
  let claimedSuccessBeforeTool = false;
  const forbidden = new Set(input.forbidTools || []);

  clearRecordingSmsOutbox();

  for (let i = 0; i < input.callerTurns.length; i++) {
    const caller = input.callerTurns[i]!;
    const turnTrace = emptyTurn(i + 1, caller);
    turnTrace.promptVersion = meta.promptVersion;
    turnTrace.businessContextRevision = meta.businessContextRevision;

    messages.push({ role: "user", content: caller });

    const chat = await openAiChatWithTools({
      messages,
      tools,
      temperature: 0.35,
    });

    const msg = chat.message;
    if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls?.length) {
      messages.push(msg);

      for (const tc of msg.tool_calls) {
        const toolType = mapToolNameToWebhook(tc.function.name);
        const args = parseToolArgs(tc.function.arguments || "{}");

        if (forbidden.has(toolType)) {
          failures.push(fail("FORBIDDEN_TOOL_CALLED", toolType));
        }

        const started = Date.now();
        const webhook = await invokeToolWebhook({
          ctx: input.fixture,
          toolType,
          body: args,
          callControlId: input.fixture.callControlId,
          conversationId: input.fixture.conversationId,
          fromE164: input.fixture.callerE164,
        });
        const latencyMs = Date.now() - started;

        if (toolType === "send_resource") {
          sendResourceCount++;
        }

        turnTrace.toolRequests.push({
          toolType,
          arguments: args,
          webhookStatus: webhook.status,
          webhookJson: webhook.json,
          latencyMs,
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(webhook.json),
        });
      }

      const followUp = await openAiChatWithTools({
        messages,
        tools,
        temperature: 0.35,
      });
      const assistantText =
        followUp.message.role === "assistant" && typeof followUp.message.content === "string"
          ? followUp.message.content
          : "";
      turnTrace.assistantText = assistantText;
      if (assistantText) {
        messages.push({ role: "assistant", content: assistantText });
      }
    } else {
      const assistantText =
        msg.role === "assistant" && typeof msg.content === "string" ? msg.content : "";
      turnTrace.assistantText = assistantText;
      if (assistantText) {
        messages.push({ role: "assistant", content: assistantText });
      }
    }

    if (
      turnTrace.toolRequests.length === 0 &&
      turnTrace.assistantText &&
      SUCCESS_CLAIM_RE.test(turnTrace.assistantText)
    ) {
      claimedSuccessBeforeTool = true;
    }

    turnTrace.smsCountAfterTurn = getRecordingSmsOutbox().length;
    turns.push(turnTrace);
  }

  const totalSms = getRecordingSmsOutbox().length;

  if (input.expectSendResource) {
    if (sendResourceCount === 0) {
      failures.push(fail("EXPECTED_TOOL_NOT_CALLED", "send_resource"));
    } else if (sendResourceCount > 1) {
      failures.push(fail("ACTION_EXECUTED_TWICE", `send_resource x${sendResourceCount}`));
    }
    if (totalSms !== 1) {
      failures.push(
        fail("UNEXPECTED_SMS_COUNT", `expected 1 SMS, got ${totalSms} (tool calls=${sendResourceCount})`),
      );
    }
    const lastTool = turns.flatMap((t) => t.toolRequests).find((t) => t.toolType === "send_resource");
    if (lastTool && lastTool.webhookJson.ok === false) {
      failures.push(
        fail("TOOL_RESULT_NOT_SUCCESS", JSON.stringify(lastTool.webhookJson)),
      );
    }
  }

  if (claimedSuccessBeforeTool) {
    failures.push(
      fail("MODEL_CLAIMED_SUCCESS_BEFORE_TOOL_SUCCESS", "assistant claimed SMS before tool success"),
    );
  }

  const result: HeadlessScenarioResult = {
    name: input.name,
    passed: failures.length === 0,
    failures,
    turns,
    totalSms,
  };

  return result;
}

export async function runBookingLinkTwoTurnScenario(
  fixture: HeadlessFixtureContext,
): Promise<HeadlessScenarioResult> {
  let result = await runHeadlessScenario({
    fixture,
    name: "booking-link-two-turn",
    callerTurns: [
      "What do you guys do?",
      "Can you text me the booking link?",
      "Yes, you can text me. Message and data rates may apply.",
    ],
    expectSendResource: true,
    forbidTools: ["search_business_details"],
  });

  if (!result.passed && result.failures.some((f) => f.code === "EXPECTED_TOOL_NOT_CALLED")) {
    result = await runHeadlessScenario({
      fixture,
      name: "booking-link-two-turn-retry",
      callerTurns: [
        "What services do you offer?",
        "Yeah just text me the booking link please.",
        "Yes I consent to receive the text.",
      ],
      expectSendResource: true,
    });
  }

  return result;
}

export function printScenarioResult(result: HeadlessScenarioResult): void {
  console.log(formatHeadlessTrace(result));
}
