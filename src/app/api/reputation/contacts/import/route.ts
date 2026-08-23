import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import { MAX_CSV_BYTES } from "@/lib/reputation/bulk-csv";
import {
  errorReportToCsv,
  mappedRowsToImportRows,
  previewContactImport,
  runContactImport,
  type ContactImportMode,
  type ContactImportRow,
} from "@/lib/reputation/contact-import";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";
import { createServiceClient } from "@/lib/db/client";

const SYNC_ROW_LIMIT = 200;
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const uploadId = url.searchParams.get("uploadId");
    const downloadErrors = url.searchParams.get("downloadErrors") === "1";
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const supabase = createServiceClient();

    if (uploadId && downloadErrors) {
      const { data } = await supabase
        .from("review_request_uploads")
        .select("error_report_json, filename")
        .eq("id", uploadId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: "Import not found" }, { status: 404 });
      const errors = Array.isArray(data.error_report_json)
        ? (data.error_report_json as Array<{ row: number; error: string }>)
        : [];
      const csv = errorReportToCsv(errors);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-errors-${uploadId.slice(0, 8)}.csv"`,
        },
      });
    }

    // Compact single-upload status for adaptive polling (no full history list).
    if (uploadId) {
      const { data } = await supabase
        .from("review_request_uploads")
        .select(
          "id, status, imported_rows, skipped_rows, failed_rows, total_rows, started_at, completed_at, created_at"
        )
        .eq("id", uploadId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: "Import not found" }, { status: 404 });
      const completed = Number(data.imported_rows ?? 0);
      const failed = Number(data.failed_rows ?? 0);
      const total = Number(data.total_rows ?? 0);
      const version = Date.parse(String(data.completed_at ?? data.started_at ?? data.created_at ?? 0)) || 0;
      return NextResponse.json({
        jobId: data.id,
        status: data.status,
        progress: {
          completed,
          total,
          failed,
        },
        completedUnits: completed,
        totalUnits: total,
        failedUnits: failed,
        updatedAt: data.completed_at ?? data.started_at ?? data.created_at,
        version,
        imported: data.imported_rows,
        skipped: data.skipped_rows,
        failed: data.failed_rows,
      });
    }

    const { data: uploads } = await supabase
      .from("review_request_uploads")
      .select(
        "id, filename, total_rows, valid_rows, imported_rows, skipped_rows, failed_rows, status, mode, started_at, completed_at, created_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({ imports: uploads ?? [] });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Import request failed");
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: `Import payload exceeds maximum size of ${MAX_CSV_BYTES} bytes` },
        { status: 400 }
      );
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const businessId = body.businessId as string | undefined;
    const action = (body.action as string | undefined) ?? "import";
    const mode = (body.mode as ContactImportMode | undefined) ?? "update";
    const filename = (body.filename as string | undefined) ?? "import.csv";
    const mapping = (body.mapping as Record<string, CsvMapTarget> | undefined) ?? {};

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const access = await requireBusinessAccess(businessId);
    await requireEntitlement(access.organizationId, "review_campaigns");
    const permAuth = await requireOrganizationPermission("contacts.import", access.organizationId);
    await requireRecentAuth();

    let rows: ContactImportRow[] = Array.isArray(body.rows) ? (body.rows as ContactImportRow[]) : [];
    if ((!rows.length || action === "preview") && Array.isArray(body.csvRows) && Array.isArray(body.headers)) {
      rows = mappedRowsToImportRows(
        body.headers as string[],
        body.csvRows as string[][],
        mapping
      );
    }

    if (!rows.length) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Import limited to ${MAX_ROWS} rows per request` },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const preview = await previewContactImport({ businessId, rows });
      return NextResponse.json(preview);
    }

    const supabase = createServiceClient();
    const startedAt = new Date().toISOString();
    const useBackground = rows.length > SYNC_ROW_LIMIT || body.background === true;

    const { data: upload, error: uploadErr } = await supabase
      .from("review_request_uploads")
      .insert({
        organization_id: access.organizationId,
        business_id: businessId,
        filename,
        total_rows: rows.length,
        mapping_json: mapping,
        status: useBackground ? "queued" : "running",
        mode,
        started_at: startedAt,
        uploaded_by: access.userId,
        rows_json: useBackground ? rows : null,
      })
      .select("id")
      .single();
    if (uploadErr) throw new Error(uploadErr.message);

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "contacts.import",
      organizationId: access.organizationId,
      actorUserId: permAuth.userId,
      actorEmail: permAuth.email,
      resourceType: "review_request_upload",
      resourceId: upload.id,
      meta: { rowCount: rows.length, mode, background: useBackground },
      ...meta,
    });

    if (useBackground) {
      const job = await dispatchFeatureJob({
        jobType: "import_contacts",
        payload: {
          uploadId: upload.id,
          businessId,
          organizationId: access.organizationId,
          mode,
        },
        organizationId: access.organizationId,
        businessId,
        idempotencyKey: `review-import:${upload.id}`,
        priority: "normal",
        maxAttempts: 3,
      });
      return NextResponse.json({
        uploadId: upload.id,
        status: "queued",
        jobId: job.jobId,
        queueDriver: job.driver,
        message: "Import queued for background processing.",
        total: rows.length,
      });
    }

    const result = await runContactImport({
      organizationId: access.organizationId,
      businessId,
      uploadId: upload.id,
      mode,
      rows,
      userId: access.userId,
    });

    return NextResponse.json({
      uploadId: upload.id,
      status: "completed",
      total: rows.length,
      ...result,
      errors: result.errors.slice(0, 100),
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Import failed");
  }
}
