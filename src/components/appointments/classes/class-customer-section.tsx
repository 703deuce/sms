"use client";

import { useState } from "react";
import { FileText, Info, MessageSquare, Plus, Trash2, UserCheck } from "lucide-react";
import Link from "next/link";
import {
  Field,
  Modal,
  Panel,
  SelectInput,
  Switch,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import type { ClassBookingQuestion } from "@/lib/appointments/class-series-offering";
import type { ClassEditorOptions } from "@/features/appointments/kimi/classes/use-class-editor";

type Props = {
  form: ClassFormState;
  options: ClassEditorOptions;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
  onAddIntakeForm: (name: string) => Promise<string | null>;
};

const QUESTION_TYPES: Array<{ value: ClassBookingQuestion["type"]; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Choice" },
  { value: "checkbox", label: "Yes / no" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

export function ClassCustomerSection({ form, options, onFormChange, onAddIntakeForm }: Props) {
  const [questionModal, setQuestionModal] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<ClassBookingQuestion["type"]>("text");
  const [draftRequired, setDraftRequired] = useState(false);
  const [draftOptions, setDraftOptions] = useState("");
  const [draftFormName, setDraftFormName] = useState("");
  const [busy, setBusy] = useState(false);

  function addQuestion() {
    const label = draftLabel.trim();
    if (!label) return;
    const question: ClassBookingQuestion = {
      id: `q_${Date.now().toString(36)}`,
      label,
      type: draftType,
      required: draftRequired,
      options:
        draftType === "select"
          ? draftOptions
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };
    onFormChange("bookingQuestions", [...form.bookingQuestions, question]);
    setDraftLabel("");
    setDraftOptions("");
    setDraftRequired(false);
    setDraftType("text");
    setQuestionModal(false);
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
          title="Quick booking questions"
          icon={MessageSquare}
          className="ws-span-7"
          flush
          actions={
            <button type="button" className="ws-text-btn" onClick={() => setQuestionModal(true)}>
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
                        {QUESTION_TYPES.find((t) => t.value === question.type)?.label || question.type}
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
                      className="ws-text-btn"
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
              Questions are saved on the class. The public class page still collects name, phone and
              email only, so these are not asked at registration yet.
            </p>
          ) : null}
        </Panel>

        <Panel title="Customer identity" icon={UserCheck} className="ws-span-5">
          <div className="space-y-2.5">
            <Switch
              checked
              disabled
              onChange={() => undefined}
              label="First name and phone"
              description="Always required — a class registration is matched to a contact by phone."
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
              <Link href="/appointments/forms-documents" className="ws-text-btn">
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
              No forms exist yet. Create one to collect waivers or health details.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.intakeFormOptions.map((intake) => {
                const attached = form.intakeFormIds.includes(intake.id);
                return (
                  <div key={intake.id} className="ws-row-item" style={{ minHeight: "3.25rem" }}>
                    <span className="ws-row-main">
                      <span className="ws-row-primary">{intake.name}</span>
                      <span className="ws-row-secondary">
                        <span>
                          {intake.fieldCount} field{intake.fieldCount === 1 ? "" : "s"}
                        </span>
                        {attached ? <span className="ws-chip ws-chip-success">Attached</span> : null}
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
              An attached form is recorded on the class and shown in the customer preview. The
              public class page does not render it during registration yet, so it still has to be
              completed at the desk.
            </p>
          ) : null}
        </Panel>
      </div>

      {questionModal ? (
        <Modal
          title="Add question"
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
                disabled={!draftLabel.trim()}
                onClick={addQuestion}
              >
                Add question
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Question" htmlFor="cls-q-label">
              <TextInput
                id="cls-q-label"
                value={draftLabel}
                placeholder="Have you taken this class before?"
                onChange={(e) => setDraftLabel(e.target.value)}
              />
            </Field>
            <Field label="Answer type" htmlFor="cls-q-type">
              <SelectInput
                id="cls-q-type"
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as ClassBookingQuestion["type"])}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {draftType === "select" ? (
              <Field label="Choices" htmlFor="cls-q-options" hint="Separated by commas.">
                <TextInput
                  id="cls-q-options"
                  value={draftOptions}
                  placeholder="Beginner, Intermediate, Advanced"
                  onChange={(e) => setDraftOptions(e.target.value)}
                />
              </Field>
            ) : null}
            <Switch
              checked={draftRequired}
              onChange={setDraftRequired}
              label="Required"
              description="Registration cannot complete without an answer."
            />
          </div>
        </Modal>
      ) : null}

      {formModal ? (
        <Modal
          title="New form"
          description="Created empty and attached to this class. Add fields in Forms."
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
          <Field label="Form name" htmlFor="cls-new-form">
            <TextInput
              id="cls-new-form"
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
