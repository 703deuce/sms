import { VisualizerOpusShell } from "@/newui-transplant/connected/visualizer/visualizer-opus-shell";

export default function VisualizerLayout({ children }: { children: React.ReactNode }) {
  return <VisualizerOpusShell wide>{children}</VisualizerOpusShell>;
}
