"use client";

import { useState } from "react";
import "./reference.css";
import AppSidebar from "./components/AppSidebar";
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

export default function ReferencePage() {
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
      <AppSidebar
        active={view.name === "keywords" ? "keywords" : "tap-to-join"}
        onNavigate={(key) => {
          if (key === "keywords") setView({ name: "keywords" });
          else if (key === "tap-to-join") setView({ name: "links" });
        }}
      />
      <main className="ttj-main">
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
