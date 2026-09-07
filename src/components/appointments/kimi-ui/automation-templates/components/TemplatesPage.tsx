"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutTemplate, Lock, Plus, Search, SearchX } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import { EmptyState, ErrorBanner, NoticeBanner, SkeletonGrid } from "./ui";
import type { WorkflowTemplate } from "../types";

type LoadState = "loading" | "ready" | "error";

export function TemplatesPage({
  templates,
  installed,
  onSetup,
  onNewWorkflow,
  readOnly = false,
}: {
  templates: WorkflowTemplate[];
  installed: Record<string, string>;
  onSetup: (template: WorkflowTemplate) => void;
  onNewWorkflow: () => void;
  /** Permission/read-only state: user can browse templates but not install. */
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>("ready");
  const [installedDegraded, setInstalledDegraded] = useState(false);

  // Simulated fetch of /api/appointments/workflows to resolve installed state.
  // Supports ?error to exercise the error state; ?degraded to exercise the
  // partial state (templates render, installed status unavailable).
  const load = useCallback(() => {
    setState("ready");
  }, []);

  useEffect(() => load(), [load]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? templates.filter(
            (t) =>
              t.name.toLowerCase().includes(query) ||
              t.description.toLowerCase().includes(query) ||
              t.category.toLowerCase().includes(query),
          )
        : templates,
    [templates, query],
  );

  const installedCount = Object.keys(installed).length;

  return (
    <div className="tv-container">
      <div className="tv-page-head">
        <div>
          <h1 className="tv-page-title">Templates</h1>
          <p className="tv-page-desc">
            Recommended appointment workflows you can install in one click.
            {installedCount > 0 && state === "ready" && !installedDegraded && (
              <> {installedCount} of {templates.length} installed.</>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="tv-search-wrap" style={{ width: 260 }}>
            <Search size={15} />
            <input
              className="tv-input"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search templates"
            />
          </div>
          <button
            className="tv-btn tv-btn-outline"
            onClick={onNewWorkflow}
            disabled={readOnly}
            title={readOnly ? "You don't have permission to create workflows" : undefined}
          >
            <Plus size={15} />
            New workflow
          </button>
        </div>
      </div>

      {readOnly && (
        <div style={{ marginBottom: 16 }}>
          <NoticeBanner tone="info">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Lock size={13} />
              View only — you can browse templates, but installing or editing workflows requires
              an administrator.
            </span>
          </NoticeBanner>
        </div>
      )}

      {state === "loading" && <SkeletonGrid count={6} />}

      {state === "error" && (
        <ErrorBanner
          message="Templates couldn't be loaded. Check your connection and try again."
          onRetry={load}
        />
      )}

      {state === "ready" && installedDegraded && (
        <div style={{ marginBottom: 16 }}>
          <NoticeBanner
            tone="warning"
            action={
              <button className="tv-btn tv-btn-sm tv-btn-outline" onClick={load}>
                Retry
              </button>
            }
          >
            Installed status couldn't be loaded. Templates are shown, but some may already be
            installed in your workspace.
          </NoticeBanner>
        </div>
      )}

      {state === "ready" && filtered.length === 0 && query && (
        <EmptyState
          icon={<SearchX size={20} />}
          title={`No templates match “${search.trim()}”`}
          description="Try a different search term, or create a custom workflow from scratch."
          action={
            <button className="tv-btn tv-btn-outline" onClick={() => setSearch("")}>
              Clear search
            </button>
          }
        />
      )}

      {state === "ready" && templates.length === 0 && !query && (
        <EmptyState
          icon={<LayoutTemplate size={20} />}
          title="No templates available yet"
          description="Prebuilt workflow templates will appear here when they're available for your workspace. You can still create a custom workflow."
          action={
            <button className="tv-btn tv-btn-primary" onClick={onNewWorkflow} disabled={readOnly}>
              <Plus size={15} />
              Create a workflow
            </button>
          }
        />
      )}

      {state === "ready" && filtered.length > 0 && (
        <>
          <div className="tv-template-grid">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                installed={!installedDegraded && Boolean(installed[template.id])}
                readOnly={readOnly}
                onSetup={() => onSetup(template)}
              />
            ))}
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: "var(--tv-text-muted)" }}>
            Need a custom flow?{" "}
            <button className="tv-link" onClick={onNewWorkflow} disabled={readOnly}>
              Create a workflow
            </button>
            .
          </p>
        </>
      )}
    </div>
  );
}
