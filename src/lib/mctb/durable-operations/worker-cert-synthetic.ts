import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type WorkerCertSyntheticSpec = {
  delayMs: number;
  failOnce?: boolean;
  providerExecutionTag?: string;
};

function certSecret(): string | null {
  const secret = process.env.VOICE_DURABLE_WORKER_CERT_SECRET?.trim();
  return secret || null;
}

export function buildWorkerCertSyntheticToken(
  idempotencyKey: string,
  delayMs: number,
  secret: string,
): string {
  return createHmac("sha256", secret).update(`${idempotencyKey}:${delayMs}`).digest("hex");
}

export function buildWorkerCertSyntheticInput(
  idempotencyKey: string,
  spec: WorkerCertSyntheticSpec,
  secret: string,
): Record<string, unknown> {
  return {
    __workerCert: {
      delayMs: spec.delayMs,
      failOnce: spec.failOnce === true,
      providerExecutionTag: spec.providerExecutionTag || "synthetic",
      token: buildWorkerCertSyntheticToken(idempotencyKey, spec.delayMs, secret),
    },
  };
}

export function resolveWorkerCertSynthetic(
  inputJson: Record<string, unknown>,
  idempotencyKey: string,
): WorkerCertSyntheticSpec | null {
  const secret = certSecret();
  if (!secret) return null;
  const block = inputJson.__workerCert;
  if (!block || typeof block !== "object") return null;
  const raw = block as Record<string, unknown>;
  const delayMs = Number(raw.delayMs);
  const token = String(raw.token || "");
  if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 120_000) return null;
  const expected = buildWorkerCertSyntheticToken(idempotencyKey, delayMs, secret);
  if (token.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return {
    delayMs,
    failOnce: raw.failOnce === true,
    providerExecutionTag: raw.providerExecutionTag ? String(raw.providerExecutionTag) : "synthetic",
  };
}
