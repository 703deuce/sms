import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { parseCsv, suggestPhoneColumn, rowsToObjects } from "./csv";
import { normalizeVerifyPhone } from "./phone-normalization";
import {
  appendVerifyCreditLedger,
  reserveVerifyCredits,
  settleVerifyReservation,
} from "./verify-credits";
import { verifyPhoneNumber } from "./verify-phone-number";

const BATCH_SIZE = 25;

export async function createBulkVerifyJob(input: {
  workspaceId: string;
  csvText: string;
  filename?: string;
  phoneColumn?: string;
}) {
  const { headers, rows } = parseCsv(input.csvText);
  if (!headers.length || !rows.length) throw new Error("CSV is empty or invalid.");

  const phoneColumn = input.phoneColumn || suggestPhoneColumn(headers);
  if (!phoneColumn) throw new Error("Could not detect a phone number column.");

  const colIndex = headers.indexOf(phoneColumn);
  if (colIndex < 0) throw new Error("Selected phone column was not found.");

  const objects = rowsToObjects(headers, rows);
  const unique = new Map<string, { raw: string; rowIndexes: number[] }>();

  objects.forEach((obj, idx) => {
    const raw = String(obj[phoneColumn] || "").trim();
    if (!raw) return;
    const norm = normalizeVerifyPhone(raw);
    const key = norm.ok ? norm.e164 : `invalid:${raw}`;
    const existing = unique.get(key);
    if (existing) existing.rowIndexes.push(idx);
    else unique.set(key, { raw, rowIndexes: [idx] });
  });

  const uniqueNumbers = unique.size;
  const blankRows = objects.filter((obj) => !String(obj[phoneColumn] || "").trim()).length;
  const duplicateRows = Math.max(0, rows.length - uniqueNumbers - blankRows);

  const reservation = await reserveVerifyCredits({
    workspaceId: input.workspaceId,
    credits: uniqueNumbers,
  });

  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      status: "queued",
      filename: input.filename,
      phoneColumn,
      totalRows: rows.length,
      uniqueNumbers,
      duplicateRows,
      creditsReserved: uniqueNumbers,
      reservationId: reservation.id,
    },
  });

  const rowCreates = objects.map((obj, rowIndex) => {
    const raw = String(obj[phoneColumn] || "").trim();
    const norm = raw ? normalizeVerifyPhone(raw) : null;
    return {
      id: createId(),
      workspaceId: input.workspaceId,
      bulkJobId: job.id,
      rowIndex,
      inputRaw: raw || null,
      normalizedE164: norm?.ok ? norm.e164 : null,
      originalDataJson: obj as object,
      status: raw ? "pending" : "skipped",
    };
  });

  for (let i = 0; i < rowCreates.length; i += 200) {
    await prisma.verifyBulkJobRow.createMany({ data: rowCreates.slice(i, i + 200) });
  }

  await enqueueJob({
    jobType: "verify_bulk_process",
    queueName: "automations",
    workspaceId: input.workspaceId,
    payload: { jobId: job.id },
    idempotencyKey: `verify-bulk:${job.id}`,
    runAfter: new Date(),
  });

  return job;
}

export async function processBulkVerifyJob(jobId: string) {
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "completed" || job.status === "failed") return;

  await prisma.verifyBulkJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  const pending = await prisma.verifyBulkJobRow.findMany({
    where: { bulkJobId: jobId, status: "pending" },
    orderBy: { rowIndex: "asc" },
    take: BATCH_SIZE,
  });

  if (!pending.length) {
    await finalizeBulkJob(jobId);
    return;
  }

  const uniquePhones = new Map<string, string>();
  for (const row of pending) {
    const key = row.normalizedE164 || row.inputRaw || row.id;
    if (!uniquePhones.has(key) && row.inputRaw) {
      uniquePhones.set(key, row.inputRaw);
    }
  }

  const lookupResults = new Map<string, string>();
  for (const [key, raw] of uniquePhones) {
    try {
      const result = await verifyPhoneNumber({
        workspaceId: job.workspaceId,
        phone: raw,
        bulkJobId: jobId,
        reservationId: job.reservationId || undefined,
      });
      lookupResults.set(key, result.lookupStatus === "success" ? result.lookupId : "");
    } catch {
      lookupResults.set(key, "");
    }
  }

  for (const row of pending) {
    const key = row.normalizedE164 || row.inputRaw || row.id;
    const lookupId = lookupResults.get(key);
    const lookupStatus = lookupId ? "completed" : row.normalizedE164 ? "failed" : "invalid";
    await prisma.verifyBulkJobRow.update({
      where: { id: row.id },
      data: {
        status: lookupStatus,
        lookupId: lookupId || null,
      },
    });
  }

  await updateBulkJobStats(jobId);

  const remaining = await prisma.verifyBulkJobRow.count({
    where: { bulkJobId: jobId, status: "pending" },
  });
  if (remaining > 0) {
    await enqueueJob({
      jobType: "verify_bulk_process",
      queueName: "automations",
      workspaceId: job.workspaceId,
      payload: { jobId },
      idempotencyKey: `verify-bulk:${jobId}:cont:${Date.now()}`,
      runAfter: new Date(Date.now() + 500),
    });
  }
}

