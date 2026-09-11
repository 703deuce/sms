"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  FileText,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Trash,
  User,
  UserRound,
  Users,
} from "lucide-react";
import type { BookingQuestion } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { ServiceEditorOptions } from "@/features/appointments/kimi/services/use-service-editor";
import {
  newBookingQuestion,
  QUESTION_TYPE_OPTIONS,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import {
  Field,
  Modal,
  NumberField,
  SectionCard,
  SelectInput,
  Switch,
  TextInput,
} from "@/components/appointments/workspace-ui";

const TYPE_LABELS = new Map(QUESTION_TYPE_OPTIONS.map((o) => [o.value as string, o.label]));
const CHOICE_TYPES = new Set(["select", "radio", "multiselect"]);

type Props = {
  form: AppointmentTypeFormState;
  intakeFormOptions: ServiceEditorOptions["intakeFormOptions"];
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onAddIntakeForm: (name: string) => Promise<string | null>;
};

type Draft = { question: BookingQuestion; index: number | null; optionsText: string };

/** Contact fields the public booking form always collects — not configurable. */
const SYSTEM_FIELDS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: string;
}> = [
  { icon: User, label: "First and last name", status: "Required" },
  { icon: Phone, label: "Mobile number", status: "Required" },
  { icon: Mail, label: "Email address", status: "Optional" },
];

