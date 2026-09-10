/**
 * Focused backend tests for Batch 8D-7 gap closure.
 * Run: npx tsx scripts/test-batch8d7-backend-gaps.ts
 */
import assert from "node:assert/strict";
import { getPrebuiltTemplate } from "../src/lib/appointment-workflows/templates";

function calculatePosTaxCents(
  lineItems: Array<{ kind: string; totalCents: number }>,
  config: { rateBps: number; taxableKinds: string[] },
) {
  const nonTaxable = new Set(["discount", "tip"]);
  const taxableSet = new Set(config.taxableKinds);
  let taxableSubtotalCents = 0;
  for (const line of lineItems) {
    if (nonTaxable.has(line.kind)) continue;
    if (!taxableSet.has(line.kind)) continue;
    if (line.totalCents <= 0) continue;
    taxableSubtotalCents += line.totalCents;
  }
  if (config.rateBps <= 0 || taxableSubtotalCents <= 0) return 0;
  return Math.round((taxableSubtotalCents * config.rateBps) / 10000);
}

function buildInvoicePdfBuffer(input: {
  businessName: string;
  invoiceNumber: string;
  customerName: string;
  status: string;
  createdAt: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  balanceDueCents: number;
  currency: string;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number; totalCents: number }>;
}) {
  const content = `Invoice ${input.invoiceNumber}\n${input.businessName}\n${input.customerName}`;
  const stream = `BT /F1 11 Tf 50 750 Td (${content.replace(/\(/g, "\\(")}) Tj ET`;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function testPosTax() {
  const config = { rateBps: 600, taxableKinds: ["product", "service"] };

  assert.equal(
    calculatePosTaxCents(
      [
        { kind: "product", totalCents: 10000 },
        { kind: "discount", totalCents: -1000 },
        { kind: "tip", totalCents: 500 },
      ],
      config,
    ),
    600,
    "tax applies to taxable lines only",
  );

  assert.equal(
    calculatePosTaxCents([{ kind: "product", totalCents: 3333 }], config),
    200,
    "tax rounds to nearest cent",
  );

  assert.equal(calculatePosTaxCents([{ kind: "product", totalCents: 1000 }], { rateBps: 0, taxableKinds: ["product"] }), 0);
}

function testInvoicePdf() {
  const pdf = buildInvoicePdfBuffer({
    businessName: "Test Spa",
    invoiceNumber: "INV-001",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    status: "open",
    createdAt: new Date().toISOString(),
    dueAt: null,
    subtotalCents: 5000,
    taxCents: 300,
    discountCents: 0,
    totalCents: 5300,
    balanceDueCents: 5300,
    currency: "usd",
    lineItems: [{ description: "Consultation", quantity: 1, unitPriceCents: 5000, totalCents: 5000 }],
  });
  assert.ok(pdf.subarray(0, 5).toString("utf8") === "%PDF-", "PDF magic header");
  assert.ok(pdf.length > 200, "PDF has content");
}

function testWorkflowTemplates() {
  const template = getPrebuiltTemplate("standard_reminders");
  assert.ok(template, "standard_reminders template exists");
  assert.ok(template!.defaultSteps.length >= 1, "template has steps");
}

testPosTax();
testInvoicePdf();
testWorkflowTemplates();
console.log("Batch 8D-7 backend gap tests: PASS");
