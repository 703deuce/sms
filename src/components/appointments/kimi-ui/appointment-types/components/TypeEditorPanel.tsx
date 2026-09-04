"use client";
import { ChevronLeft, Info, GripVertical, MoreHorizontal, Check, Plus, Trash2 } from "lucide-react";
import { AppointmentType } from "../mock-data";

interface Props {
  type: AppointmentType;
}

export default function TypeEditorPanel({ type }: Props) {
  return (
    <div className="card flex-1 min-w-[440px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ecedf2]">
        <button className="flex items-center gap-1.5 text-[13px] text-[#6b6f82] hover:text-[#3f4254]">
          <ChevronLeft size={15} /> Back to all types
        </button>
        <button className="flex items-center gap-1.5 text-[12.5px] font-medium text-rose-500 hover:text-rose-600">
          <Trash2 size={13} /> Delete type
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        {/* Basic details */}
        <section>
          <h3 className="text-[14px] font-semibold mb-4">Basic details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Name</label>
              <input className="input w-full" defaultValue={type.name} />
            </div>
            <div>
              <label className="label">Duration</label>
              <div className="flex items-center gap-2">
                <input className="input w-20" defaultValue={type.durationMin} />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1">
                Buffer time <Info size={12} className="text-[#a0a3b5]" />
              </label>
              <div className="flex items-center gap-2">
                <input className="input w-20" defaultValue={type.bufferMin} />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Location</label>
              <select className="input w-full appearance-none" defaultValue={type.location}>
                <option>In-office</option>
                <option>Video call</option>
                <option>Phone call</option>
              </select>
            </div>
            <div>
              <label className="label">Price (optional)</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-[#8a8fa3]">$</span>
                  <input className="input w-20" defaultValue={type.price ?? ""} placeholder="0" />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer">
                  <input type="checkbox" className="checkbox" defaultChecked /> Show price on booking page
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <div className="relative">
              <textarea
                className="input w-full resize-none"
                rows={4}
                defaultValue={type.description}
              />
              <span className="absolute bottom-2.5 right-3 text-[11px] text-[#a0a3b5]">75/500</span>
            </div>
          </div>
        </section>

        {/* Availability rules */}
        <section>
          <h3 className="text-[14px] font-semibold">Availability rules</h3>
          <p className="text-[12.5px] text-[#8a8fa3] mb-4">Control when this type can be booked.</p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="label">Availability hours</label>
              <select className="input w-full appearance-none" defaultValue="biz">
                <option value="biz">Mon–Fri 09:00 – 17:00</option>
                <option>Custom hours</option>
                <option>24/7</option>
              </select>
            </div>
            <div>
              <label className="label">Min notice</label>
              <div className="flex items-center gap-2">
                <input className="input w-20" defaultValue={60} />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
            <div>
              <label className="label">Max days ahead</label>
              <div className="flex items-center gap-2">
                <input className="input w-20" defaultValue={14} />
                <span className="text-[12.5px] text-[#8a8fa3]">days</span>
              </div>
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer">
                <input type="checkbox" className="checkbox" defaultChecked /> Allow bookings on weekends
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer">
                <input type="checkbox" className="checkbox" defaultChecked /> Allow bookings on holidays
              </label>
            </div>
            <div className="bg-[#f7f8fb] border border-[#ecedf2] rounded-xl p-3.5 w-[230px] shrink-0">
              <p className="text-[12px] font-semibold mb-1">Applies to</p>
              <p className="text-[11.5px] text-[#8a8fa3] leading-snug mb-2">
                These rules apply to any calendar connected to this appointment type.
              </p>
              <button className="text-[12px] font-medium text-[#5b4bff] hover:underline flex items-center gap-1">
                Manage availability →
              </button>
            </div>
          </div>
        </section>

        {/* Booking form */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[14px] font-semibold">Booking form (questions shown to customers)</h3>
            <button className="text-[12px] font-medium text-[#5b4bff] border border-[#dcd9ff] bg-[#f0efff] rounded-lg px-2.5 py-1.5 flex items-center gap-1 hover:bg-[#e6e4ff]">
              <Plus size={12} /> Add question
            </button>
          </div>
          <p className="text-[12.5px] text-[#8a8fa3] mb-3">Collect the right information before the appointment.</p>
          <div className="border border-[#ecedf2] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[24px_1fr_130px_70px_32px] gap-2 px-4 py-2.5 bg-[#f7f8fb] text-[11px] font-semibold text-[#8a8fa3] uppercase tracking-wide">
              <span />
              <span>Question</span>
              <span>Type</span>
              <span>Required</span>
              <span />
            </div>
            {type.questions.map((q) => (
              <div
                key={q.id}
                className="grid grid-cols-[24px_1fr_130px_70px_32px] gap-2 px-4 py-3 border-t border-[#ecedf2] items-center"
              >
                <GripVertical size={14} className="text-[#c6c9d6]" />
                <span className="text-[13px] font-medium">{q.label}</span>
                <span className="text-[12.5px] text-[#8a8fa3]">{q.type}</span>
                <span className="flex justify-center">
                  {q.required ? (
                    <Check size={15} className="text-emerald-500" />
                  ) : (
                    <span className="text-[#c6c9d6]">—</span>
                  )}
                </span>
                <MoreHorizontal size={15} className="text-[#a0a3b5]" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#ecedf2] bg-white">
        <button className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#e4e6ee] hover:bg-[#f7f8fb]">
          Cancel
        </button>
        <button className="btn-brand text-[13px] font-semibold px-5 py-2 rounded-lg">
          Save changes
        </button>
      </div>
    </div>
  );
}
