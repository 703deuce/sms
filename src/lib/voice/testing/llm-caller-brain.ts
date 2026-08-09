import { openAiChatCompletion, type OpenAiChatMessage } from "./openai-tool-chat";

const DEFAULT_CALLER_PERSONA = `You are Anthony Johnson, a homeowner calling to book a plumbing repair.
You have a toilet leak in your bathroom.
Your details when asked:
- Name: Anthony Johnson
- Email: anthony@gmail.com
- Phone: 571-477-6175
- Address: 11146 Sunburst Lane, Fredericksburg, Virginia 22401
- Problem: toilet leak in the bathroom

Rules:
- Reply with ONE short natural spoken sentence (no bullet lists).
- When the agent offers appointment times, pick one of the EXACT times they listed.
- When asked to confirm booking, say yes clearly.
- Do not pretend to be the agent.
- Do not mention tools, APIs, or being an AI.`;

export async function generateCallerUtterance(input: {
  transcript: Array<{ role: "caller" | "amy"; text: string }>;
  goal?: string;
  openingLine?: string;
}): Promise<string> {
  if (!input.transcript.length && input.openingLine) {
    return input.openingLine;
  }

  const history = input.transcript
    .map((line) => `${line.role === "caller" ? "Caller" : "Amy"}: ${line.text}`)
    .join("\n");

  const messages: OpenAiChatMessage[] = [
    {
      role: "system",
      content: [
        DEFAULT_CALLER_PERSONA,
        input.goal ? `Goal: ${input.goal}` : "",
        "Continue the phone call. Output only the caller's next line.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: history
        ? `Conversation so far:\n${history}\n\nWhat does the caller say next?`
        : "The caller just connected. What is their opening line?",
    },
  ];

  const { message } = await openAiChatCompletion({ messages, temperature: 0.5 });
  const text = "content" in message ? String(message.content || "").trim() : "";
  if (!text) throw new Error("LLM caller returned empty utterance");
  return text.replace(/^Caller:\s*/i, "").trim();
}
