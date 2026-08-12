import { IMPORT_HISTORY } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Lightbulb,
  MoreHorizontal,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export function ImportLeadsView() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Import Leads</h1>
        <p className="mt-1 text-[15px] text-[#6b7280]">
          Import leads in bulk from CSV files or copy &amp; paste.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Imports", value: 24, sub: "All time", icon: FileSpreadsheet, tone: "bg-purple-50 text-purple-600" },
          { label: "Leads Imported", value: "5,842", sub: "All time", icon: Users, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Successful Imports", value: 21, sub: "87.5% success rate", icon: CheckCircle, tone: "bg-orange-50 text-orange-600" },
          { label: "Duplicates Skipped", value: "1,236", sub: "All time", icon: XCircle, tone: "bg-red-50 text-red-600" },
          { label: "Last Import", value: "Apr 20, 2025", sub: "2:35 PM", icon: Clock, tone: "bg-blue-50 text-blue-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] text-[#6b7280]">{card.label}</p>
                <p className="mt-2 text-[22px] font-bold text-[#111827]">{card.value}</p>
                <p className={cn("text-[12px]", card.label === "Successful Imports" ? "text-emerald-600" : "text-[#6b7280]")}>
                  {card.sub}
                </p>
              </div>
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", card.tone)}>
                <card.icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="realtor-card p-0 overflow-hidden">
        <div className="flex border-b border-[#e5e7eb] text-[14px]">
          <button type="button" className="border-b-2 border-[#2563eb] px-5 py-3 font-semibold text-[#2563eb]">
            File Upload
          </button>
          <button type="button" className="px-5 py-3 text-[#6b7280] hover:text-[#111827]">
            Copy &amp; Paste
          </button>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#bfdbfe] bg-[#eff6ff] px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563eb] text-white">
              <Upload className="h-7 w-7" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-[#111827]">
              Drag and drop your CSV file here
            </p>
            <p className="mt-1 text-[13px] text-[#6b7280]">or</p>
            <Link href="/contacts/imports" className="realtor-btn-primary mt-4">
              Choose CSV File
            </Link>
            <p className="mt-4 text-[12px] text-[#6b7280]">Maximum file size: 25MB</p>
            <p className="mt-2 text-[12px] text-[#6b7280]">
              CSV columns should include: First Name, Last Name, Email or Phone
            </p>
            <Link href="/help" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]">
              View Import Guide
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
            <h3 className="flex items-center gap-2 font-semibold text-[#111827]">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Import Tips
            </h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[13px] text-[#374151]">
              <li>Use a CSV file (UTF-8 encoding)</li>
              <li>First row should contain column headers</li>
              <li>Required columns: First Name and either Email or Phone</li>
              <li>Duplicate leads (by email or phone) will be skipped</li>
            </ul>
            <button type="button" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[#2563eb]">
              <Download className="h-4 w-4" />
              Download Sample CSV
            </button>
          </div>
        </div>
      </div>

      <div className="realtor-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3">
          <h3 className="font-semibold text-[#111827]">Import History</h3>
          <div className="flex gap-2">
            <select className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
              <option>All Status</option>
            </select>
            <select className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
              <option>Last 30 Days</option>
            </select>
          </div>
        </div>
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">File Name</th>
              <th className="px-4 py-3">Imported By</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Leads Found</th>
              <th className="px-4 py-3">Imported</th>
              <th className="px-4 py-3">Duplicates</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {IMPORT_HISTORY.map((row) => (
              <tr key={row.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-[#111827]">{row.file}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-bold">
                      {row.byInitials}
                    </span>
                    {row.by}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#6b7280]">
                  {row.date}
                  <br />
                  {row.time}
                </td>
                <td className="px-4 py-3">{row.found}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600">{row.imported}</td>
                <td className="px-4 py-3">{row.duplicates}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", row.statusClass)}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-[#6b7280]">
                    <Download className="h-4 w-4" />
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
          <span>Showing 1 to 6 of 24 imports</span>
          <div className="flex items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border opacity-40">‹</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white">1</span>
            {[2, 3, 4].map((p) => (
              <span key={p} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">{p}</span>
            ))}
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
