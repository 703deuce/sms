/**
 * Validates Kimi direct-upload API contract:
 * - prepare/complete accept JSON only (no video bytes through Next.js)
 * - legacy multipart POST is disabled
 *
 * Usage (against running app with auth cookie / dev-bypass):
 *   BASE_URL=https://transovo.ai npx tsx scripts/test-kimi-direct-upload.ts
 */

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function expectStatus(url: string, init: RequestInit, status: number, label: string) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  const ok = res.status === status;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: HTTP ${res.status}`);
  if (!ok) {
    console.log(body);
    process.exitCode = 1;
  }
  return { res, body };
}

async function main() {
  console.log(`Testing Kimi direct upload contract at ${base}`);

  await expectStatus(
    `${base}/api/transovo/kimi/references`,
    { method: "POST", body: new FormData() },
    405,
    "legacy multipart POST disabled",
  );

  const prepare = await expectStatus(
    `${base}/api/transovo/kimi/references/prepare`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "contract-test",
        mimeType: "video/mp4",
        size: 1_048_576,
        filename: "one-mb.mp4",
      }),
    },
    200,
    "prepare accepts JSON metadata only",
  );

  const prepared = prepare.body as {
    uploadId?: string;
    bucket?: string;
    path?: string;
    token?: string;
    supabaseUrl?: string;
  };

  if (!prepared.uploadId || !prepared.token || !prepared.path || !prepared.bucket) {
    console.log("FAIL prepare response missing upload credentials");
    process.exitCode = 1;
    return;
  }
  console.log("PASS prepare returns signed upload credentials (no file body accepted)");

  await expectStatus(
    `${base}/api/transovo/kimi/references/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: prepared.uploadId,
        name: "contract-test",
        bucket: prepared.bucket,
        path: prepared.path,
        kind: "video",
        mimeType: "video/mp4",
        size: 1_048_576,
        filename: "one-mb.mp4",
      }),
    },
    409,
    "complete verifies storage object before saving",
  );

  console.log("\nNote: byte-progress XHR upload is browser-only; run a manual 12 MB upload on /transovo/kimi after deploy.");
}

void main();
