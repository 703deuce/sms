"use client";

import { useEffect } from "react";

/**
 * Loads legacy MCTB presentation CSS only when enabled (Stage 2 OFF + legacy MCTB chrome).
 * Keeps legacy styles out of the Stage 2 Opus bundle graph.
 */
export function MctbLegacyAppShellStylesLoader({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    void import("@/components/layout/mctb-legacy-app-shell-styles");
  }, [enabled]);
  return null;
}
