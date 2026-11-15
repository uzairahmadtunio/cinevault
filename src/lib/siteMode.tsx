import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============================================================================
// FUTURE PREMIUM GROUNDWORK — single gate for Stream Mode.
// Stream Mode is currently FREE for everyone (STREAM_MODE_FREE = true).
// To gate it later, flip this one flag to false: the header toggle will then
// show Stream Mode as unavailable and the site stays in Download Mode.
// No accounts / payments / locks exist yet — this flag is the only switch.
// ============================================================================
export const STREAM_MODE_FREE = true;

export type SiteMode = "download" | "stream";

const STORAGE_KEY = "cv_site_mode";

type SiteModeCtx = { mode: SiteMode; setMode: (m: SiteMode) => void };

const SiteModeContext = createContext<SiteModeCtx>({ mode: "download", setMode: () => {} });

export function SiteModeProvider({ children }: { children: ReactNode }) {
  // Default is Download Mode (the classic experience). The saved choice is
  // applied after mount from localStorage so SSR/first paint never mismatches.
  const [mode, setModeState] = useState<SiteMode>("download");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "stream" && STREAM_MODE_FREE) setModeState("stream");
      else if (saved === "download") setModeState("download");
    } catch {
      /* storage unavailable — stay in Download Mode */
    }
  }, []);

  const setMode = (m: SiteMode) => {
    if (m === "stream" && !STREAM_MODE_FREE) return; // gated off by the flag
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  return <SiteModeContext.Provider value={{ mode, setMode }}>{children}</SiteModeContext.Provider>;
}

export function useSiteMode() {
  return useContext(SiteModeContext);
}
