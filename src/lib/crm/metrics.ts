/**
 * Lightweight CRM performance metrics stored on the connection config.
 * No external telemetry dependency — support can read via dashboard/API.
 */

import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import type { CrmProviderId } from "./types";

export type CrmPerfSample = {
  name: string;
  ms: number;
  at: string;
  ok: boolean;
};

export type CrmPerfSummary = {
  samples: CrmPerfSample[];
  averages: Record<string, { avgMs: number; count: number; lastMs: number; successRate: number }>;
};

const MAX_SAMPLES = 40;

export async function recordCrmMetric(input: {
  workspaceId: string;
  provider: CrmProviderId;
  name: string;
  ms: number;
  ok?: boolean;
}) {
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = (conn?.configJson || {}) as { perfSamples?: CrmPerfSample[] };
  const samples = [...(cfg.perfSamples || [])];
  samples.unshift({
    name: input.name,
    ms: Math.round(input.ms),
    at: new Date().toISOString(),
    ok: input.ok !== false,
  });
  while (samples.length > MAX_SAMPLES) samples.pop();
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    config: { perfSamples: samples },
    mergeConfig: true,
  });
}

export async function getCrmPerfSummary(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<CrmPerfSummary> {
  const conn = await getConnection(workspaceId, provider);
  const samples = ((conn?.configJson || {}) as { perfSamples?: CrmPerfSample[] }).perfSamples || [];
  const byName = new Map<string, CrmPerfSample[]>();
  for (const s of samples) {
    const list = byName.get(s.name) || [];
    list.push(s);
    byName.set(s.name, list);
  }
  const averages: CrmPerfSummary["averages"] = {};
  for (const [name, list] of byName) {
    const total = list.reduce((a, b) => a + b.ms, 0);
    const ok = list.filter((s) => s.ok).length;
    averages[name] = {
      avgMs: Math.round(total / list.length),
      count: list.length,
      lastMs: list[0]?.ms || 0,
      successRate: list.length ? Math.round((ok / list.length) * 100) : 0,
    };
  }
  return { samples, averages };
}

export async function timedCrmMetric<T>(
  workspaceId: string,
  provider: CrmProviderId,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    await recordCrmMetric({
      workspaceId,
      provider,
      name,
      ms: Date.now() - started,
      ok: true,
    }).catch(() => undefined);
    return result;
  } catch (err) {
    await recordCrmMetric({
      workspaceId,
      provider,
      name,
      ms: Date.now() - started,
      ok: false,
    }).catch(() => undefined);
    throw err;
  }
}
