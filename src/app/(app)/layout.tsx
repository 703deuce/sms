import "./product-theme.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/push/service-worker-register";
import { runAppLayoutServerPipeline } from "@/lib/shell/app-layout-server-pipeline";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shellProps = await runAppLayoutServerPipeline();

  return (
    <>
      <ServiceWorkerRegister />
      <AppShell {...shellProps}>{children}</AppShell>
    </>
  );
}
