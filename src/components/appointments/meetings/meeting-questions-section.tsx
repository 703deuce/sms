"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Mail,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import type { BookingQuestion } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  newBookingQuestion,
  QUESTION_TYPE_OPTIONS,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import { Field, Modal, SectionCard, SelectInput, TextInput } from "./meeting-ui";

const TYPE_LABELS = new Map(QUESTION_TYPE_OPTIONS.map((o) => [o.value as string, o.label]));

const CHOICE_TYPES = new Set(["select", "radio", "multiselect"]);

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

type Draft = {
  question: BookingQuestion;
  index: number | null;
  optionsText: string;
};

function optionsToText(q: BookingQuestion): string {
  const opts = (q as { options?: string[] }).options;
  return Array.isArray(opts) ? opts.join("\n") : "";
}

export function MeetingQuestionsSection({ form, onFormChange }: Props) {
  const questions = form.bookingQuestions;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  function commit(next: BookingQuestion[]) {
    onFormChange(
      "bookingQuestions",
      next.map((q, i) => ({ ...q, displayOrder: i })),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function openNew() {
    setError("");
    setDraft({ question: newBookingQuestion() as BookingQuestion, index: null, optionsText: "" });
  }

  function openEdit(index: number) {
    setError("");
    setDraft({ question: { ...questions[index] }, index, optionsText: optionsToText(questions[index]) });
  }

  function saveDraft() {
    if (!draft) return;
    const label = draft.question.label.trim();
    if (!label) {
      setError("Give the question a label.");
      return;
    }
    const options = CHOICE_TYPES.has(draft.question.type)
      ? draft.optionsText
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;
    if (options && options.length < 2) {
      setError("Add at least two choices, one per line.");
      return;
    }
    const saved = { ...draft.question, label, ...(options ? { options } : {}) } as BookingQuestion;
    const next = [...questions];
    if (draft.index === null) next.push(saved);
    else next[draft.index] = saved;
    commit(next);
    setDraft(null);
  }

  return (
    <>
      <SectionCard
        id="meeting-questions"
        title="Booking questions"
        description="What the customer is asked when they book."
        icon={ClipboardList}
        action={
          <button type="button" className="appt-pilot-outline-btn" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add question
          </button>
        }
      >
        <p className="ws-side-card-label">Always collected</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="ws-default-field">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Full name
          </div>
          <div className="ws-default-field">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Email address
          </div>
        </div>

        <p className="ws-side-card-label mt-5">Your questions</p>
        {questions.length === 0 ? (
          <p className="ws-field-hint mt-2">
            None yet. Add a question to collect anything else you need before the meeting.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {questions.map((q, index) => (
              <li key={q.id}>
                <div className="ws-question-row">
                  <span className="ws-question-index" aria-hidden>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="ws-question-label truncate">{q.label || "Untitled question"}</p>
                    <p className="ws-question-meta">
                      {TYPE_LABELS.get(q.type) || q.type}
                      {q.required ? " · Required" : " · Optional"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ws-icon-btn"
                    aria-label={`Move ${q.label || "question"} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="ws-icon-btn"
                    aria-label={`Move ${q.label || "question"} down`}
                    disabled={index === questions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="ws-icon-btn"
                    aria-label={`Edit ${q.label || "question"}`}
                    onClick={() => openEdit(index)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="ws-icon-btn danger"
                    aria-label={`Delete ${q.label || "question"}`}
                    onClick={() => commit(questions.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="ws-add-row mt-3" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden />
          Add question
        </button>
      </SectionCard>

      {draft ? (
        <Modal
          title={draft.index === null ? "Add question" : "Edit question"}
          description="Asked on the booking page before the meeting is confirmed."
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button" className="appt-pilot-primary-btn" onClick={saveDraft}>
                {draft.index === null ? "Add question" : "Save question"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Question" htmlFor="q-label" error={error || undefined}>
              <TextInput
                id="q-label"
                placeholder="What would you like to cover?"
                value={draft.question.label}
                onChange={(e) =>
                  setDraft({ ...draft, question: { ...draft.question, label: e.target.value } })
                }
              />
            </Field>

            <Field label="Answer type" htmlFor="q-type">
              <SelectInput
                id="q-type"
                value={draft.question.type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    question: {
                      ...draft.question,
                      type: e.target.value as BookingQuestion["type"],
                    },
                  })
                }
              >
                {QUESTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {CHOICE_TYPES.has(draft.question.type) ? (
              <Field label="Choices" htmlFor="q-options" hint="One per line.">
                <textarea
                  id="q-options"
                  className="input"
                  rows={4}
                  placeholder={"Option one\nOption two"}
                  value={draft.optionsText}
                  onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
                />
              </Field>
            ) : null}

            <label className="flex items-center gap-2 text-[var(--type-list)] text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={draft.question.required}
                onChange={(e) =>
                  setDraft({ ...draft, question: { ...draft.question, required: e.target.checked } })
                }
              />
              Required to book
            </label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
