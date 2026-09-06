import { deliverVideoForKimi, buildImageDataUrlDelivery } from "./kimi-media";
import { KIMI_CHAT_TIMEOUT_MS } from "./config";
import { kimiFetch } from "./kimi-http";
import {
  buildKimiRequestPayloadReport,
  printKimiRequestPayloadReport,
  writeKimiRequestPayloadReport,
} from "./kimi-request-audit";
import { kimiStreamLogPath, streamKimiChatCompletion } from "./kimi-stream";
import { loadKimiConfig, type KimiRuntimeConfig } from "./config";
import { log } from "./logger";
import { appendProgressLog, updateProgress } from "./progress";
import { markKimiTiming, logKimiTiming } from "./kimi-timing";
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
  private readonly reasoningEffort: "low" | "high" | "max";
  private readonly maxOutputTokens?: number;

  constructor(config = loadKimiConfig()) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.supportsImage = config.supportsImage;
    this.supportsVideo = config.supportsVideo;
    this.reasoningEffort = config.reasoningEffort;
    this.maxOutputTokens = config.maxOutputTokens;
  }

  static async createValidated(overrides?: Partial<KimiRuntimeConfig>): Promise<KimiVisionProvider> {
    const config = { ...loadKimiConfig(), ...overrides };
    const provider = new KimiVisionProvider(config);
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
      log("model capability", `${this.model} — video via POST /v1/files + ms:// (cached per reference)`);
    }
  }

  async analyze(input: UiAnalysisInput): Promise<UiAnalysisResult> {
    const media = input.skipReferenceVideo
      ? input.labeledMedia.filter((m) => m.kind !== "video")
      : input.labeledMedia;
    const videos = media.filter((m) => m.kind === "video");
    const images = media.filter((m) => m.kind === "image");
    const sessionId = input.sessionId;
    const phaseLabel = input.phaseLabel || "Kimi generation";

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
      const delivery = await deliverVideoForKimi({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        media,
        sessionId,
      });
      deliveries.push(delivery);
      contentParts.push({
        type: "video_url",
        video_url: { url: delivery.reference },
      });
      contentParts.push({
        type: "text",
        text: `[${media.label}] ${media.purpose} — Kimi native video (${delivery.fromCache ? "cached " : ""}ms://).`,
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
    const effort = input.reasoningEffort ?? this.reasoningEffort;
    if (this.model.startsWith("kimi-k3") && effort) {
      body.reasoning_effort = effort;
    }
    const maxTokens = input.maxOutputTokens ?? this.maxOutputTokens;
    if (maxTokens) {
      body.max_tokens = maxTokens;
    }
    if (input.expectJson && !input.useIncrementalFiles) {
      body.response_format = { type: "json_object" };
    }

    const videoRefs = deliveries
      .filter((d) => d.kind === "video")
      .map((d) => d.reference);
    const payloadReport = buildKimiRequestPayloadReport({
      body,
      sessionId,
      leanPrompt: input.leanPrompt,
      videoRefs,
      imageCount: images.length,
      systemChars: input.systemPrompt.length,
      userChars: input.userPrompt.length,
    });

    if (sessionId) {
      writeKimiRequestPayloadReport(sessionId, payloadReport);
      printKimiRequestPayloadReport(payloadReport);
      markKimiTiming(sessionId, "kimiModel", this.model);
      if (this.model.startsWith("kimi-k3")) {
        markKimiTiming(sessionId, "reasoningEffort", effort);
      }
      markKimiTiming(sessionId, "kimiGenerationStartedMs");
      updateProgress(sessionId, {
        phase: "generating_ui",
        message: `${phaseLabel}: Kimi streaming UI code (live)…`,
      });
      appendProgressLog(
        sessionId,
        `kimi_generation_started stream=true timeout=${Math.round(KIMI_CHAT_TIMEOUT_MS / 60000)}min log=${kimiStreamLogPath(sessionId)}`,
      );
      console.log(`\n[ui-agent] Kimi live stream → tail -f ${kimiStreamLogPath(sessionId)}\n`);
    }

    const generationStarted = Date.now();
    let rawText = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

    if (sessionId) {
      const streamed = await streamKimiChatCompletion({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        body,
        sessionId,
        label: phaseLabel,
        timeoutMs: KIMI_CHAT_TIMEOUT_MS,
        useIncrementalFiles: input.useIncrementalFiles,
        draftTargetRoute: input.draftTargetRoute,
        referenceNames: input.referenceNames,
      });
      rawText = streamed.rawText.trim();
      if (streamed.firstContentMs) {
        markKimiTiming(sessionId, "firstContentTokenMs", streamed.firstContentMs);
      }
      if (streamed.firstReasoningMs) {
        markKimiTiming(sessionId, "firstReasoningTokenMs", streamed.firstReasoningMs);
      }
      markKimiTiming(sessionId, "generationTotalMs", streamed.totalMs);
    } else {
      const res = await kimiFetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        timeoutMs: KIMI_CHAT_TIMEOUT_MS,
        label: phaseLabel,
      });
      const rawBody = await res.text();
      if (!res.ok) {
        throw new Error(`Kimi API ${res.status}: ${rawBody.slice(0, 500)}`);
      }
      const completion = JSON.parse(rawBody) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      rawText = completion.choices?.[0]?.message?.content?.trim() || "";
      usage = completion.usage;
    }

    if (sessionId) {
      logKimiTiming(sessionId, "generation_complete");
      appendProgressLog(
        sessionId,
        `Kimi stream finished (${rawText.length} chars). Parsing generated files…`,
      );
    }

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
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
      },
    };
  }
}

export function createVisionProvider(): UiVisionProvider {
  return new KimiVisionProvider();
}
