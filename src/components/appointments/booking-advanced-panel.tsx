"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Copy, ExternalLink, Link2, Code } from "lucide-react";

type SingleUseLink = {
  id: string;
  token: string;
  appointmentTypeId: string;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
};

type Props = {
  workspaceSlug: string;
};

export function BookingAdvancedPanel({ workspaceSlug }: Props) {
  const [embedUrl, setEmbedUrl] = useState("");
  const [popupScript, setPopupScript] = useState("");
  const [links, setLinks] = useState<SingleUseLink[]>([]);
  const [typeId, setTypeId] = useState("");
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [linksRes, typesRes] = await Promise.all([
      fetch("/api/appointments/booking-links"),
      fetch("/api/appointments/types"),
    ]);
    if (linksRes.ok) {
      const json = await linksRes.json();
      setEmbedUrl(json.data?.embedUrl || "");
      setPopupScript(json.data?.popupScript || "");
      setLinks(json.data?.links || []);
    }
    if (typesRes.ok) {
      const json = await typesRes.json();
      setTypes((json.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createLink() {
    if (!typeId) return;
    await fetch("/api/appointments/booking-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentTypeId: typeId, maxUses: 1 }),
    });
    await load();
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedIframe = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="720" frameborder="0" title="Book appointment"></iframe>`
    : "";

  if (loading) return <Card className="p-5 animate-pulse h-48" />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle className="mb-3 flex items-center gap-2">
          <Code className="h-4 w-4" /> Inline embed
        </CardTitle>
        <p className="text-[13px] text-muted-foreground mb-3">
          Embed booking on your website with an iframe.
        </p>
        <textarea
          className="w-full rounded-lg border border-border bg-muted/30 p-3 text-[12px] font-mono"
          rows={3}
          readOnly
          value={embedIframe}
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => copy(embedIframe, "embed")}>
            <Copy className="h-3.5 w-3.5" />
            {copied === "embed" ? "Copied" : "Copy embed code"}
          </Button>
          {embedUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={embedUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </a>
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Popup widget
        </CardTitle>
        <textarea
          className="w-full rounded-lg border border-border bg-muted/30 p-3 text-[12px] font-mono"
          rows={2}
          readOnly
          value={popupScript}
        />
        <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(popupScript, "popup")}>
          <Copy className="h-3.5 w-3.5" />
          {copied === "popup" ? "Copied" : "Copy popup script"}
        </Button>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-3">Single-use booking links</CardTitle>
        <div className="flex gap-2 mb-4">
          <select
            className="input flex-1"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
          >
            <option value="">Select appointment type</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button size="sm" onClick={createLink} disabled={!typeId}>Create link</Button>
        </div>
        {links.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No single-use links yet.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => {
              const url = `${origin}/book/${workspaceSlug}?singleUse=${link.token}&type=${link.appointmentTypeId}`;
              return (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px]">
                  <span className="truncate font-mono">{url}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {link.usedCount}/{link.maxUses} uses
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => copy(url, link.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
