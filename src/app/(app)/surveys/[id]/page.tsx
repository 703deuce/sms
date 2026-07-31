"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Question = { id: string; text: string; type: string; options?: string[] };

export default function SurveyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Array<{ id: string; phone?: string; answers: Record<string, unknown>; submittedAt: string }>>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/surveys/${id}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j.data;
        if (!s) return;
        setName(s.name);
        setDescription(s.description || "");
        setStatus(s.status);
        setQuestions((s.questions as Question[]) || []);
        setResponses(s.responses || []);
      });
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    setSaving(true);
    await fetch(`/api/surveys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, status, questions }),
    });
    setSaving(false);
    load();
  }

  function addQuestion() {
    setQuestions((q) => [
      ...q,
      { id: `q${Date.now()}`, text: "How satisfied are you?", type: "choice", options: ["Great", "OK", "Poor"] },
    ]);
  }

  function exportCsv() {
    const header = "phone,submittedAt,answers";
    const lines = responses.map((r) =>
      `${r.phone || ""},${r.submittedAt},${JSON.stringify(r.answers)}`,
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${id}.csv`;
    a.click();
  }

  return (
    <div>
      <PageHeader
        title={name || "Survey"}
        description="Edit questions, publish, and review responses."
        actions={
          <div className="flex gap-2">
            <Link
              href="/surveys"
              className="inline-flex h-10 items-center rounded-[10px] border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Back
            </Link>
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Questions</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>Add question</Button>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-[10px] border border-border p-3">
                  <Input
                    value={q.text}
                    onChange={(e) => {
                      const next = [...questions];
                      next[i] = { ...q, text: e.target.value };
                      setQuestions(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <CardTitle>Results ({responses.length})</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Phone</TH>
                <TH>Submitted</TH>
                <TH>Answers</TH>
              </TR>
            </THead>
            <TBody>
              {responses.map((r) => (
                <TR key={r.id}>
                  <TD>{r.phone || "—"}</TD>
                  <TD>{new Date(r.submittedAt).toLocaleString()}</TD>
                  <TD className="max-w-xs truncate text-xs">{JSON.stringify(r.answers)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