export function ServiceCustomerSection({
  form,
  intakeFormOptions,
  onFormChange,
  onAddIntakeForm,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [questionError, setQuestionError] = useState("");
  const [formModal, setFormModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [busy, setBusy] = useState(false);

  const questions = form.bookingQuestions;
  const attached = intakeFormOptions.filter((f) => form.intakeFormIds.includes(f.id));
  const available = intakeFormOptions.filter((f) => !form.intakeFormIds.includes(f.id));

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

  function saveDraft() {
    if (!draft) return;
    const label = draft.question.label.trim();
    if (!label) {
      setQuestionError("Give the question a label.");
      return;
    }
    const options = CHOICE_TYPES.has(draft.question.type)
      ? draft.optionsText.split("\n").map((o) => o.trim()).filter(Boolean)
      : undefined;
    if (options && options.length < 2) {
      setQuestionError("Add at least two choices, one per line.");
      return;
    }
    const saved = { ...draft.question, label, ...(options ? { options } : {}) } as BookingQuestion;
    const next = [...questions];
    if (draft.index === null) next.push(saved);
    else next[draft.index] = saved;
    commit(next);
    setDraft(null);
  }

  async function createForm() {
    setBusy(true);
    const id = await onAddIntakeForm(formName);
    setBusy(false);
    if (!id) return;
    onFormChange("intakeFormIds", [...form.intakeFormIds, id]);
    setFormName("");
    setFormModal(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="ws-section-heading">Customer setup</h2>
        <p className="ws-section-sub">What you ask for, and how many people one booking covers.</p>
      </div>

      <SectionCard
        id="service-contact"
        title="Customer information"
        description="Collected on every booking of every service."
        icon={UserRound}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {SYSTEM_FIELDS.map((f) => (
            <div key={f.label} className="ws-default-field">
              <f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              <span className="ws-locked-tag">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {f.status}
              </span>
            </div>
          ))}
        </div>
        <p className="ws-field-hint mt-3">
          These are built into the booking flow and cannot be turned off. Anything else you need goes
          below.
        </p>
      </SectionCard>

      <SectionCard
        id="service-intake"
        title="Intake forms"
        description="Reusable question sets shared across services."
        icon={FileText}
        action={
          <button type="button" className="ws-text-btn" onClick={() => setFormModal(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Create form
          </button>
        }
      >
        {attached.length === 0 ? (
          <div className="ws-nudge">
            <span className="ws-nudge-icon" aria-hidden>
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                No intake form attached
              </p>
              <p className="ws-field-hint">
                {intakeFormOptions.length === 0
                  ? "Create a form to collect health history, preferences or consent before the appointment."
                  : "Attach an existing form, or create a new one for this service."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {attached.map((f) => (
              <li key={f.id} className="ws-form-card">
                <span className="ws-form-card-icon" aria-hidden>
                  <ClipboardList className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ws-person-name block truncate">{f.name}</span>
                  <span className="ws-person-meta block">
                    {f.fieldCount} question{f.fieldCount === 1 ? "" : "s"} · Shown before booking
                  </span>
                </span>
                {f.active === false ? <span className="ws-chip ws-chip-neutral">Inactive</span> : null}
                <button
                  type="button"
                  className="ws-icon-btn danger shrink-0"
                  aria-label={`Detach ${f.name}`}
                  onClick={() =>
                    onFormChange(
                      "intakeFormIds",
                      form.intakeFormIds.filter((id) => id !== f.id),
                    )
                  }
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 ? (
          <div className="mt-3">
            <Field label="Attach a form" htmlFor="svc-attach-form">
              <SelectInput
                id="svc-attach-form"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  onFormChange("intakeFormIds", [...form.intakeFormIds, e.target.value]);
                }}
              >
                <option value="">Choose a form…</option>
                {available.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.fieldCount} questions)
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        ) : null}

        <p className="ws-field-hint mt-3">
          <Link href="/appointments/booking/contracts" className="appt-pilot-muted-link">
            Manage forms
          </Link>{" "}
          to edit questions, which are shared with every service using the form.
        </p>
      </SectionCard>

      <SectionCard
        id="service-questions"
        title="Booking questions"
        description="Extra questions asked only for this service."
        icon={ClipboardList}
        action={
          <button
            type="button"
            className="ws-text-btn"
            onClick={() => {
              setQuestionError("");
              setDraft({
                question: newBookingQuestion() as BookingQuestion,
                index: null,
                optionsText: "",
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add question
          </button>
        }
      >
        {questions.length === 0 ? (
          <p className="ws-field-hint">
            None yet. Use these for one-off details that do not belong in a reusable form.
          </p>
        ) : (
          <ul className="space-y-2">
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
                    onClick={() => {
                      setQuestionError("");
                      setDraft({
                        question: { ...q },
                        index,
                        optionsText: ((q as { options?: string[] }).options || []).join("\n"),
                      });
                    }}
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
      </SectionCard>

      <SectionCard
        id="service-party"
        title="Booking party"
        description="How many people one appointment covers."
        icon={Users}
      >
        <div className="ws-party-row">
          <span className="ws-party-icon" aria-hidden>
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
              {form.groupBookingEnabled
                ? `1 customer + up to ${Math.max(2, form.groupCapacity) - 1} guest${
                    Math.max(2, form.groupCapacity) - 1 === 1 ? "" : "s"
                  }`
                : "1 customer per booking"}
            </p>
            <p className="ws-field-hint">
              This stays a service — the whole party is served together in one appointment.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Switch
            checked={form.groupBookingEnabled}
            onChange={(v) => {
              onFormChange("groupBookingEnabled", v);
              if (v && form.groupCapacity < 2) onFormChange("groupCapacity", 2);
            }}
            label="Allow additional guests"
            description="Customers choose how many people they are booking for."
          />
          {form.groupBookingEnabled ? (
            <div className="mt-4 max-w-[14rem]">
              <Field
                label="Maximum party size"
                htmlFor="svc-party-size"
                error={form.groupCapacity < 2 ? "Party size must be at least 2." : undefined}
              >
                <NumberField
                  id="svc-party-size"
                  suffix="people"
                  min={2}
                  value={form.groupCapacity}
                  onChange={(e) => onFormChange("groupCapacity", Number(e.target.value) || 2)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {draft ? (
        <Modal
          title={draft.index === null ? "Add question" : "Edit question"}
          description="Asked on the booking page before the appointment is confirmed."
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
            <Field label="Question" htmlFor="svc-q-label" error={questionError || undefined}>
              <TextInput
                id="svc-q-label"
                placeholder="Any allergies we should know about?"
                value={draft.question.label}
                onChange={(e) =>
                  setDraft({ ...draft, question: { ...draft.question, label: e.target.value } })
                }
              />
            </Field>
            <Field label="Answer type" htmlFor="svc-q-type">
              <SelectInput
                id="svc-q-type"
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
              <Field label="Choices" htmlFor="svc-q-options" hint="One per line.">
                <textarea
                  id="svc-q-options"
                  className="input"
                  rows={4}
                  value={draft.optionsText}
                  onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
                />
              </Field>
            ) : null}
            <label className="flex items-center gap-2 text-[var(--type-list)] text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={Boolean(draft.question.required)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    question: { ...draft.question, required: e.target.checked },
                  })
                }
              />
              Required to book
            </label>
          </div>
        </Modal>
      ) : null}

      {formModal ? (
        <Modal
          title="Create intake form"
          description="Created in your shared form library and attached to this service."
          onClose={() => setFormModal(false)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setFormModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!formName.trim() || busy}
                onClick={() => void createForm()}
              >
                {busy ? "Creating…" : "Create form"}
              </button>
            </>
          }
        >
          <Field
            label="Form name"
            htmlFor="svc-new-form"
            hint="Add its questions in Forms once created."
          >
            <TextInput
              id="svc-new-form"
              value={formName}
              placeholder="New client intake"
              onChange={(e) => setFormName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
