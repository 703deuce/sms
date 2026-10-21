import "server-only";

const DEFAULT_MODEL = "eleven_flash_v2_5";

export async function synthesizeElevenLabsMp3(input: {
  text: string;
  voiceId: string;
  modelId?: string;
}): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  const text = input.text.trim();
  if (!text) throw new Error("Greeting text is required");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: input.modelId || DEFAULT_MODEL,
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs synthesis failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
