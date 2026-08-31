/**
 * Backend adapter shell for Kimi grow-tap-to-join.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import AppSidebar from "@/components/kimi/grow-tap-to-join/components/AppSidebar";
import KeywordsPage from "@/components/kimi/grow-tap-to-join/components/KeywordsPage";
import LinksListPage from "@/components/kimi/grow-tap-to-join/components/LinksListPage";
import CreateLinkPage from "@/components/kimi/grow-tap-to-join/components/CreateLinkPage";
import LinkSuccessCard from "@/components/kimi/grow-tap-to-join/components/LinkSuccessCard";
import FallbackFormPreview from "@/components/kimi/grow-tap-to-join/components/FallbackFormPreview";
import type { TapLink, Keyword } from "@/components/kimi/grow-tap-to-join/mock-data";
import {
  createTapLink,
  deleteTapLink,
  fetchTapKeywords,
  fetchTapLinks,
} from "@/lib/growth/kimi-tap-to-join-adapter";
import { loadDefaultSendingNumber } from "@/lib/campaigns/kimi-campaigns-adapter";
import { useSearchParams } from "next/navigation";

type View =
  | { name: "links" }
  | { name: "keywords" }
  | { name: "create"; prefillKeyword?: string }
  | { name: "success"; link: TapLink }
  | { name: "fallback" };

export function KimiTapToJoinConnected() {
  const searchParams = useSearchParams();
  const prefillFromQuery = searchParams.get("keyword") ?? undefined;
  const [view, setView] = useState<View>(
    prefillFromQuery ? { name: "create", prefillKeyword: prefillFromQuery } : { name: "links" },
  );
  const [links, setLinks] = useState<TapLink[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [defaultNumber, setDefaultNumber] = useState<string>("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [l, k, num] = await Promise.all([
      fetchTapLinks(),
      fetchTapKeywords(),
      loadDefaultSendingNumber(),
    ]);
    setLinks(l);
    setKeywords(k);
    if (num?.number) setDefaultNumber(num.number);
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const handleSave = async (link: TapLink) => {
    setError("");
    try {
      const created = await createTapLink({
        name: link.name,
        keyword: link.keyword,
        phoneE164: defaultNumber || link.number,
      });
      setLinks((prev) => [created, ...prev]);
      setView({ name: "success", link: created });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteTapLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete link");
    }
  };

  const handleClone = (link: TapLink) => {
    void createTapLink({
      name: `${link.name} (Copy)`,
      keyword: link.keyword,
      phoneE164: link.number || defaultNumber,
    })
      .then((created) => setLinks((prev) => [created, ...prev]))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not clone link"));
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
        {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
        {view.name === "links" && (
          <LinksListPage
            links={links}
            onCreate={() => setView({ name: "create" })}
            onDelete={(id) => void handleDelete(id)}
            onClone={handleClone}
            onOpenFallback={() => setView({ name: "fallback" })}
          />
        )}
        {view.name === "keywords" && (
          <KeywordsPage
            keywords={keywords}
            onCreateTapLink={(kw) => setView({ name: "create", prefillKeyword: kw })}
          />
        )}
        {view.name === "create" && (
          <CreateLinkPage
            keywords={keywords}
            prefillKeyword={view.prefillKeyword}
            defaultNumber={defaultNumber}
            onSave={handleSave}
            onBack={() => setView({ name: "links" })}
          />
        )}
        {view.name === "success" && (
          <LinkSuccessCard link={view.link} onBack={() => setView({ name: "links" })} />
        )}
        {view.name === "fallback" && (
          <FallbackFormPreview onClose={() => setView({ name: "links" })} />
        )}
      </main>
    </div>
  );
}
