import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { parseCsv, suggestPhoneColumn, rowsToObjects } from "./csv";
import { normalizeVerifyPhone } from "./phone-normalization";
import { reserveVerifyCredits, settleVerifyReservation } from "./verify-credits";
import { runSingleVerify } from "./verify-service";

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
  const duplicateRows = rows.length - uniqueNumbers;

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
    await settleVerifyReservation(job.reservationId!, job.workspaceId);
    await prisma.verifyBulkJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
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
      const result = await runSingleVerify({
        workspaceId: job.workspaceId,
        phone: raw,
        bulkJobId: jobId,
        reservationId: job.reservationId || undefined,
      });
      lookupResults.set(key, result.lookupId);
    } catch {
      lookupResults.set(key, "");
    }
  }

  for (const row of pending) {
    const key = row.normalizedE164 || row.inputRaw || row.id;
    const lookupId = lookupResults.get(key);
    await prisma.verifyBulkJobRow.update({
      where: { id: row.id },
      data: {
        status: lookupId ? "completed" : "failed",
        lookupId: lookupId || null,
      },
    });
  }

  const processed = await prisma.verifyBulkJobRow.count({
    where: { bulkJobId: jobId, status: { in: ["completed", "failed", "skipped"] } },
  });
  const successful = await prisma.verifyBulkJobRow.count({
    where: { bulkJobId: jobId, status: "completed" },
  });
  const failed = await prisma.verifyBulkJobRow.count({
    where: { bulkJobId: jobId, status: "failed" },
  });

  await prisma.verifyBulkJob.update({
    where: { id: jobId },
    data: {
      processedRows: processed,
      successfulLookups: successful,
      failedLookups: failed,
      creditsConsumed: successful,
    },
  });

  await enqueueJob({
    jobType: "verify_bulk_process",
    queueName: "automations",
    workspaceId: job.workspaceId,
    payload: { jobId },
    idempotencyKey: `verify-bulk:${jobId}:cont:${processed}`,
    runAfter: new Date(Date.now() + 500),
  });
}
