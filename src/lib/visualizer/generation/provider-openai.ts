import "server-only";

import OpenAI, { toFile } from "openai";

export type OpenAiImageEditInput = {
  roomImage: Buffer;
  roomMime: string;
  referenceImages: Array<{ bytes: Buffer; mime: string }>;
  prompt: string;
};

export type OpenAiImageEditResult = {
  imageBytes: Buffer;
  mimeType: string;
  model: string;
};

function resolveImageModel(): string {
  return (
    process.env.VISUALIZER_OPENAI_IMAGE_MODEL?.trim() ||
    process.env.OPENAI_IMAGE_MODEL?.trim() ||
    "gpt-image-1"
  );
}

export async function runOpenAiBathroomEdit(
  input: OpenAiImageEditInput,
): Promise<OpenAiImageEditResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for image generation.");
  }

  const client = new OpenAI({ apiKey });
  const model = resolveImageModel();

  const imageFiles = [
    await toFile(input.roomImage, "room.jpg", { type: input.roomMime }),
    ...input.referenceImages.map((ref, i) =>
      toFile(ref.bytes, `reference-${i + 1}.jpg`, { type: ref.mime }),
    ),
  ];

  const response = await client.images.edit({
    model,
    image: imageFiles,
    prompt: input.prompt,
    size: "1024x1024",
    quality: "high",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image provider returned no image data.");
  }

  return {
    imageBytes: Buffer.from(b64, "base64"),
    mimeType: "image/png",
    model,
  };
}
