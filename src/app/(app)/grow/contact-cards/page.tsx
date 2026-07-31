"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { buildVCard } from "@/lib/contact-cards/vcard";
import { useEffect, useState } from "react";
import { growTabs } from "@/lib/grow-tabs";

export default function ContactCardsPage() {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [vcard, setVcard] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/contact-card")
      .then((r) => r.json())
      .then((j) => {
        const d = j.data;
        if (!d) return;
        setBusinessName(d.businessName || "");
        setPhone(d.phone || "");
        setWebsite(d.website || "");
        setEmail(d.email || "");
        setAddress(d.address || "");
        setLogoUrl(d.logoUrl || "");
        if (d.businessName) {
          setVcard(buildVCard(d));
        }
      });
  }, []);

  function downloadVcf() {
    const card = buildVCard({
      businessName,
      phone,
      website,
      email,
      address,
      logoUrl,
    });
    const blob = new Blob([card], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.trim() || "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/contact-card", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, phone, website, email, address, logoUrl }),
    });
    const json = await res.json();
    if (json.data?.vcard) setVcard(json.data.vcard);
    setSaving(false);
  }

  return (
    <div>
      <PageHeader
        title="Contact cards"
        description="Branded vCard for welcome messages so recipients can save your business in one tap."
      />
      <Tabs items={growTabs} />
      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <Label>Business name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Logo URL</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save contact card"}</Button>
          <Button variant="outline" onClick={downloadVcf} disabled={!businessName.trim()}>
            Download .vcf
          </Button>
        </div>
      </Card>
      {vcard ? (
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold">vCard preview</p>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{vcard}</pre>
        </Card>
      ) : null}
    </div>
  );
}
