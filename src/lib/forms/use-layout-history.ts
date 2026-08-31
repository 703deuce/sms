"use client";

import { useCallback, useState } from "react";
import type { FormLayout } from "./layout";

const MAX_HISTORY = 50;

export function useLayoutHistory(initial: FormLayout) {
  const [layout, setLayoutState] = useState<FormLayout>(initial);
  const [past, setPast] = useState<FormLayout[]>([]);
  const [future, setFuture] = useState<FormLayout[]>([]);

  const setLayout = useCallback((value: FormLayout | ((prev: FormLayout) => FormLayout), recordHistory = true) => {
    setLayoutState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (recordHistory && next !== prev) {
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), structuredClone(prev)]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setLayoutState((current) => {
        setFuture((f) => [structuredClone(current), ...f]);
        return prev;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setLayoutState((current) => {
        setPast((p) => [...p, structuredClone(current)]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const resetHistory = useCallback((next: FormLayout) => {
    setPast([]);
    setFuture([]);
    setLayoutState(next);
  }, []);

  return {
    layout,
    setLayout,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetHistory,
  };
}
