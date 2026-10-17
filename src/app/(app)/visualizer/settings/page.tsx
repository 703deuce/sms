import Link from "next/link";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

export default function VisualizerSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Visualizer settings</h1>
      <section className={OPUS_CARD + " space-y-3 p-6 text-sm"}>
        <p>Configure sharing defaults, public widget, and materials from the dedicated pages.</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li><Link href={VISUALIZER_ROUTES.widget} className="text-primary underline">Website widget</Link></li>
          <li><Link href={VISUALIZER_ROUTES.materials} className="text-primary underline">Materials library</Link></li>
          <li><Link href={VISUALIZER_ROUTES.setup} className="text-primary underline">Setup wizard</Link></li>
        </ul>
      </section>
    </div>
  );
}
