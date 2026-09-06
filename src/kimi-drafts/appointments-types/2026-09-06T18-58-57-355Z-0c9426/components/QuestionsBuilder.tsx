"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { QUESTION_TYPES, CHOICE_TYPES, type FormQuestion } from "../mock-data";

type Props = {
  questions: FormQuestion[];
  onChange: (questions: FormQuestion[]) => void;
};

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label]),
);

export default function QuestionsBuilder({ questions, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<FormQuestion>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const remove = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const move = (id: string, dir: "up" | "down") => {
    const idx = questions.findIndex((q) => q.id === id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= questions.length) return;
    const next = [...questions];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const add = () => {
    const id = `q${Date.now()}`;
    onChange([
      ...questions,
      { id, label: "", type: "text", required: false, options: [] },
    ]);
    setEditingId(id);
  };

  return (
    <div className="pt-3 space-y-3">
      <p className="text-[12.5px] text-[#8a8fa3]">
        Name, phone, and email are always collected. Add custom questions for this service.
      </p>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d8dbe6] px-4 py-5 text-center">
          <p className="text-[12.5px] text-[#8a8fa3]">No custom questions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const editing = editingId === q.id;
            return (
              <div key={q.id} className="rounded-lg border border-[#ecedf2] overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#f7f8fb] transition-colors"
                  onClick={() => setEditingId(editing ? null : q.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingId(editing ? null : q.id);
                    }
                  }}
                  aria-expanded={editing}
                >
                  <GripVertical size={13} className="text-[#c3c7d4] shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-[#3c4257]">
                    {q.label.trim() || <span className="text-[#a7abb9] italic">Untitled question</span>}
                  </span>
                  <span className="chip chip-draft shrink-0">{TYPE_LABELS[q.type] ?? q.type}</span>
                  {q.required ? <span className="chip chip-paused shrink-0">Required</span> : null}
                  <span className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="p-1 rounded text-[#a7abb9] hover:text-[#3c4257] hover:bg-[#ecedf2] disabled:opacity-30"
                      aria-label="Move question up"
                      disabled={idx === 0}
                      onClick={() => move(q.id, "up")}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-[#a7abb9] hover:text-[#3c4257] hover:bg-[#ecedf2] disabled:opacity-30"
                      aria-label="Move question down"
                      disabled={idx === questions.length - 1}
                      onClick={() => move(q.id, "down")}
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-[#a7abb9] hover:text-[#d92d20] hover:bg-[#fef3f2]"
                      aria-label={`Delete question ${q.label || "untitled"}`}
                      onClick={() => remove(q.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>

                {editing ? (
                  <div className="px-3 pb-3 pt-2 border-t border-[#ecedf2] space-y-3 animate-in">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
                      <div>
                        <label className="field-label" htmlFor={`q-label-${q.id}`}>
                          Question
                        </label>
                        <input
                          id={`q-label-${q.id}`}
                          className="field-input"
                          placeholder="e.g. Do you have dental insurance?"
                          value={q.label}
                          onChange={(e) => update(q.id, { label: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`q-type-${q.id}`}>
                          Answer type
                        </label>
                        <select
                          id={`q-type-${q.id}`}
                          className="field-input"
                          value={q.type}
                          onChange={(e) => {
                            const type = e.target.value;
                            update(q.id, {
                              type,
                              options: CHOICE_TYPES.includes(type)
                                ? q.options.length > 0
                                  ? q.options
                                  : ["Option 1", "Option 2"]
                                : [],
                            });
                          }}
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {CHOICE_TYPES.includes(q.type) ? (
                      <div>
                        <span className="field-label">Choices</span>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                className="field-input !h-8 text-[12.5px]"
                                style={{ height: 32 }}
                                value={opt}
                                aria-label={`Choice ${oi + 1}`}
                                onChange={(e) =>
                                  update(q.id, {
                                    options: q.options.map((o, i) => (i === oi ? e.target.value : o)),
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="p-1 rounded text-[#a7abb9] hover:text-[#d92d20] hover:bg-[#fef3f2] shrink-0"
                                aria-label={`Remove choice ${oi + 1}`}
                                onClick={() =>
                                  update(q.id, { options: q.options.filter((_, i) => i !== oi) })
                                }
                              >
                                <Trash2 size={12.5} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="text-[12px] font-medium text-[#4f46e5] hover:text-[#4338ca]"
                            onClick={() => update(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                          >
                            + Add choice
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#d8dbe6] accent-[#4f46e5]"
                        checked={q.required}
                        onChange={(e) => update(q.id, { required: e.target.checked })}
                      />
                      <span className="text-[12.5px] text-[#3c4257]">
                        Required — customers must answer before booking
                      </span>
                    </label>

                    {/* Public form preview */}
                    <div className="rounded-lg bg-[#f7f8fb] border border-[#ecedf2] px-3 py-2.5">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#a7abb9] mb-1.5">
                        Customer sees
                      </div>
                      <div className="text-[12.5px] font-medium text-[#3c4257]">
                        {q.label.trim() || "Your question"}{" "}
                        {q.required ? <span className="text-[#d92d20]">*</span> : null}
                      </div>
                      {q.type === "textarea" ? (
                        <div className="mt-1.5 h-12 rounded-md border border-[#e4e6ee] bg-white" />
                      ) : CHOICE_TYPES.includes(q.type) ? (
                        <div className="mt-1.5 space-y-1">
                          {q.options.slice(0, 3).map((o, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px] text-[#667085]">
                              <span className="h-3 w-3 rounded-full border border-[#d8dbe6] bg-white" />
                              {o}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1.5 h-7 rounded-md border border-[#e4e6ee] bg-white" />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn-secondary inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg text-[13px] font-medium"
        onClick={add}
      >
        <Plus size={13.5} /> Add question
      </button>
    </div>
  );
}
