import "server-only";

type InvoicePdfInput = {
  businessName: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  status: string;
  createdAt: string;
  dueAt?: string | null;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  balanceDueCents: number;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  note?: string | null;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal valid PDF 1.4 document (no external dependencies). */
export function buildInvoicePdfBuffer(input: InvoicePdfInput): Buffer {
  const lines: string[] = [
    `Invoice ${input.invoiceNumber}`,
    input.businessName,
    "",
    `Customer: ${input.customerName}`,
    input.customerEmail ? `Email: ${input.customerEmail}` : "",
    `Status: ${input.status}`,
    `Issued: ${new Date(input.createdAt).toLocaleString()}`,
    input.dueAt ? `Due: ${new Date(input.dueAt).toLocaleString()}` : "",
    "",
    "Line items",
    ...input.lineItems.map(
      (l) =>
        `${l.description}  x${l.quantity}  ${money(l.unitPriceCents, input.currency)}  = ${money(l.totalCents, input.currency)}`,
    ),
    "",
    `Subtotal: ${money(input.subtotalCents, input.currency)}`,
    input.discountCents ? `Discount: -${money(input.discountCents, input.currency)}` : "",
    input.taxCents ? `Tax: ${money(input.taxCents, input.currency)}` : "",
    `Total: ${money(input.totalCents, input.currency)}`,
    `Balance due: ${money(input.balanceDueCents, input.currency)}`,
    input.note ? `Note: ${input.note}` : "",
  ].filter(Boolean);

  const contentStream = [
    "BT",
    "/F1 11 Tf",
    "50 750 Td",
    `(${escapePdfText(lines[0] || "Invoice")}) Tj`,
    ...lines.slice(1).map(() => "0 -14 Td"),
    ...lines.slice(1).map((line) => `(${escapePdfText(line)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>stream\n${contentStream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
