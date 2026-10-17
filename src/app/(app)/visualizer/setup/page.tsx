import Link from "next/link";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

export default function VisualizerSetupPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 text-center">
      <h1 className="text-2xl font-semibold">Let&apos;s set up your bathroom visualizer</h1>
      <p className="text-sm text-muted-foreground">
        Add your products, create a preview, and publish your hosted lead page.
      </p>
      <div className={OPUS_CARD + " flex flex-col gap-3 p-8"}>
        <Button render={<Link href={VISUALIZER_ROUTES.materials} />}>Add materials</Button>
        <Button variant="outline" render={<Link href={VISUALIZER_ROUTES.newDesign} />}>Create first preview</Button>
        <Button variant="outline" render={<Link href={VISUALIZER_ROUTES.widget} />}>Configure website widget</Button>
      </div>
    </div>
  );
}
