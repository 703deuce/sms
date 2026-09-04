"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import type { BookingQuestion } from "@/lib/appointments/types";

export function BookingQuestionField({
  question,
  value,
  onChange,
}: {
  question: BookingQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `q-${question.id}`;
  const label = (
    <Label htmlFor={id}>
      {question.label}
      {question.required ? " *" : ""}
    </Label>
  );

  if (question.description) {
    return (
      <div>
        {label}
        <p className="mb-1.5 text-[12px] text-muted-foreground">{question.description}</p>
        <QuestionInput id={id} question={question} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div>
      {label}
      <QuestionInput id={id} question={question} value={value} onChange={onChange} />
    </div>
  );
}

function QuestionInput({
  id,
  question,
  value,
  onChange,
}: {
  id: string;
  question: BookingQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const type = question.type || "text";

  if (type === "textarea") {
    return (
      <Textarea
        id={id}
        rows={3}
        placeholder={question.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "select") {
    return (
      <select
        id={id}
        className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {(question.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (type === "radio") {
    return (
      <div className="mt-2 space-y-2">
        {(question.options || []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name={id}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <label className="mt-2 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={value === "yes"}
          onChange={(e) => onChange(e.target.checked ? "yes" : "")}
        />
        {question.placeholder || "Yes"}
      </label>
    );
  }

  if (type === "multiselect") {
    const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
    return (
      <div className="mt-2 space-y-2">
        {(question.options || []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt]
                  : selected.filter((s) => s !== opt);
                onChange(next.join(", "));
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      id={id}
      type={type === "email" ? "email" : type === "phone" ? "tel" : type === "number" ? "number" : type === "date" ? "date" : "text"}
      placeholder={question.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
