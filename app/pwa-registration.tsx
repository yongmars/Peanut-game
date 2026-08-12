"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    const checkForUpdate = () => {
      void registration?.update().catch(() => undefined);
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        checkForUpdate();
      } catch (error) {
        console.warn("Service worker registration failed", error);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
