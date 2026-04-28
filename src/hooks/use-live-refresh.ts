"use client";

import { useEffect, useRef } from "react";

type UseLiveRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
  runImmediately?: boolean;
};

export function useLiveRefresh(
  task: () => Promise<void> | void,
  options?: UseLiveRefreshOptions
) {
  const {
    enabled = true,
    intervalMs,
    refreshOnFocus = true,
    refreshOnVisible = true,
    runImmediately = true,
  } = options ?? {};

  const taskRef = useRef(task);
  const inFlightRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const run = async () => {
      if (disposed || inFlightRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      inFlightRef.current = true;
      try {
        await taskRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (runImmediately) {
      void run();
    }

    const onFocus = () => {
      void run();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        void run();
      }
    };

    const intervalId =
      intervalMs && intervalMs > 0
        ? window.setInterval(() => {
            void run();
          }, intervalMs)
        : null;

    if (refreshOnFocus) {
      window.addEventListener("focus", onFocus);
    }

    if (refreshOnVisible) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      disposed = true;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      if (refreshOnFocus) {
        window.removeEventListener("focus", onFocus);
      }
      if (refreshOnVisible) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [enabled, intervalMs, refreshOnFocus, refreshOnVisible, runImmediately]);
}
