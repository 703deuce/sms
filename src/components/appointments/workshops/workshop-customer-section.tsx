"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  Field,
  Modal,
  Panel,
  SelectInput,
  Switch,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import type { ClassBookingQuestion } from "@/lib/appointments/class-series-offering";
import type { WorkshopEditorOptions } from "@/features/appointments/kimi/workshops/use-workshop-editor";

type Props = {
  form: WorkshopFormState;
  options: WorkshopEditorOptions;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
  onAddIntakeForm: (name: string) => Promise<string | null>;
};

const QUESTION_TYPES: Array<{ value: ClassBookingQuestion["type"]; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long answer" },
  { value: "select", label: "Choice" },
  { value: "checkbox", label: "Yes / no" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

const EMPTY_DRAFT = {
  id: "",
  label: "",
  type: "text" as ClassBookingQuestion["type"],
  required: false,
  optionsText: "",
};

export function WorkshopCustomerSection({ form, options, onFormChange, onAddIntakeForm }: Props) {
  const [questionModal, setQuestionModal] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formModal, setFormModal] = useState(false);
  const [draftFormName, setDraftFormName] = useState("");
  const [busy, setBusy] = useState(false);

  function openNewQuestion() {
    setDraft(EMPTY_DRAFT);
    setQuestionModal(true);
  }

  function openEditQuestion(question: ClassBookingQuestion) {
    setDraft({
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required === true,
      optionsText: (question.options || []).join(", "),
    });
    setQuestionModal(true);
  }

  function saveQuestion() {
    const label = draft.label.trim();
    if (!label) return;
    const question: ClassBookingQuestion = {
      id: draft.id || `q_${Date.now().toString(36)}`,
      label,
      type: draft.type,
      required: draft.required,
      options:
        draft.type === "select"
          ? draft.optionsText
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };
    onFormChange(
      "bookingQuestions",
      draft.id
        ? form.bookingQuestions.map((q) => (q.id === draft.id ? question : q))
        : [...form.bookingQuestions, question],
    );
    setQuestionModal(false);
    setDraft(EMPTY_DRAFT);
  }

  /** Questions are asked in the order they are listed, so order is editable. */
  function move(index: number, delta: number) {
    const next = [...form.bookingQuestions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onFormChange("bookingQuestions", next);
  }

  async function createForm() {
    setBusy(true);
    const id = await onAddIntakeForm(draftFormName);
    setBusy(false);
    if (!id) return;
    onFormChange("intakeFormIds", [...form.intakeFormIds, id]);
    setDraftFormName("");
    setFormModal(false);
  }

  function toggleForm(id: string) {
    onFormChange(
      "intakeFormIds",
      form.intakeFormIds.includes(id)
        ? form.intakeFormIds.filter((f) => f !== id)
        : [...form.intakeFormIds, id],
    );
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel
          title="Registration questions"
          icon={MessageSquare}
          className="ws-span-7"
          flush
          actions={
            <button type="button" className="ws-text-btn" onClick={openNewQuestion}>
              <Plus className="h-3 w-3" aria-hidden />
              Add question
            </button>
          }
        >
          {form.bookingQuestions.length === 0 ? (
            <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
              No extra questions. Customers give the identity fields on the right and nothing more.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {form.bookingQuestions.map((question, index) => (
                <div key={question.id} className="ws-row-item" style={{ minHeight: "3.25rem" }}>
                  <span className="ws-question-index" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="ws-row-main">
                    <span className="ws-row-primary">{question.label}</span>
                    <span className="ws-row-secondary">
                      <span>
                        {QUESTION_TYPES.find((t) => t.value === question.type)?.label ||
                          question.type}
                      </span>
                      {question.required ? (
                        <span className="ws-chip ws-chip-neutral">Required</span>
                      ) : null}
                      {question.options?.length ? (
                        <span>{question.options.join(" · ")}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="ws-row-actions">
                    <button
                      type="button"
                      className="ws-icon-btn"
                      aria-label={`Move “${question.label}” up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="ws-icon-btn"
                      aria-label={`Move “${question.label}” down`}
                      disabled={index === form.bookingQuestions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="ws-text-btn"
                      onClick={() => openEditQuestion(question)}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ws-text-btn is-danger"
                      onClick={() =>
                        onFormChange(
                          "bookingQuestions",
                          form.bookingQuestions.filter((q) => q.id !== question.id),
                        )
                      }
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      Remove
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {form.bookingQuestions.length > 0 ? (
            <p className="ws-gap-note m-3">
              <Info className="h-3.5 w-3.5" aria-hidden />
              <span>
                Questions are saved on the workshop. The public registration page still collects
                name, phone and email only, so these are not asked yet.
              </span>
            </p>
          ) : null}
        </Panel>

        <Panel title="Customer information" icon={UserCheck} className="ws-span-5">
          <div className="space-y-2.5">
            <Switch
              checked
              disabled
              onChange={() => undefined}
              label="First name and phone"
              description="Always required — a registration is matched to a contact by phone."
            />
            <Switch
              checked={form.requireLastName}
              onChange={(v) => onFormChange("requireLastName", v)}
              label="Require last name"
            />
            <Switch
              checked={form.requireEmail}
              onChange={(v) => onFormChange("requireEmail", v)}
              label="Require email"
              description="Needed if you want to send a confirmation by email."
            />
          </div>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Attached forms"
          icon={FileText}
          className="ws-span-12"
          flush
          actions={
            <>
              <Link href="/appointments/booking/forms" className="ws-text-btn">
                Manage forms
              </Link>
              <button type="button" className="ws-text-btn" onClick={() => setFormModal(true)}>
                <Plus className="h-3 w-3" aria-hidden />
                New form
              </button>
            </>
          }
        >
          {options.intakeFormOptions.length === 0 ? (
            <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
              No forms exist yet. Create one to collect a waiver or health details.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.intakeFormOptions.map((intake) => {
                const attached = form.intakeFormIds.includes(intake.id);
                return (
                  <div key={intake.id} className="ws-row-item" style={{ minHeight: "3.25rem" }}>
                    <span className="ws-summary-row-icon" aria-hidden>
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="ws-row-main">
                      <span className="ws-row-primary">{intake.name}</span>
                      <span className="ws-row-secondary">
                        <span>
                          {intake.fieldCount} question{intake.fieldCount === 1 ? "" : "s"}
                        </span>
                        {attached ? (
                          <span className="ws-chip ws-chip-success">Attached</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="ws-row-actions">
                      <button
                        type="button"
                        className="ws-text-btn"
                        aria-pressed={attached}
                        onClick={() => toggleForm(intake.id)}
                      >
                        {attached ? "Detach" : "Attach"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {form.intakeFormIds.length > 0 ? (
            <p className="ws-gap-note m-3">
              <Info className="h-3.5 w-3.5" aria-hidden />
              <span>
                An attached form is recorded on the workshop and shown in the customer preview. The
                public page does not render it during registration yet, so it still has to be
                completed at the door.
              </span>
            </p>
          ) : null}
        </Panel>
      </div>

      {questionModal ? (
        <Modal
          title={draft.id ? "Edit question" : "Add question"}
          description="Asked once, at registration."
          onClose={() => setQuestionModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setQuestionModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!draft.label.trim()}
                onClick={saveQuestion}
              >
                {draft.id ? "Save question" : "Add question"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Question" htmlFor="wks-q-label">
              <TextInput
                id="wks-q-label"
                value={draft.label}
                placeholder="What do you hope to learn?"
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </Field>
            <Field label="Answer type" htmlFor="wks-q-type">
              <SelectInput
                id="wks-q-type"
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as ClassBookingQuestion["type"] })
                }
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {draft.type === "select" ? (
              <Field label="Choices" htmlFor="wks-q-options" hint="Separated by commas.">
                <TextInput
                  id="wks-q-options"
                  value={draft.optionsText}
                  placeholder="Beginner, Intermediate, Advanced"
                  onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
                />
              </Field>
            ) : null}
            <Switch
              checked={draft.required}
              onChange={(v) => setDraft({ ...draft, required: v })}
              label="Required"
              description="Registration cannot complete without an answer."
            />
          </div>
        </Modal>
      ) : null}

      {formModal ? (
        <Modal
          title="New form"
          description="Created empty and attached to this workshop. Add questions in Forms."
          onClose={() => setFormModal(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setFormModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!draftFormName.trim() || busy}
                onClick={() => void createForm()}
              >
                {busy ? "Creating…" : "Create form"}
              </button>
            </>
          }
        >
          <Field label="Form name" htmlFor="wks-new-form">
            <TextInput
              id="wks-new-form"
              value={draftFormName}
              placeholder="Liability waiver"
              onChange={(e) => setDraftFormName(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
