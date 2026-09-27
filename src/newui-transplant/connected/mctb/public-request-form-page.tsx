"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
};

export function MctbPublicRequestFormOpusPage({ token }: { token: string }) {
  const [workspaceName, setWorkspaceName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/mctb-request-form?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Form unavailable");
        setWorkspaceName(json.data.workspaceName);
        setFields(json.data.fields || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/mctb-request-form", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, payload: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submit failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (error && !fields.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Panel className="text-center">
          <h1 className="text-lg font-semibold">Thank you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspaceName} received your request. We will be in touch soon.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Panel>
        <h1 className="text-lg font-semibold">{workspaceName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us how we can help and we will follow up shortly.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`field-${field.id}`}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={`field-${field.id}`}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`field-${field.id}`}
                  type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : null}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Submit request"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
