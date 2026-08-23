"use client"; // pragma: allowlist secret

import {
  SrOutlineButton,
  SrPrimaryButton,
  SrTextarea,
  srCard,
} from "@/components/smart-routing/shared";
import type { AiRoutingProposalView } from "@/lib/smart-routing/ai/types";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";

const SUGGESTED_PROMPTS = [
  "Build my phone tree",
  "Change my business hours",
  "Improve my routing",
  "Explain my current setup",
];

type Mode = "build" | "change" | "explain" | "analyze" | "improve";

function mapModeFromPrompt(prompt: string, explicit?: Mode): Mode {
  if (explicit) return explicit;
  const lower = prompt.toLowerCase();
  if (lower.includes("explain") || lower.includes("what happens")) return "explain";
  if (lower.includes("why") || lower.includes("miss") || lower.includes("analytics")) return "analyze";
  if (lower.includes("improve") || lower.includes("recommend")) return "improve";
  if (lower.includes("build") || lower.includes("press 1")) return "build";
  return "change";
}

export function SmartRoutingAiAssistant({
  flowId,
  compact = false,
  onApplied,
  className,
}: {
  flowId?: string;
  compact?: boolean;
  onApplied?: (flowId: string) => void;
  className?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AiRoutingProposalView | null>(null);
  const [applying, setApplying] = useState(false);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      setProposal(null);
      try {
        const res = await fetch("/api/smart-routing/ai/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            flowId,
            mode: mapModeFromPrompt(trimmed),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "AI request failed");
          return;
        }
        setMessage(json.data?.message ?? null);
        setProposal(json.data?.proposal ?? null);
      } catch {
        setError("I couldn't reach the routing assistant right now. Your routing has not been changed.");
      } finally {
        setLoading(false);
      }
    },
    [flowId],
  );

  async function applyChanges() {
    if (!proposal?.canApply) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/smart-routing/ai/proposals/${proposal.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Apply failed");
        if (json.rebased && json.data?.proposal) {
          setProposal(json.data.proposal);
        }
        return;
      }
      setMessage("Routing updated successfully.");
      setProposal(null);
      setPrompt("");
      if (json.data?.flowId) onApplied?.(json.data.flowId);
    } finally {
      setApplying(false);
    }
  }

  async function cancelProposal() {
    if (!proposal) return;
    await fetch(`/api/smart-routing/ai/proposals/${proposal.id}/reject`, { method: "POST" });
    setProposal(null);
    setMessage(null);
  }

  return (
    <div
      className={cn(
        srCard,
        "border-[#e0e7ff] bg-gradient-to-br from-[#f8faff] to-white p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6366f1] text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-[#111827]">
            Smart Routing AI Assistant
          </h2>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Tell us how you want your calls handled. AI configures Smart Routing — live calls stay
            deterministic.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] text-[#4b5563] hover:border-[#6366f1] hover:text-[#6366f1]"
              onClick={() => {
                setPrompt(s);
                submit(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <SrTextarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ring Sales on Mike and Sarah, and send Service to John after 5."
          rows={compact ? 2 : 3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(prompt);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SrPrimaryButton
            type="button"
            disabled={loading || !prompt.trim()}
            onClick={() => submit(prompt)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Bot className="mr-2 h-4 w-4" />
                Ask AI
              </>
            )}
          </SrPrimaryButton>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {message && !proposal?.preview && (
        <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] text-[#374151]">
          {message}
        </div>
      )}

      {proposal?.clarificationQuestion && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] text-amber-900">
          {proposal.clarificationQuestion}
        </div>
      )}

      {proposal?.preview && (
        <div className="mt-4 space-y-3 rounded-xl border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-medium text-[#111827]">Here&apos;s what I&apos;ll change</p>
            <button type="button" onClick={cancelProposal} className="text-[#9ca3af] hover:text-[#111827]">
              <X className="h-4 w-4" />
            </button>
          </div>
          {proposal.summary && (
            <p className="text-[13px] text-[#6b7280]">{proposal.summary}</p>
          )}
          <div className="space-y-2">
            {proposal.proposedChanges.map((c) => (
              <div
                key={c.area}
                className="rounded-lg border border-[#f3f4f6] bg-[#f9fafb] px-3 py-2"
              >
                <div className="text-[12px] font-medium text-[#111827]">{c.area}</div>
                {c.changeType !== "none" && c.currentSummary && (
                  <div className="mt-1 text-[12px] text-[#6b7280]">
                    Currently: {c.currentSummary}
                  </div>
                )}
                <div className="mt-0.5 text-[12px] text-[#374151]">
                  {c.changeType === "none" ? "No change" : `Proposed: ${c.proposedSummary}`}
                </div>
              </div>
            ))}
          </div>
          {proposal.warnings.length > 0 && (
            <ul className="text-[12px] text-amber-700">
              {proposal.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {proposal.canApply && (
              <SrPrimaryButton type="button" disabled={applying} onClick={applyChanges}>
                {applying ? "Applying…" : "Apply Changes"}
              </SrPrimaryButton>
            )}
            <SrOutlineButton type="button" onClick={cancelProposal}>Cancel</SrOutlineButton>
          </div>
        </div>
      )}
    </div>
  );
}
