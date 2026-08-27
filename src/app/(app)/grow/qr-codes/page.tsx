"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { QrCode, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { leadCaptureTabs } from "@/lib/lead-capture-tabs";

type QrRow = {
  id: string;
  name: string;
  targetType: string;
  targetUrl: string;
  scans: number;
};

export default function QrCodesPage() {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [name, setName] = useState("Front desk signup");
  const [targetType, setTargetType] = useState("form");
  const [targetUrl, setTargetUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/growth/qr");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function create() {
    setSaving(true);
    try {
      const res = await fetch("/api/growth/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetType, targetUrl }),
      });
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="QR codes"
        description="Generate QR codes that open signup forms, click-to-text actions, review links, booking links, or promotions."
      />
      <Tabs items={leadCaptureTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="QR codes" value={formatNumber(rows.length)} />
        <StatCard label="Total scans" value={formatNumber(rows.reduce((s, r) => s + r.scans, 0))} />
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          <CardTitle>Create QR code</CardTitle>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="type">Target type</Label>
          <Select id="type" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="form">Signup form</option>
            <option value="click_to_text">Click-to-text</option>
            <option value="review">Review link</option>
            <option value="booking">Booking link</option>
            <option value="payment">Payment link</option>
            <option value="url">Custom URL</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="url">Destination URL</Label>
          <Input
            id="url"
            placeholder="https://… or /f/your-form"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
        </div>
        <Button disabled={saving || !targetUrl} onClick={create}>
          <Plus className="h-4 w-4" />
          Create QR
        </Button>
        <p className="text-xs text-slate-500">
          Tip: use a free QR encoder with the saved URL, or embed{" "}
          <code className="rounded bg-slate-100 px-1">
            https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=URL
          </code>
          .
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Preview</TH>
              <TH>Scans</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.targetType}</TD>
                <TD>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="h-16 w-16 rounded border border-slate-200 bg-white"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(r.targetUrl)}`}
                  />
                </TD>
                <TD>{r.scans}</TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-slate-500">
                  No QR codes yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
