/**
 * Validate production MCTB consent audio URL for Telnyx <Play> (cert B2).
 *
 * Run: npx tsx scripts/validate-mctb-consent-audio-url.ts
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  getMctbConsentAudioAssetId,
  getMctbConsentPlaybackUrl,
} from "../src/lib/mctb/consent-prompt/texml-response";

const execFileAsync = promisify(execFile);

type ProbeResult = {
  ok: boolean;
  url: string;
  assetId: string;
  status: number;
  contentType: string | null;
  contentLength: number | null;
  finalUrl: string;
  redirectCount: number;
  isHtml: boolean;
  bytesDownloaded: number;
  ffprobe?: Record<string, unknown>;
  error?: string;
};

async function ffprobeFile(filePath: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string; bit_rate?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      sample_rate?: string;
      channels?: number;
    }>;
  };
  const audio = parsed.streams?.find((s) => s.codec_type === "audio");
  return {
    container: parsed.format?.format_name ?? null,
    codec: audio?.codec_name ?? null,
    sampleRate: audio?.sample_rate ?? null,
    channels: audio?.channels ?? null,
    durationSeconds: parsed.format?.duration ? Number(parsed.format.duration) : null,
    bitrate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : null,
  };
}

export async function validateMctbConsentAudioUrl(audioUrl?: string): Promise<ProbeResult> {
  const url = audioUrl || getMctbConsentPlaybackUrl();
  const assetId = getMctbConsentAudioAssetId();

  let redirectCount = 0;
  let current = url;
  let res: Response | null = null;

  for (let i = 0; i < 5; i++) {
    res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      redirectCount++;
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }

  if (!res) {
    return {
      ok: false,
      url,
      assetId,
      status: 0,
      contentType: null,
      contentLength: null,
      finalUrl: current,
      redirectCount,
      isHtml: false,
      bytesDownloaded: 0,
      error: "no response",
    };
  }

  const body = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type");
  const trimmed = body.subarray(0, 64).toString("utf8");
  const isHtml =
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("{") ||
    contentType?.includes("text/html") === true;

  const result: ProbeResult = {
    ok: false,
    url,
    assetId,
    status: res.status,
    contentType,
    contentLength: res.headers.get("content-length")
      ? Number(res.headers.get("content-length"))
      : body.length,
    finalUrl: current,
    redirectCount,
    isHtml,
    bytesDownloaded: body.length,
  };

  if (!res.ok || isHtml || body.length < 128) {
    result.error = `status=${res.status} html=${isHtml} bytes=${body.length}`;
    return result;
  }

  const dir = await mkdtemp(join(tmpdir(), "mctb-audio-"));
  const filePath = join(dir, "sample.bin");
  try {
    await writeFile(filePath, body);
    result.ffprobe = await ffprobeFile(filePath);
    result.ok = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return result;
}

async function main() {
  const result = await validateMctbConsentAudioUrl();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
