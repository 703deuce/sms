import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createBulkVerifyJob } from "@/lib/verify/bulk-verify-service";
import { parseCsv, suggestPhoneColumn } from "@/lib/verify/csv";
import { getVerifyCreditBalance } from "@/lib/verify/verify-credits";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const contentType = request.headers.get("content-type") || "";
    let csvText = "";
    let filename: string | undefined;
    let phoneColumn: string | undefined;
    let previewOnly = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      phoneColumn = String(form.get("phoneColumn") || "").trim() || undefined;
      previewOnly = form.get("previewOnly") === "true";
      if (file instanceof File) {
        csvText = await file.text();
        filename = file.name;
      }
    } else {
      const body = await request.json();
      csvText = String(body.csvText || "");
      filename = body.filename;
      phoneColumn = body.phoneColumn;
      previewOnly = Boolean(body.previewOnly);
    }

    if (!csvText.trim()) return jsonError(new Error("CSV file is required"), 400);

    const { headers, rows } = parseCsv(csvText);
    const column = phoneColumn || suggestPhoneColumn(headers);
    if (!column) return jsonError(new Error("Could not detect phone column"), 400);

    const unique = new Set<string>();
    let blank = 0;
    const colIndex = headers.indexOf(column);
    for (const row of rows) {
      const raw = String(row[colIndex] || "").trim();
      if (!raw) blank++;
      else unique.add(raw);
    }

    const balance = await getVerifyCreditBalance(auth.workspaceId);

    if (previewOnly) {
      return NextResponse.json({
        data: {
          headers,
          previewRows: rows.slice(0, 5),
          phoneColumn: column,
          totalRows: rows.length,
          uniqueNumbers: unique.size,
          duplicateRows: rows.length - unique.size - blank,
          blankRows: blank,
          creditsRequired: unique.size,
          creditsAvailable: balance,
        },
      });
    }

    const job = await createBulkVerifyJob({
      workspaceId: auth.workspaceId,
      csvText,
      filename,
      phoneColumn: column,
    });

    return NextResponse.json({ data: job });
  } catch (err) {
    return jsonError(err);
  }
}
