import { redirect } from "next/navigation";

export default function PaymentsIndexPage() {
  redirect("/payments/transactions");
}
