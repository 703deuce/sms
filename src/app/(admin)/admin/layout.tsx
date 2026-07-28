import { AdminShell } from "@/components/layout/admin-shell";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <AdminShell userName={session.name}>{children}</AdminShell>;
}
