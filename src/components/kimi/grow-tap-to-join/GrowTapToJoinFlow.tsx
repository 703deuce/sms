/**
 * Kimi session 2026-08-31T00-27-02-636Z-5893e5 — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { listGrowthTabs } from "@/lib/list-growth-tabs";
import LinksListPage from "./components/LinksListPage";
import CreateLinkPage from "./components/CreateLinkPage";
import LinkSuccessCard from "./components/LinkSuccessCard";
import FallbackFormPreview from "./components/FallbackFormPreview";
import { keywords as initialKeywords, tapLinks as initialLinks, TapLink } from "./mock-data";

type View =
  | { name: "links" }
  | { name: "create"; prefillKeyword?: string }
  | { name: "success"; link: TapLink }
  | { name: "fallback" };

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
    <div className="ttj-root">
      <main className="ttj-main">
        {view.name === "links" && <Tabs items={[...listGrowthTabs]} />}
        {view.name === "links" && (
          <LinksListPage
            links={links}
            onCreate={() => setView({ name: "create" })}
            onEdit={(link) => setView({ name: "create" })}
            onDelete={handleDelete}
            onClone={handleClone}
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
