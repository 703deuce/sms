"use client";

import { useState } from "react";
import KeywordsPage from "./components/KeywordsPage";
import LinksListPage from "./components/LinksListPage";
import CreateLinkPage from "./components/CreateLinkPage";
import LinkSuccessCard from "./components/LinkSuccessCard";
import FallbackFormPreview from "./components/FallbackFormPreview";
import { keywords as initialKeywords, tapLinks as initialLinks, TapLink } from "./mock-data";

type View =
  | { name: "links" }
  | { name: "keywords" }
  | { name: "create"; prefillKeyword?: string }
  | { name: "success"; link: TapLink }
  | { name: "fallback" };

/**
 * Kimi session 2026-08-31T00-27-02-636Z-5893e5 — UI from Kimi draft (mock data, no backend wiring yet).
 */
export default function GrowTapToJoinFlow() {
  const [view, setView] = useState<View>({ name: "links" });
  const [links, setLinks] = useState<TapLink[]>(initialLinks);

  const handleSave = (link: TapLink) => {
    setLinks((prev) => [link, ...prev]);
    setView({ name: "success", link });
  };

  const handleDelete = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClone = (link: TapLink) => {
    const copy: TapLink = {
      ...link,
      id: `link-${Date.now()}`,
      name: `${link.name} (Copy)`,
      createdAt: "Just now",
      all: 0,
      unique: 0,
      bot: 0,
    };
    setLinks((prev) => [copy, ...prev]);
  };

  return (
    <div className="ttj-root flex min-h-full flex-col">
      <div className="flex gap-2 border-b border-border bg-card px-6 py-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${view.name === "links" || view.name === "create" || view.name === "success" || view.name === "fallback" ? "bg-indigo-50 text-indigo-600" : "text-muted-foreground"}`}
          onClick={() => setView({ name: "links" })}
        >
          Tap-to-Join Links
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${view.name === "keywords" ? "bg-indigo-50 text-indigo-600" : "text-muted-foreground"}`}
          onClick={() => setView({ name: "keywords" })}
        >
          Keywords
        </button>
      </div>
      <main className="ttj-main flex-1">
        {view.name === "links" && (
          <LinksListPage
            links={links}
            onCreate={() => setView({ name: "create" })}
            onDelete={handleDelete}
            onClone={handleClone}
            onOpenFallback={() => setView({ name: "fallback" })}
          />
        )}
        {view.name === "keywords" && (
          <KeywordsPage
            keywords={initialKeywords}
            onCreateTapLink={(kw) => setView({ name: "create", prefillKeyword: kw })}
          />
        )}
        {view.name === "create" && (
          <CreateLinkPage
            keywords={initialKeywords}
            prefillKeyword={view.prefillKeyword}
            onSave={handleSave}
            onBack={() => setView({ name: "links" })}
          />
        )}
        {view.name === "success" && (
          <LinkSuccessCard
            link={view.link}
            onBack={() => setView({ name: "links" })}
          />
        )}
        {view.name === "fallback" && (
          <FallbackFormPreview onClose={() => setView({ name: "links" })} />
        )}
      </main>
    </div>
  );
}
