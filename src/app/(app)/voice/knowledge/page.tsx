"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Source = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  chunkCount: number | null;
};

type KbDetail = {
  id: string;
  name: string;
  status: string;
  telnyxBucketName?: string | null;
  telnyxEmbeddingStatus?: string | null;
  sources: Source[];
};

export default function VoiceKnowledgePage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [name, setName] = useState("Business FAQ");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<KbDetail | null>(null);
  const [sourceText, setSourceText] = useState("Our business hours are 9am to 5pm Monday through Friday.");
  const [sourceUrl, setSourceUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("hours");
  const [searchHits, setSearchHits] = useState<Array<{ name: string; snippet: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch("/api/voice/knowledge")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }

  function loadDetail(id: string) {
    setSelectedId(id);
    fetch(`/api/voice/knowledge/${id}`)
      .then((r) => r.json())
      .then((j) => {
        const data = j.data;
        setDetail(data ? { ...data, sources: data.sources || [] } : null);
      });
  }

  useEffect(() => { load(); }, []);

  async function create() {
    const res = await fetch("/api/voice/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    load();
    if (json.data?.id) loadDetail(json.data.id);
  }

  async function addTextSource() {
    if (!selectedId) return;
    await fetch(`/api/voice/knowledge/${selectedId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "FAQ text", sourceType: "text", contentText: sourceText }),
    });
    loadDetail(selectedId);
  }

  async function addUrlSource() {
    if (!selectedId || !sourceUrl) return;
    await fetch(`/api/voice/knowledge/${selectedId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sourceUrl, sourceType: "url", crawlUrl: sourceUrl }),
    });
    loadDetail(selectedId);
  }

  async function uploadFile(file: File) {
    if (!selectedId) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/voice/knowledge/${selectedId}/upload`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      loadDetail(selectedId);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function reindexSource(sourceId: string) {
    if (!selectedId) return;
    await fetch(`/api/voice/knowledge/${selectedId}/sources/${sourceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reindex" }),
    });
    loadDetail(selectedId);
  }

  async function deleteSource(sourceId: string) {
    if (!selectedId) return;
    await fetch(`/api/voice/knowledge/${selectedId}/sources/${sourceId}`, {
      method: "DELETE",
    });
    loadDetail(selectedId);
  }

  async function search() {
    if (!selectedId) return;
    const res = await fetch(`/api/voice/knowledge/${selectedId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery }),
    });
    const json = await res.json();
    setSearchHits(json.data || []);
  }

  const sources = detail?.sources || [];

  return (
    <div>
      <PageHeader title="Knowledge bases" description="Documents, FAQs, and structured facts for agent retrieval." />
      <VoiceSubNav />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={create}><Plus className="h-4 w-4" /> Create</Button>
      </Card>
      <Card className="mb-6 overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Status</TH><TH /></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD>{r.status}</TD>
                <TD>
                  <Button size="sm" variant="outline" onClick={() => loadDetail(r.id)}>Manage</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {selectedId && detail && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3 p-5 lg:col-span-2">
            <h2 className="font-medium">{detail.name}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Status: {detail.status}</span>
              {detail.telnyxBucketName ? (
                <span>Bucket: {detail.telnyxBucketName}</span>
              ) : null}
              {detail.telnyxEmbeddingStatus ? (
                <span>Embeddings: {detail.telnyxEmbeddingStatus}</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Long documents and files are indexed with Telnyx RAG embeddings — content is retrieved at runtime, not stuffed into the prompt.
            </p>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-medium">Add sources</h2>
            <div>
              <Label>Text content</Label>
              <textarea
                className="mt-1 w-full rounded-lg border border-border p-3 text-sm"
                rows={4}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={addTextSource}>Add text source</Button>
            <div>
              <Label>URL to crawl</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/faq" />
            </div>
            <Button variant="outline" onClick={addUrlSource}>Add URL source</Button>

            <div className="border-t border-border pt-4">
              <Label>Upload file (PDF, DOCX, TXT, CSV)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Files are embedded via Telnyx RAG — not added verbatim to agent instructions.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.md,.json,.html,.htm"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1"
                >
                  <Upload className="h-3 w-3" />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
              {uploadError ? <p className="mt-2 text-sm text-danger">{uploadError}</p> : null}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-medium">Test search</h2>
            <div className="flex gap-2">
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <Button onClick={search}><Search className="h-4 w-4" /></Button>
            </div>
            {searchHits.map((h, i) => (
              <div key={i} className="rounded border border-border p-3 text-sm">
                <p className="font-medium">{h.name}</p>
                <p className="text-muted-foreground">{h.snippet}</p>
              </div>
            ))}
          </Card>

          <Card className="overflow-hidden p-0 lg:col-span-2">
            <div className="border-b border-border px-5 py-3 font-medium">Sources</div>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Chunks</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {sources.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.name}</TD>
                    <TD>{s.sourceType}</TD>
                    <TD>{s.status}</TD>
                    <TD>{s.chunkCount ?? "—"}</TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reindexSource(s.id)}
                          className="gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Re-index
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteSource(s.id)}
                          className="gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
