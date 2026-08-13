import { Card, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  buildRuntimeAuditTable,
  runtimeRegistrySummary,
} from "@/lib/agents/appointment-booking/runtime-registry";
import { getAllPromptVersions } from "@/lib/agents/appointment-booking/intelligence/prompt-versioning";
import { runAcceptanceSuite } from "@/lib/agents/appointment-booking/intelligence/acceptance-tests";
import { OWNER_AMY_TOOL_DESCRIPTIONS } from "@/lib/agents/appointment-booking/intelligence/tool-descriptions";

export default function AdminAgentRuntimesPage() {
  const audit = buildRuntimeAuditTable();
  const runtimes = runtimeRegistrySummary();
  const prompts = getAllPromptVersions();
  const acceptance = runAcceptanceSuite();

  return (
    <div className="space-y-8 p-6">
      <SectionHeader
        title="Amy agent runtimes"
        description="Internal debug view — specialized runtimes, prompts, tools, context, and writes."
      />

      <Card className="p-5">
        <CardTitle className="mb-4 text-base">Runtime audit</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Runtime</TH>
              <TH>Prompt</TH>
              <TH>Model</TH>
              <TH>Tools</TH>
              <TH>Context</TH>
              <TH>Writes</TH>
              <TH>Gap</TH>
            </TR>
          </THead>
          <TBody>
            {audit.map((row) => (
              <TR key={row.runtime}>
                <TD className="font-medium">{row.runtime}</TD>
                <TD className="max-w-xs truncate text-[12px]" title={row.currentPrompt}>
                  {row.promptVersion} ({row.promptHash})
                </TD>
                <TD className="text-[12px]">{row.currentModel}</TD>
                <TD>{row.currentTools}</TD>
                <TD>{row.currentContext}</TD>
                <TD className="text-[12px]">{row.currentWrites}</TD>
                <TD className="max-w-sm text-[12px] text-slate-600">{row.gap}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-4 text-base">Active runtimes</CardTitle>
        <div className="space-y-4">
          {runtimes.map((r) => (
            <div key={r.runtimeId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{r.label}</h3>
                <span className="text-[12px] text-slate-500">
                  {r.promptVersion} · hash {r.promptHash}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{r.model}</p>
              <p className="mt-2 text-[12px]">
                <span className="font-semibold">Writes:</span> {r.allowedWrites.join(", ")}
              </p>
              <p className="mt-1 text-[12px]">
                <span className="font-semibold">Fallback:</span>{" "}
                {r.fallbackRuntimeId || "none"}
              </p>
              <p className="mt-1 text-[12px]">
                <span className="font-semibold">Context budget:</span> {r.maxContextBudget} tokens
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Tools ({r.toolCount}): {r.tools.slice(0, 8).join(", ")}
                {r.tools.length > 8 ? "…" : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-4 text-base">
          Acceptance tests ({acceptance.passed}/{acceptance.passed + acceptance.failed} passed)
        </CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Test</TH>
              <TH>Runtime</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {acceptance.results.map((r) => (
              <TR key={r.id}>
                <TD>{r.id}</TD>
                <TD>{r.runtime}</TD>
                <TD className={r.passed ? "text-violet-700" : "text-red-700"}>
                  {r.passed ? "passed" : `failed${r.reason ? `: ${r.reason}` : ""}`}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-2 text-base">Owner Amy tool catalog</CardTitle>
        <p className="mb-4 text-sm text-slate-600">
          {OWNER_AMY_TOOL_DESCRIPTIONS.length} typed tools with agent-readable metadata.
        </p>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {OWNER_AMY_TOOL_DESCRIPTIONS.map((t) => (
            <div key={t.id} className="rounded-lg bg-slate-50 p-3 text-[12px]">
              <p className="font-semibold">{t.id}</p>
              <p className="text-slate-600">{t.purpose}</p>
              <p className="mt-1 text-slate-500">Side effects: {t.sideEffects}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
