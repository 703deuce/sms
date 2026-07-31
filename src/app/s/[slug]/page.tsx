"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Question = { id: string; text: string; type: string; options?: string[] };

type SurveyData = {
  name: string;
  description?: string | null;
  surveyType: string;
  questions: Question[];
};

export default function PublicSurveyPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/surveys/${slug}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Survey not found");
        return json.data as SurveyData;
      })
      .then(setSurvey)
      .catch((err) => setError(err instanceof Error ? err.message : "Survey not found"));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/surveys/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, phone: phone.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setDone(json.thankYouMessage || "Thank you!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !survey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!survey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-muted-foreground">Loading survey…</p>
      </main>
    );
  }

  const questions = survey.questions || [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{survey.name}</h1>
          {survey.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{survey.description}</p>
          ) : null}

          {done ? (
            <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-6 text-center">
              <p className="text-base font-medium text-emerald-800">{done}</p>
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              {questions.map((q) => (
                <div key={q.id}>
                  <Label htmlFor={q.id}>{q.text}</Label>
                  {q.type === "text" || q.type === "nps" ? (
                    <Input
                      id={q.id}
                      className="mt-1"
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                      required
                    />
                  ) : q.options?.length ? (
                    <div className="mt-2 space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() =>
                              setAnswers((a) => ({ ...a, [q.id]: opt }))
                            }
                            required={!answers[q.id]}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      id={q.id}
                      className="mt-1"
                      rows={3}
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                      required
                    />
                  )}
                </div>
              ))}

              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  className="mt-1"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit response"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Powered by Transovo</p>
      </div>
    </main>
  );
}
