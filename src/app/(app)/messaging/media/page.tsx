"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function MediaLibraryPage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; assetType: string; storageUrl: string }>>([]);
  const [name, setName] = useState("Promo image");
  const [url, setUrl] = useState("");

  function load() {
    fetch("/api/media").then((r) => r.json()).then((j) => setRows(j.data || []));
  }

  useEffect(() => { load(); }, []);

  async function add() {
    await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, storageUrl: url, assetType: "image" }),
    });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Media library"
        description="Images, GIFs, video, and PDFs for MMS campaigns and inbox attachments."
      />
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Public URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
        <div className="flex items-end"><Button onClick={add}><Plus className="h-4 w-4" /> Add asset</Button></div>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Type</TH><TH>URL</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD>{r.assetType}</TD>
                <TD className="max-w-xs truncate text-xs font-mono">{r.storageUrl}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
