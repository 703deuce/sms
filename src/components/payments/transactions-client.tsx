"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TransactionRow = {
  id: string;
  appointmentId: string;
  provider: string;
  status: string;
  paymentMode: string;
  currency: string;
  totalPriceCents: number;
  amountPaidCents: number;
  refundAmountCents: number;
  paidAt: string | null;
  createdAt: string;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function PaymentsTransactionsClient() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/merchant-payments/transactions")
      .then((r) => r.json())
      .then((json) => setRows(json.data?.transactions || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Appointment payments collected through Stripe or Square.
          </p>
        </div>
        <Link
          href="/integrations/payments"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Manage payment providers
        </Link>
      </div>

      {loading ? (
        <Card className="p-8 text-sm text-muted-foreground">Loading transactions…</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="No payment transactions yet"
          description="When customers pay at booking or through a payment link, transactions will appear here."
          actionLabel="Connect Stripe or Square"
          actionHref="/integrations/payments"
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Provider</TH>
                <TH>Status</TH>
                <TH>Mode</TH>
                <TH className="text-right">Amount</TH>
                <TH>Appointment</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD className="text-[13px]">{formatWhen(row.paidAt || row.createdAt)}</TD>
                  <TD className="text-[13px]">{row.provider}</TD>
                  <TD className="text-[13px] capitalize">{row.status.replace(/_/g, " ")}</TD>
                  <TD className="text-[13px] capitalize">{row.paymentMode}</TD>
                  <TD className="text-right text-[13px] font-semibold tabular-nums">
                    {formatMoney(row.amountPaidCents || row.totalPriceCents, row.currency)}
                    {row.refundAmountCents > 0 ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (refunded {formatMoney(row.refundAmountCents, row.currency)})
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <Link
                      href={`/appointments/${row.appointmentId}`}
                      className="text-[13px] font-medium text-primary hover:underline"
                    >
                      View appointment
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
