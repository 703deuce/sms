import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadKimiConfig } from "./config";
import { log } from "./logger";
import type {
  AnalysisMode,
  LabeledMedia,
  UiAnalysisInput,
  UiAnalysisResult,
  UiVisionProvider,
} from "./types";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_API_KEY]");
}

async function fetchJson(url: string, init: RequestInit, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi API ${res.status}: ${redactSecrets(body.slice(0, 500))}`);
  }
  return JSON.parse(body) as unknown;
}

async function uploadVideoFile(
  baseUrl: string,
  apiKey: string,
  filePath: string,
  mimeType: string,
): Promise<string> {
  const fileBuffer = readFileSync(filePath);
  const form = new FormData();
  form.append("purpose", "video");
  form.append("file", new Blob([fileBuffer], { type: mimeType }), basename(filePath));

  const res = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi file upload failed ${res.status}: ${redactSecrets(text.slice(0, 500))}`);
  }
  const json = JSON.parse(text) as { id?: string; data?: { id?: string } };
  const id = json.id || json.data?.id;
  if (!id) throw new Error("Kimi file upload did not return a file id");
  return id;
}

function imageToDataUrl(filePath: string, mimeType: string): string {
  const b64 = readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${b64}`;
}

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
      const models = (await fetchJson(`${this.baseUrl}/models`, { method: "GET" }, this.apiKey)) as {
        data?: Array<{ id?: string }>;
      };
      const ids = (models.data || []).map((m) => m.id).filter(Boolean);
      if (ids.length > 0 && !ids.includes(this.model)) {
        log("model warning", `configured model "${this.model}" not in /models list; proceeding anyway`);
      }
    } catch (err) {
      log("model validation skipped", err instanceof Error ? err.message : String(err));
    }

    if (!this.supportsVideo) {
      log("model capability", `${this.model} configured without native video support`);
    } else {
      log("model capability", `${this.model} supports native video via Files API`);
    }
  }

  async analyze(input: UiAnalysisInput): Promise<UiAnalysisResult> {
    const hasVideo = input.labeledMedia.some((m) => m.kind === "video");
    if (hasVideo && !this.supportsVideo) {
      throw new Error(
        `Configured model "${this.model}" does not support native video. Use a video-capable model such as kimi-k3 (not k3-256k).`,
      );
    }

    const contentParts: Array<Record<string, unknown>> = [{ type: "text", text: input.userPrompt }];

    for (const media of input.labeledMedia) {
      if (media.kind === "image") {
        contentParts.push({
          type: "image_url",
          image_url: { url: imageToDataUrl(media.path, media.mimeType) },
        });
        contentParts.push({
          type: "text",
          text: `[${media.label}] ${media.purpose}`,
        });
      } else if (media.kind === "video") {
        const fileId = await uploadVideoFile(this.baseUrl, this.apiKey, media.path, media.mimeType);
        contentParts.push({
          type: "video_url",
          video_url: { url: `ms://${fileId}` },
        });
        contentParts.push({
          type: "text",
          text: `[${media.label}] ${media.purpose}`,
        });
      }
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

    const completion = (await fetchJson(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      this.apiKey,
    )) as {
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

    const analysisMode: AnalysisMode = hasVideo ? "native_multimodal" : "native_multimodal";

    return {
      rawText,
      parsedJson,
      model: this.model,
      analysisMode,
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
