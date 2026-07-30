"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

type ConsentRow = {
  id: string;
  phone: string;
  source: string;
  consentDate: string;
  disclosureVersion?: string | null;
  disclosureText?: string | null;
  ipAddress?: string | null;
  formUrl?: string | null;
  doubleOptInStatus?: string | null;
  contact?: { firstName?: string | null; lastName?: string | null; status?: string } | null;
};

export default function ConsentPage() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/compliance/consent")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setRows(json?.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Consent records"
        description="Evidence for carrier review: phone, consent language, timestamp, IP, form URL, source, and double opt-in status."
      />
      <Tabs items={complianceTabs} />

      <Card className="overflow-hidden p-0">
        {loading && <p className="p-6 text-sm text-slate-500">Loading…</p>}
        {!loading && (
          <Table>
            <THead>
              <TR>
                <TH>Phone</TH>
                <TH>Source</TH>
                <TH>When</TH>
                <TH>Disclosure</TH>
                <TH>IP</TH>
                <TH>Double opt-in</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.phone}</TD>
                  <TD>{r.source}</TD>
                  <TD>{new Date(r.consentDate).toLocaleString()}</TD>
                  <TD className="max-w-[220px] truncate text-xs text-slate-600">
                    {r.disclosureVersion || "—"} · {r.disclosureText || "—"}
                  </TD>
                  <TD className="text-xs">{r.ipAddress || "—"}</TD>
                  <TD>{r.doubleOptInStatus || "—"}</TD>
                </TR>
              ))}
              {rows.length === 0 && (
                <TR>
                  <TD colSpan={6} className="text-slate-500">
                    No consent records yet. Keyword joins and form submissions create them automatically.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
