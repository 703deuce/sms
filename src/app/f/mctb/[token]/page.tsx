"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
};

export default function MctbPublicRequestFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ token: t }) => setToken(t));
  }, [params]);

  useEffect(() => {
    if (!token) return;
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
    if (!token) return;
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
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !fields.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-rose-600">
        {error}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className="p-6 text-center">
          <h1 className="text-lg font-semibold">Thank you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspaceName} received your request. We will be in touch soon.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">{workspaceName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us how we can help and we will follow up shortly.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.id} className="block space-y-1.5">
              <span className="text-sm font-medium">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  className="min-h-[96px] w-full rounded-lg border px-3 py-2 text-sm"
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.id]: e.target.value }))
                  }
                />
              ) : (
                <input
                  type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                  className="h-10 w-full rounded-lg border px-3 text-sm"
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.id]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Submit request"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
