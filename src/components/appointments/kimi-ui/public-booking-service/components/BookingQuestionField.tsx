import type { BookingQuestion } from "../mock-data";
import { Input, Label, Textarea } from "./ui";

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
  return (
    <div>
      <Label htmlFor={id}>
        {question.label}
        {question.required ? " *" : ""}
      </Label>
      {question.description ? (
        <p className="mb-1.5 text-[12px] text-muted-foreground">{question.description}</p>
      ) : null}
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
    return <Textarea id={id} rows={3} placeholder={question.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
  }

  if (type === "select") {
    return (
      <select
        id={id}
        className="mt-1.5 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] shadow-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
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
            <input type="radio" name={id} checked={value === opt} onChange={() => onChange(opt)} className="accent-primary" />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <label className="mt-2 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={value === "yes"} onChange={(e) => onChange(e.target.checked ? "yes" : "")} className="accent-primary" />
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
                const next = e.target.checked ? [...selected, opt] : selected.filter((s) => s !== opt);
                onChange(next.join(", "));
              }}
              className="accent-primary"
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
