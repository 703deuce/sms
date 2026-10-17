"use client";

import {
  SHOWER_WALL_HEIGHT_LABELS,
  type VisualizerShowerWallHeight,
} from "@/lib/visualizer/constants";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

export function ShowerWallHeightField({
  value,
  onChange,
  className,
}: {
  value: VisualizerShowerWallHeight;
  onChange: (value: VisualizerShowerWallHeight) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn(OPUS_CARD, "space-y-3 p-4", className)}>
      <legend className="text-sm font-medium">Shower / surround wall height</legend>
      <p className="text-xs text-muted-foreground">
        Should wall panels run to the ceiling or stop at about 8 feet with painted wall above?
      </p>
      {(Object.keys(SHOWER_WALL_HEIGHT_LABELS) as VisualizerShowerWallHeight[]).map((option) => (
        <label key={option} className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="radio"
            name="shower-wall-height"
            className="mt-1 size-4 shrink-0"
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span>{SHOWER_WALL_HEIGHT_LABELS[option]}</span>
        </label>
      ))}
    </fieldset>
  );
}
