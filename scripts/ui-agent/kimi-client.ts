import { uploadVideoForNativeKimi, buildImageDataUrlDelivery } from "./kimi-media";
import { loadKimiConfig } from "./config";
import { log } from "./logger";
import type {
  AnalysisMode,
  KimiMediaDelivery,
  LabeledMedia,
  UiAnalysisInput,
  UiAnalysisResult,
  UiVisionProvider,
} from "./types";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export class KimiVisionProvider implements UiVisionProvider {
  readonly model: string;
  readonly supportsImage: boolean;
  readonly supportsVideo: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config = loadKimiConfig()) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.supportsImage = config.supportsImage;
    this.supportsVideo = config.supportsVideo;
  }

  static async createValidated(): Promise<KimiVisionProvider> {
    const provider = new KimiVisionProvider();
    await provider.validateModel();
    return provider;
  }

  async validateModel(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        const models = (await res.json()) as { data?: Array<{ id?: string }> };
        const ids = (models.data || []).map((m) => m.id).filter(Boolean);
        if (ids.length > 0 && !ids.includes(this.model)) {
          log("model warning", `configured model "${this.model}" not in /models list; proceeding anyway`);
        }
      }
    } catch (err) {
      log("model validation skipped", err instanceof Error ? err.message : String(err));
    }

    if (!this.supportsVideo) {
      log("model capability", `${this.model} configured without native video support`);
    } else {
      log("model capability", `${this.model} — video via Files API + ms:// (never base64 video)`);
    }
  }

  async analyze(input: UiAnalysisInput): Promise<UiAnalysisResult> {
    const videos = input.labeledMedia.filter((m) => m.kind === "video");
    const images = input.labeledMedia.filter((m) => m.kind === "image");

    if (videos.length > 0 && !this.supportsVideo) {
      throw new Error(
        `Configured model "${this.model}" does not support native video. Use a video-capable model such as kimi-k3 (not k3-256k).`,
      );
    }

    const deliveries: KimiMediaDelivery[] = [];
    const contentParts: Array<Record<string, unknown>> = [
      { type: "text", text: input.userPrompt },
    ];

    for (const media of videos) {
      const delivery = await uploadVideoForNativeKimi({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        filePath: media.path,
        mimeType: media.mimeType,
        label: media.label,
      });
      deliveries.push(delivery);
      contentParts.push({
        type: "video_url",
        video_url: { url: delivery.reference },
      });
      contentParts.push({
        type: "text",
        text: `[${media.label}] ${media.purpose} — attached as native Kimi video (ms://), not serialized into prompt text.`,
      });
    }

    for (const media of images) {
      const delivery = buildImageDataUrlDelivery({
        filePath: media.path,
        mimeType: media.mimeType,
        label: media.label,
      });
      deliveries.push(delivery);
      contentParts.push({
        type: "image_url",
        image_url: { url: delivery.reference },
      });
      contentParts.push({
        type: "text",
        text: `[${media.label}] ${media.purpose}`,
      });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: contentParts },
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 1,
    };
    if (input.expectJson) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const rawBody = await res.text();
    if (!res.ok) {
      throw new Error(`Kimi API ${res.status}: ${rawBody.slice(0, 500)}`);
    }

    const completion = JSON.parse(rawBody) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    let parsedJson: unknown | null = null;
    if (input.expectJson) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsedJson = JSON.parse(match[0]);
      }
    }

    const analysisMode: AnalysisMode = videos.length > 0 ? "native_multimodal" : "native_multimodal";

    return {
      rawText,
      parsedJson,
      model: this.model,
      analysisMode,
      mediaDeliveries: deliveries,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
      },
    };
  }
}

export function createVisionProvider(): UiVisionProvider {
  return new KimiVisionProvider();
}
