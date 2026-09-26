"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Page, PageHeader, Panel, Pill, type Tone } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { mapMctbNumberRowToNewUi, type MctbNumbersApiRow } from "@/lib/newui-transplant/adapters/voice-numbers";

const messagingTone: Record<string, Tone> = {
  Registered: "success",
  "Pending review": "warning",
  "Not enabled": "neutral",
};

export function NewUiVoiceNumbersPage() {
  const [rows, setRows] = useState<MctbNumbersApiRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/mctb/numbers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRows((j.data?.numbers ?? []) as MctbNumbersApiRow[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mapped = rows.map(mapMctbNumberRowToNewUi);

  return (
    <Page>
      <PageHeader
        title="Numbers"
        description="Business lines, forwarded numbers, and text-back senders in this workspace."
        actions={
          <>
            <Button variant="outline" type="button" onClick={load} disabled={loading}>
              <RefreshCw /> Refresh list
            </Button>
            <Button type="button" asChild>
              <a href="/voice/numbers/buy"><Plus /> Add number</a>
            </Button>
          </>
        }
      />
      <Panel bodyClassName="p-0">
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading numbers…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-medium">Number</th>
                  <th scope="col" className="px-3 py-3 font-medium">Label</th>
                  <th scope="col" className="px-3 py-3 font-medium">Type</th>
                  <th scope="col" className="px-3 py-3 font-medium">Messaging status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Line status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mapped.map((n) => (
                  <tr key={n.number}>
                    <td className="px-5 py-3 font-mono text-xs">{n.number}</td>
                    <td className="px-3 py-3">{n.label}</td>
                    <td className="px-3 py-3 text-muted-foreground">{n.type}</td>
                    <td className="px-3 py-3">
                      <Pill tone={messagingTone[n.messaging] ?? "neutral"}>{n.messaging}</Pill>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{n.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
