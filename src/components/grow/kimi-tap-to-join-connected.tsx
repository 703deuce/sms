/**
 * Backend adapter shell for Kimi grow-tap-to-join.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import LinksListPage from "@/components/kimi/grow-tap-to-join/components/LinksListPage";
import CreateLinkPage from "@/components/kimi/grow-tap-to-join/components/CreateLinkPage";
import LinkSuccessCard from "@/components/kimi/grow-tap-to-join/components/LinkSuccessCard";
import FallbackFormPreview from "@/components/kimi/grow-tap-to-join/components/FallbackFormPreview";
import { Tabs } from "@/components/ui/tabs";
import { listGrowthTabs } from "@/lib/list-growth-tabs";
import type { TapLink, Keyword } from "@/components/kimi/grow-tap-to-join/mock-data";
import {
  createTapLink,
  deleteTapLink,
  fetchTapKeywords,
  fetchTapLinks,
  updateTapLink,
} from "@/lib/growth/kimi-tap-to-join-adapter";
import { loadDefaultSendingNumber } from "@/lib/campaigns/kimi-campaigns-adapter";
import { useSearchParams } from "next/navigation";

type View =
  | { name: "links" }
  | { name: "create"; prefillKeyword?: string }
  | { name: "edit"; link: TapLink }
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
      if (view.name === "edit") {
        const updated = await updateTapLink(view.link.id, {
          name: link.name,
          keyword: link.keyword,
          status: link.status,
        });
        setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        setView({ name: "links" });
        return;
      }
      const created = await createTapLink({
        name: link.name,
        keyword: link.keyword,
        phoneE164: defaultNumber || link.number,
      });
      setLinks((prev) => [created, ...prev]);
      setView({ name: "success", link: created });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save link");
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
      <main className="ttj-main">
        {view.name === "links" && <Tabs items={[...listGrowthTabs]} />}
        {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
        {view.name === "links" && (
          <LinksListPage
            links={links}
            onCreate={() => setView({ name: "create" })}
            onEdit={(link) => setView({ name: "edit", link })}
            onDelete={(id) => void handleDelete(id)}
            onClone={handleClone}
          />
        )}
        {(view.name === "create" || view.name === "edit") && (
          <CreateLinkPage
            keywords={keywords}
            prefillKeyword={view.name === "create" ? view.prefillKeyword : undefined}
            initialLink={view.name === "edit" ? view.link : undefined}
            defaultNumber={defaultNumber}
            onSave={(link) => void handleSave(link)}
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
