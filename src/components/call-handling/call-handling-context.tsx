"use client";

import type { ActiveCallHandler, CallHandlingOwnershipState } from "@/lib/call-handling/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CallHandlingContextValue = {
  state: CallHandlingOwnershipState | null;
  loading: boolean;
  error: string | null;
  setState: (next: CallHandlingOwnershipState | null) => void;
  setError: (message: string | null) => void;
  patchHandler: (handler: ActiveCallHandler) => Promise<CallHandlingOwnershipState>;
};

const CallHandlingContext = createContext<CallHandlingContextValue | null>(null);

export function CallHandlingProvider({
  initialState,
  children,
}: {
  initialState: CallHandlingOwnershipState | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<CallHandlingOwnershipState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const patchHandler = useCallback(async (handler: ActiveCallHandler) => {
    if (!state) {
      throw new Error("Call handling is not configured for this workspace.");
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/call-handling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handler, phoneNumberId: state.phoneNumberId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.data) setState(json.data);
        throw new Error(json.error || "Switch did not complete");
      }
      setState(json.data);
      return json.data as CallHandlingOwnershipState;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Switch did not complete";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      loading,
      error,
      setState,
      setError,
      patchHandler,
    }),
    [state, loading, error, patchHandler],
  );

  return <CallHandlingContext.Provider value={value}>{children}</CallHandlingContext.Provider>;
}

export function useCallHandling(): CallHandlingContextValue {
  const ctx = useContext(CallHandlingContext);
  if (!ctx) {
    throw new Error("useCallHandling must be used within CallHandlingProvider");
  }
  return ctx;
}

export function useCallHandlingOptional(): CallHandlingContextValue | null {
  return useContext(CallHandlingContext);
}
