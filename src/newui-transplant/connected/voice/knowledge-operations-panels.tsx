"use client";

import { FileText, Globe, HelpCircle, RefreshCw, Upload } from "lucide-react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import type { KnowledgeGapRow, KnowledgeSourceRow } from "./use-voice-knowledge-operations";

export function VoiceKnowledgeGapsPanel({
  gaps,
  onDismissGap,
  onResolveGap,
}: {
  gaps: KnowledgeGapRow[];
  onDismissGap: (id: string) => Promise<void>;
  onResolveGap: (id: string, answer: string) => Promise<void>;
}) {
  return (
    <section aria-labelledby="knowledge-gaps-heading" className="rounded-xl border border-warning/40 bg-warning/5">
      <div className="flex items-center justify-between border-b border-warning/30 px-5 py-3">
        <h2 id="knowledge-gaps-heading" className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="size-4 text-warning" aria-hidden="true" />
          Needs your review
        </h2>
        <span className="text-xs text-muted-foreground">
          Questions callers asked that your receptionist could not answer
        </span>
      </div>
      {gaps.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">No open knowledge gaps right now.</p>
      ) : (
        <ul className="divide-y divide-warning/20">
          {gaps.map((gap) => (
            <li
              key={gap.id}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{gap.question}</p>
                <p className="text-xs text-muted-foreground">
                  Asked {gap.asked}× · last {gap.last}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => void onDismissGap(gap.id)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const answer = window.prompt(`Approved answer for:\n${gap.question}`);
                    if (answer?.trim()) void onResolveGap(gap.id, answer.trim());
                  }}
                >
                  Add answer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VoiceKnowledgeSourcesPanel({
  sources,
  crawlSummary,
  websiteUrl,
  onRecrawl,
  onUploadClick,
}: {
  sources: KnowledgeSourceRow[];
  crawlSummary?: string;
  websiteUrl?: string;
  onRecrawl: () => Promise<void>;
  onUploadClick: () => void;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Website crawl" description="Import pages so your receptionist can answer from your site">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {websiteUrl?.trim() ? websiteUrl : "Add a website URL in Setup to enable crawling."}
          </p>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={!websiteUrl?.trim()}
            onClick={() => void onRecrawl()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Re-crawl
          </Button>
        </div>
        {crawlSummary ? (
          <p className="mt-2 text-xs text-muted-foreground">{crawlSummary}</p>
        ) : null}
      </Panel>

      <Panel
        title="Knowledge sources"
        action={
          <Button size="sm" variant="outline" type="button" onClick={onUploadClick}>
            <Upload className="size-4" aria-hidden="true" />
            Upload
          </Button>
        }
        bodyClassName="p-0"
      >
        {sources.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No indexed sources yet. Connect a knowledge base in Setup or upload a document.
          </p>
        ) : (
          <ul className="divide-y">
            {sources.map((s) => {
              const Icon = s.icon === "globe" ? Globe : FileText;
              return (
                <li key={s.name} className="flex items-center gap-3 px-5 py-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.meta}</p>
                  </div>
                  <Pill tone="success">{s.status}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
