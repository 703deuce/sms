/**
 * Quick spike: can Kimi consume a reference video via signed Supabase URL
 * without uploading bytes to Kimi Files API?
 *
 * Usage:
 *   npx tsx scripts/test-kimi-supabase-video-url.ts
 *   npx tsx scripts/test-kimi-supabase-video-url.ts --format file
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import { createCliSignedUrl } from "./ui-agent/supabase-references";

const INBOX_REF =
  "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)";

const KIMI_BASE = (process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k3";
const SIGNED_URL_TTL_SEC = Number(process.env.KIMI_SIGNED_URL_TTL_SEC || 3600);
const CHAT_TIMEOUT_MS = Number(process.env.KIMI_CHAT_TIMEOUT_MS || 20 * 60 * 1000);

const agent = new Agent({ headersTimeout: 0, bodyTimeout: 0, connectTimeout: 60_000 });

type Timing = {
  t0_signedUrlCreated?: string;
  t1_promptSent?: string;
  t2_responseHeaders?: string;
  t3_firstContent?: string;
  elapsedMs?: number;
};

function stamp(): string {
  return new Date().toISOString();
}

function msSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  return Date.now() - new Date(iso).getTime();
}

function loadInboxRef(): { bucket: string; path: string } {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), ".ui-agent/references.json"), "utf8"),
  ) as Record<string, { bucket?: string; path: string; storage: string }>;
  const entry = manifest[INBOX_REF];
  if (!entry?.bucket || !entry.path) {
    throw new Error(`Reference not found in manifest: ${INBOX_REF}`);
  }
  return { bucket: entry.bucket, path: entry.path };
}

async function kimiChat(
  apiKey: string,
  contentParts: Array<Record<string, unknown>>,
  label: string,
): Promise<{ ok: boolean; status: number; body: string; timing: Timing }> {
  const timing: Timing = { t1_promptSent: stamp() };
  const started = Date.now();

  const res = await undiciFetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
      temperature: 1,
      max_tokens: 256,
    }),
    dispatcher: agent,
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });

  timing.t2_responseHeaders = stamp();
  const body = await res.text();
  timing.t3_firstContent = stamp();
  timing.elapsedMs = Date.now() - started;

  console.log(`\n--- ${label} ---`);
  console.log(`status=${res.status} elapsed=${timing.elapsedMs}ms`);
  console.log(`T1 prompt sent:      ${timing.t1_promptSent}`);
  console.log(`T2 response headers: ${timing.t2_responseHeaders} (+${msSince(timing.t1_promptSent)}ms)`);
  console.log(`T3 body read:        ${timing.t3_firstContent} (+${msSince(timing.t1_promptSent)}ms)`);
  console.log(`body preview: ${body.slice(0, 600)}`);

  return { ok: res.ok, status: res.status, body, timing };
}

function extractAssistantText(body: string): string | null {
  try {
    const json = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) throw new Error("KIMI_API_KEY is required");

  const formatArg = process.argv.find((a) => a.startsWith("--format="))?.split("=")[1] || "all";
  const ref = loadInboxRef();

  console.log("Kimi signed-URL video spike");
  console.log(`model=${KIMI_MODEL}`);
  console.log(`reference=${INBOX_REF}`);
  console.log(`supabase=${ref.bucket}/${ref.path}`);

  const timing: Timing = {};
  timing.t0_signedUrlCreated = stamp();
  const signedUrl = await createCliSignedUrl({
    bucket: ref.bucket,
    path: ref.path,
    expiresInSeconds: SIGNED_URL_TTL_SEC,
  });
  console.log(`\nT0 signed URL created: ${timing.t0_signedUrlCreated}`);
  console.log(`signed URL host: ${new URL(signedUrl).host}`);
  console.log(`signed URL ttl: ${SIGNED_URL_TTL_SEC}s`);

  // Sanity: our server can fetch the signed URL (Kimi needs the same)
  const head = await fetch(signedUrl, { method: "HEAD" });
  const contentLength = head.headers.get("content-length");
  const contentType = head.headers.get("content-type");
  console.log(`\nSupabase HEAD check: status=${head.status} type=${contentType} size=${contentLength}`);

  const prompt =
    "Watch the attached tutorial video. In one or two sentences, describe the main UI screen shown (layout, sidebar, inbox). Do not invent features not visible.";

  const tests: Array<{ name: string; parts: Array<Record<string, unknown>> }> = [];

  if (formatArg === "all" || formatArg === "video_url") {
    tests.push({
      name: "chat/completions video_url (HTTPS signed URL)",
      parts: [
        { type: "text", text: prompt },
        { type: "video_url", video_url: { url: signedUrl } },
      ],
    });
  }

  if (formatArg === "all" || formatArg === "native") {
    tests.push({
      name: "chat/completions type=video source.kind=url",
      parts: [
        { type: "text", text: prompt },
        {
          type: "video",
          source: { kind: "url", url: signedUrl },
        },
      ],
    });
  }

  if (formatArg === "file") {
    // Compare: upload file then use ms:// (existing path)
    const localPath = join(
      process.cwd(),
      ".ui-agent/cache",
      INBOX_REF,
      "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p).mp4",
    );
    const { readFileSync, existsSync } = await import("node:fs");
    if (!existsSync(localPath)) {
      console.log("\nSkipping file/ms:// test — local cache missing. Run ui:kimi once or download first.");
    } else {
      const buf = readFileSync(localPath);
      const form = new FormData();
      form.append("purpose", "video");
      form.append(
        "file",
        new Blob([buf], { type: "video/mp4" }),
        "inbox.mp4",
      );
      const uploadRes = await undiciFetch(`${KIMI_BASE}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        dispatcher: agent,
      });
      const uploadBody = await uploadRes.text();
      console.log(`\nfile upload status=${uploadRes.status} body=${uploadBody.slice(0, 200)}`);
      const fileId = (JSON.parse(uploadBody) as { id?: string }).id;
      if (fileId) {
        tests.push({
          name: "chat/completions video_url (ms:// file_id baseline)",
          parts: [
            { type: "text", text: prompt },
            { type: "video_url", video_url: { url: `ms://${fileId}` } },
          ],
        });
        tests.push({
          name: "chat/completions type=video source.kind=file",
          parts: [
            { type: "text", text: prompt },
            { type: "video", source: { kind: "file", file_id: fileId } },
          ],
        });
      }
    }
  }

  const results: Array<{ name: string; ok: boolean; status: number; text: string | null }> = [];

  for (const test of tests) {
    const result = await kimiChat(apiKey, test.parts, test.name);
    const text = extractAssistantText(result.body);
    results.push({ name: test.name, ok: result.ok, status: result.status, text });
    if (text) {
      console.log(`assistant: ${text.slice(0, 300)}`);
    }
  }

  console.log("\n========== SUMMARY ==========");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.status}] ${r.name}`);
    if (r.text) console.log(`  → ${r.text.slice(0, 160)}`);
  }

  const urlWorked = results.some(
    (r) => r.ok && r.name.includes("HTTPS signed URL") && r.text && r.text.length > 10,
  );
  if (urlWorked) {
    console.log("\n✅ Signed Supabase URL video path WORKS — safe to wire into ui-agent.");
    process.exit(0);
  }

  const anyWorked = results.some((r) => r.ok && r.text && r.text.length > 10);
  if (anyWorked) {
    console.log("\n⚠️  Some format worked but not HTTPS signed URL — check which one above.");
    process.exit(0);
  }

  console.log("\n❌ No video format succeeded in this spike.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
