"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { listGrowthTabs } from "@/lib/list-growth-tabs";
import { Copy, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type KeywordOption = { id: string; keyword: string; listName: string };
type PhoneOption = { id: string; e164: string; friendlyName: string | null };

type Detail = {
  id: string;
  name: string;
  keywordId: string | null;
  phoneNumberId: string | null;
  phoneE164: string;
  body: string;
  buttonText: string;
  status: string;
  keyword?: string | null;
  listName?: string | null;
  publicUrl?: string;
  buttonHtml?: string;
};

function formatPhoneDisplay(e164: string) {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

export default function TapToJoinEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const presetKeywordId = searchParams.get("keywordId") || "";

  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [name, setName] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [buttonText, setButtonText] = useState("Join our text list");
  const [status, setStatus] = useState("Active");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKeyword = useMemo(
    () => keywords.find((k) => k.id === keywordId),
    [keywords, keywordId],
  );

  const previewPhone = useMemo(() => {
    const pn = phones.find((p) => p.id === phoneNumberId);
    return pn?.e164 || detail?.phoneE164 || "";
  }, [phones, phoneNumberId, detail]);

  useEffect(() => {
    async function loadMeta() {
      const [kwRes, numRes] = await Promise.all([
        fetch("/api/growth/keywords"),
        fetch("/api/phone/numbers"),
      ]);
      if (kwRes.ok) {
        const json = await kwRes.json();
        setKeywords(json.data || []);
        if (isNew) {
          const preset = presetKeywordId && json.data?.find((k: KeywordOption) => k.id === presetKeywordId);
          setKeywordId(preset?.id || json.data?.[0]?.id || "");
        }
      }
      if (numRes.ok) {
        const json = await numRes.json();
        const active = (json.data || []).filter((n: { status: string }) => n.status === "Active");
        setPhones(active);
        if (isNew && active[0]) setPhoneNumberId(active[0].id);
      }
    }
    loadMeta().catch(() => undefined);
  }, [isNew, presetKeywordId]);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const res = await fetch(`/api/growth/tap-to-join/${params.id}`);
      const json = await res.json();
      if (!res.ok) return;
      const d = json.data as Detail;
      setDetail(d);
      setName(d.name);
      setKeywordId(d.keywordId || "");
      setPhoneNumberId(d.phoneNumberId || "");
      setButtonText(d.buttonText);
      setStatus(d.status);
    }
    load().catch(() => undefined);
  }, [isNew, params.id]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = { name, keywordId, phoneNumberId: phoneNumberId || null, buttonText, status };
      const res = await fetch(
        isNew ? "/api/growth/tap-to-join" : `/api/growth/tap-to-join/${params.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      if (isNew) router.replace(`/grow/tap-to-join/${json.data.id}`);
      else setDetail(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = detail?.publicUrl || "";
  const buttonHtml = detail?.buttonHtml || "";

  return (
    <div>
      <PageHeader
        title={isNew ? "Create Tap-to-Join" : "Edit Tap-to-Join"}
        description="Visitors tap your link, their messaging app opens with the keyword ready — they still press Send to join."
      />
      <Tabs items={[...listGrowthTabs]} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-5 p-6">
          <CardTitle>Settings</CardTitle>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP Club Join Link" />
          </div>
          <div>
            <Label htmlFor="keyword">Keyword</Label>
            <Select id="keyword" value={keywordId} onChange={(e) => setKeywordId(e.target.value)}>
              <option value="">Select keyword…</option>
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </Select>
            {keywords.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No keywords yet.{" "}
                <Link href="/grow/keywords" className="text-indigo-600 hover:underline">
                  Create Keyword
                </Link>
              </p>
            ) : null}
          </div>
          {selectedKeyword ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              People who send <strong>{selectedKeyword.keyword}</strong> will join:{" "}
              <strong>{selectedKeyword.listName}</strong>
            </div>
          ) : null}
          <div>
            <Label htmlFor="phone">Sending Number</Label>
            <Select id="phone" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
              <option value="">Default workspace number</option>
              {phones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.friendlyName || p.e164} ({p.e164})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="buttonText">Button Text</Label>
            <Input id="buttonText" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
          </div>
          {!isNew ? (
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
              </Select>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button disabled={saving || !name || !keywordId} onClick={save}>
            <Save className="h-4 w-4" />
            {isNew ? "Create Tap-to-Join" : "Save changes"}
          </Button>

          {!isNew && publicUrl ? (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div>
                <Label>Your Tap-to-Join Link</Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={publicUrl} />
                  <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                </div>
              </div>
              {buttonHtml ? (
                <div>
                  <Label>Button code</Label>
                  <div className="mt-1 flex gap-2">
                    <Input readOnly value={buttonHtml} />
                    <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(buttonHtml)}>
                      Copy Button Code
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <CardTitle className="mb-4">Mobile preview</CardTitle>
          <div className="mx-auto max-w-[260px] rounded-[2rem] border border-slate-300 bg-white p-4 shadow-sm">
            <p className="mb-3 text-center text-xs font-medium text-slate-500">Messages</p>
            <div className="rounded-lg bg-slate-100 p-3 text-sm">
              <p className="text-xs text-slate-500">To:</p>
              <p className="font-medium">{previewPhone ? formatPhoneDisplay(previewPhone) : "+1 (571) …"}</p>
              <p className="mt-3 rounded-2xl bg-indigo-600 px-3 py-2 text-white">
                {selectedKeyword?.keyword || detail?.body || "VIP"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            When someone taps your link, their messaging app opens with this message ready to send.
          </p>
        </Card>
      </div>
    </div>
  );
}