async function updateBulkJobStats(jobId: string) {
  const prisma = getPrisma();
  const rows = await prisma.verifyBulkJobRow.findMany({
    where: { bulkJobId: jobId },
    select: { status: true },
  });
  const processedRows = rows.filter((r: { status: string }) => r.status !== "pending").length;
  const successfulLookups = rows.filter((r: { status: string }) => r.status === "completed").length;
  const failedLookups = rows.filter(
    (r: { status: string }) => r.status === "failed" || r.status === "invalid",
  ).length;

  await prisma.verifyBulkJob.update({
    where: { id: jobId },
    data: { processedRows, successfulLookups, failedLookups },
  });
}

async function finalizeBulkJob(jobId: string) {
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  await updateBulkJobStats(jobId);

  const rows = await prisma.verifyBulkJobRow.findMany({
    where: { bulkJobId: jobId },
    select: { status: true },
  });
  const successfulLookups = rows.filter((r: { status: string }) => r.status === "completed").length;
  const invalidRows = rows.filter((r: { status: string }) => r.status === "invalid").length;
  const lookupErrors = rows.filter((r: { status: string }) => r.status === "failed").length;
  const skippedRows = rows.filter((r: { status: string }) => r.status === "skipped").length;

  const hasHardFailure = successfulLookups === 0 && rows.length > 0;
  const status = hasHardFailure ? "failed" : "completed";
  const errorMessage =
    lookupErrors > 0 || invalidRows > 0
      ? `${successfulLookups} verified · ${invalidRows} invalid input · ${lookupErrors} lookup errors${skippedRows ? ` · ${skippedRows} skipped` : ""}`
      : null;

  if (job.reservationId) {
    const reservation = await prisma.verifyCreditReservation.findFirst({
      where: { id: job.reservationId, workspaceId: job.workspaceId },
    });
    if (reservation) {
      const unused = reservation.reservedCredits - reservation.consumedCredits;
      if (unused > 0) {
        await appendVerifyCreditLedger({
          workspaceId: job.workspaceId,
          entryType: "refund",
          amount: unused,
          referenceType: "bulk_job",
          referenceId: jobId,
          idempotencyKey: `verify-bulk-refund:${jobId}`,
          description: `Unused credits from bulk job (${unused} returned)`,
        });
      }
      await settleVerifyReservation(job.reservationId, job.workspaceId);
    }
  }

  await prisma.verifyBulkJob.update({
    where: { id: jobId },
    data: {
      status,
      completedAt: new Date(),
      creditsConsumed: successfulLookups,
      errorMessage,
    },
  });
}

export async function retryFailedBulkVerifyRows(workspaceId: string, jobId: string) {
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findFirst({ where: { id: jobId, workspaceId } });
  if (!job) throw new Error("JOB_NOT_FOUND");

  const failed = await prisma.verifyBulkJobRow.findMany({
    where: { bulkJobId: jobId, workspaceId, status: { in: ["failed"] } },
  });
  if (!failed.length) return { retried: 0 };

  const reservation = await reserveVerifyCredits({
    workspaceId,
    credits: failed.length,
    bulkJobId: jobId,
  });

  await prisma.verifyBulkJobRow.updateMany({
    where: { bulkJobId: jobId, workspaceId, status: "failed" },
    data: { status: "pending", lookupId: null },
  });

  await prisma.verifyBulkJob.update({
    where: { id: jobId },
    data: {
      status: "processing",
      reservationId: reservation.id,
      completedAt: null,
      errorMessage: null,
    },
  });

  await enqueueJob({
    jobType: "verify_bulk_process",
    queueName: "automations",
    workspaceId,
    payload: { jobId },
    idempotencyKey: `verify-bulk-retry:${jobId}:${Date.now()}`,
    runAfter: new Date(),
  });

  return { retried: failed.length };
}

export async function deleteBulkVerifyJob(workspaceId: string, jobId: string) {
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findFirst({ where: { id: jobId, workspaceId } });
  if (!job) throw new Error("JOB_NOT_FOUND");

  await prisma.verifyBulkJobRow.deleteMany({ where: { bulkJobId: jobId, workspaceId } });
  await prisma.verifyBulkJob.delete({ where: { id: jobId } });
}
