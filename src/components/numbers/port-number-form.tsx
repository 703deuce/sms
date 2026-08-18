"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { numberTabs } from "@/lib/number-tabs";
import { PORT_STATUSES, portStatusLabel } from "@/lib/numbers/port-constants";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PortDoc = {
  id: string;
  label: string;
  required: boolean;
  status: "missing" | "uploaded" | "waived";
  uploadedAt?: string | null;
  note?: string | null;
};

type PortHistory = {
  status: string;
  at: string;
  note?: string | null;
};

type PortRow = {
  id: string;
  phone: string;
  status: string;
  statusLabel?: string;
  currentCarrier?: string | null;
  rejectionReason?: string | null;
  focDate?: string | null;
  temporaryForwardNumber?: string | null;
  numberType?: string | null;
  createdAt: string;
  statusHistory?: PortHistory[];
  documents?: PortDoc[];
};

export function PortNumberForm({ variant = "business" }: { variant?: "business" | "personal" }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState("pending");
  const [statusNote, setStatusNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [focDate, setFocDate] = useState("");
  const [tempForward, setTempForward] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const selected = ports.find((p) => p.id === selectedId) || null;

  const loadPorts = useCallback(async () => {
    const res = await fetch("/api/numbers/port");
    const json = await res.json();
    if (res.ok) setPorts(json.data || []);
  }, []);

  useEffect(() => {
    loadPorts().catch(() => undefined);
  }, [loadPorts]);

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status);
    setRejectionReason(selected.rejectionReason || "");
    setFocDate(selected.focDate ? selected.focDate.slice(0, 10) : "");
    setTempForward(selected.temporaryForwardNumber || "");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPort(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/numbers/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: String(form.get("phoneNumber") || "").trim(),
          currentCarrier: String(form.get("currentCarrier") || "").trim(),
          accountNumber: String(form.get("accountNumber") || "").trim(),
          accountPin: String(form.get("accountPin") || "").trim(),
          billingPhone: String(form.get("billingPhone") || "").trim(),
          businessName: String(form.get("businessName") || "").trim(),
          address: String(form.get("serviceAddress") || "").trim(),
          authorizedName: String(form.get("authorizedName") || "").trim(),
          numberType: String(form.get("numberType") || "local").trim(),
          notes: String(form.get("notes") || "").trim(),
          temporaryForwardNumber: String(form.get("temporaryForwardNumber") || "").trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit port request");
      setSuccess("Port request submitted. Track status below — completion is never automatic.");
      e.currentTarget.reset();
      await loadPorts();
      if (json.data?.id) setSelectedId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveStatus() {
    if (!selected) return;
    setSavingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/numbers/port", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status: statusDraft,
          note: statusNote || undefined,
          rejectionReason: statusDraft === "rejected" ? rejectionReason : undefined,
          focDate: focDate || null,
          temporaryForwardNumber: tempForward || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      setStatusNote("");
      await loadPorts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingStatus(false);
    }
  }

  async function markDoc(docId: string, status: PortDoc["status"]) {
    if (!selected?.documents) return;
    const documents = selected.documents.map((d) =>
      d.id === docId
        ? {
            ...d,
            status,
            uploadedAt: status === "uploaded" ? new Date().toISOString() : d.uploadedAt,
          }
        : d,
    );
    const res = await fetch("/api/numbers/port", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        action: "update_documents",
        documents,
      }),
    });
    if (res.ok) await loadPorts();
  }

  const isPersonal = variant === "personal";

  return (
    <div>
      {!isPersonal ? (
        <>
          <PageHeader
            title="Port a number"
            description="Submit and track port requests with a real status timeline. FOC dates and completion are only set when confirmed."
            actions={
              <Link href="/numbers">
                <Button variant="outline">Back to numbers</Button>
              </Link>
            }
          />

          <Tabs items={numberTabs} />
        </>
      ) : null}

      <div className={isPersonal ? "" : "grid gap-6 xl:grid-cols-3"}>
        <Card className={isPersonal ? "" : "xl:col-span-2"}>
          <CardTitle>New port request</CardTitle>
          {success ? <p className="mt-4 text-sm text-violet-600">{success}</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
          <form className="mt-4 space-y-4" onSubmit={submitPort}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phoneNumber">Phone number to port</Label>
                <Input id="phoneNumber" name="phoneNumber" placeholder="+1 (555) 555-0100" required />
              </div>
              <div>
                <Label htmlFor="numberType">Number type</Label>
                <Select id="numberType" name="numberType" defaultValue="local">
                  <option value="local">Local</option>
                  <option value="tollfree">Toll-free</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="currentCarrier">Current carrier</Label>
                <Input id="currentCarrier" name="currentCarrier" placeholder="e.g. Verizon Business" />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account number</Label>
                <Input id="accountNumber" name="accountNumber" placeholder="Carrier account ID" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="accountPin">Account PIN / passcode</Label>
                <Input id="accountPin" name="accountPin" type="password" placeholder="If required" />
              </div>
              <div>
                <Label htmlFor="billingPhone">Billing telephone number</Label>
                <Input id="billingPhone" name="billingPhone" placeholder="On file with carrier" />
              </div>
            </div>

            <div>
              <Label htmlFor="businessName">Business name on account</Label>
              <Input id="businessName" name="businessName" placeholder="Legal business name" />
            </div>

            <div>
              <Label htmlFor="serviceAddress">Service address</Label>
              <Textarea
                id="serviceAddress"
                name="serviceAddress"
                placeholder="Street, city, state, ZIP — must match carrier records"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="authorizedName">Authorized signatory</Label>
                <Input id="authorizedName" name="authorizedName" placeholder="Full name" />
              </div>
              <div>
                <Label htmlFor="temporaryForwardNumber">Temporary forward (optional)</Label>
                <Input
                  id="temporaryForwardNumber"
                  name="temporaryForwardNumber"
                  placeholder="+1 number during cutover"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Additional notes</Label>
              <Textarea id="notes" name="notes" placeholder="Partial ports, special routing…" rows={3} />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit port request"}
            </Button>
          </form>
        </Card>

        {!isPersonal ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>What to expect</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Status advances only when ops/carrier confirm each stage</li>
              <li>FOC date appears only after carrier confirmation</li>
              <li>Keep current carrier service active until status is Completed</li>
              <li>Required docs must be marked before carrier submission</li>
            </ul>
          </Card>
        </div>
        ) : null}
      </div>

      {!isPersonal ? (
      <Card className="mt-6">
        <CardTitle>Porting status center</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a request to see timeline, documents, rejection reason, FOC, and temporary forward.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {ports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No port requests yet.</p>
            ) : (
              ports.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === p.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.phone}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.statusLabel || portStatusLabel(p.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.currentCarrier || "Carrier TBD"} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          {selected ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">{selected.phone}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.statusLabel || portStatusLabel(selected.status)}
                  {selected.focDate
                    ? ` · FOC ${new Date(selected.focDate).toLocaleDateString()}`
                    : " · FOC not confirmed"}
                </p>
                {selected.rejectionReason ? (
                  <p className="mt-2 text-sm text-rose-600">Rejection: {selected.rejectionReason}</p>
                ) : null}
                {selected.temporaryForwardNumber ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Temp forward: {selected.temporaryForwardNumber}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status timeline
                </p>
                <ol className="space-y-2 border-l border-border pl-3">
                  {(selected.statusHistory || []).map((h, i) => (
                    <li key={`${h.at}-${i}`} className="text-sm">
                      <span className="font-medium">{portStatusLabel(h.status)}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {new Date(h.at).toLocaleString()}
                      </span>
                      {h.note ? <p className="text-xs text-muted-foreground">{h.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Documents checklist
                </p>
                <ul className="space-y-2">
                  {(selected.documents || []).map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        {d.label}
                        {d.required ? " *" : ""}
                        <span className="ml-2 text-xs text-muted-foreground">{d.status}</span>
                      </span>
                      <span className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => markDoc(d.id, "uploaded")}
                        >
                          Uploaded
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => markDoc(d.id, "missing")}
                        >
                          Missing
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Advance status (ops)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Status</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                    >
                      {PORT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {portStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>FOC date (only when confirmed)</Label>
                    <Input
                      type="date"
                      value={focDate}
                      onChange={(e) => setFocDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Temporary forward number</Label>
                  <Input value={tempForward} onChange={(e) => setTempForward(e.target.value)} />
                </div>
                {statusDraft === "rejected" ? (
                  <div>
                    <Label>Rejection reason</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                ) : null}
                <div>
                  <Label>Note for timeline</Label>
                  <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                </div>
                <Button type="button" onClick={saveStatus} disabled={savingStatus}>
                  {savingStatus ? "Saving…" : "Update port status"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Completed is never set automatically — only when you choose that status after cutover.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a port request to manage it.</p>
          )}
        </div>
      </Card>
      ) : null}
    </div>
  );
}
