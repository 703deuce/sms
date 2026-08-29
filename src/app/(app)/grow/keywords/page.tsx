"use client";

import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickTableToolbar,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Filter, Hash, List, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

type KeywordRow = {
  id: string;
  keyword: string;
  phoneNumber: string;
  listName: string;
  confirmation: string;
  status: string;
  subscribers: number;
  updatedAt?: string;
};

export default function KeywordsPage() {
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [listName, setListName] = useState("Keyword subscribers");
  const [description, setDescription] = useState("");
  const [confirmation, setConfirmation] = useState(
    "Thanks for subscribing! Reply STOP to opt out. Msg&data rates may apply.",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const res = await fetch("/api/growth/keywords");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function create() {
    if (!keyword.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          listName: listName || "Keyword subscribers",
          confirmation,
          autoReply: confirmation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setKeyword("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        breadcrumb="Tools / Keywords"
        title="Keywords"
        description="View and manage all of your keywords."
        icon={Hash}
      />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          createSlot={
            <Button
              type="button"
              className="h-10 bg-primary px-4 text-[13px] font-semibold"
              onClick={() => setShowCreate(true)}
            >
              Create Keyword
            </Button>
          }
          filterSlot={
            <Button variant="outline" size="sm" className="h-10 gap-2 border-slate-200">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {showCreate ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Create keyword</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded p-1 text-slate-400 hover:bg-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  className="uppercase"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label htmlFor="list">Default list</Label>
                <Input id="list" value={listName} onChange={(e) => setListName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this keyword is for"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="confirm">Auto response</Label>
                <Textarea
                  id="confirm"
                  rows={3}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </div>
            </div>
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button disabled={saving || !keyword.trim()} onClick={create}>
                <Plus className="h-4 w-4" />
                {saving ? "Saving…" : "Save keyword"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <Table className="text-[13px]">
          <THead>
            <TR className="border-slate-200">
              <TH>Keyword</TH>
              <TH>Description</TH>
              <TH>Lists</TH>
              <TH>Creates Contacts</TH>
              <TH className="w-12" />
            </TR>
          </THead>
          <TBody>
            {rows.map((k) => (
              <TR key={k.id} className="border-slate-100">
                <TD>
                  <p className="font-semibold text-slate-900">{k.keyword}</p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    Last saved on {formatSlickDateTime(k.updatedAt || new Date().toISOString())}
                  </p>
                </TD>
                <TD className="max-w-md text-slate-600">{k.confirmation || k.listName || "—"}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <List className="h-3.5 w-3.5" />
                    </span>
                    {k.listName ? "1 Connected List" : "0 Connected Lists"}
                  </span>
                </TD>
                <TD>
                  <span className="inline-flex rounded-full bg-teal-100 px-2.5 py-0.5 text-[12px] font-semibold text-teal-700">
                    Yes
                  </span>
                </TD>
                <TD>
                  <RowActionsMenu
                    actions={[
                      { label: "Edit", icon: "pencil", href: `/grow/keywords?edit=${k.id}` },
                      { label: "Clone", icon: "copy", href: "#" },
                      { label: "Create QR Code", icon: "qr-code", href: "/grow/qr-codes" },
                      {
                        label: "Create Tap-to-Join Link",
                        icon: "link",
                        href: `/grow/tap-to-join/new?keywordId=${k.id}`,
                      },
                      { label: "Delete", icon: "trash", destructive: true, onClick: () => undefined },
                    ]}
                  />
                </TD>
              </TR>
            ))}
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-slate-500">
                  No keywords yet — create one to start collecting opt-ins.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <select className="rounded border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-500">
            <option>25 Per Page</option>
          </select>
        </div>
      </Card>
    </div>
  );
}
