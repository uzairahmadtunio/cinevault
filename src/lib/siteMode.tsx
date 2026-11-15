import { createContext, useContext, useState, type ReactNode } from "react";

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

function readSavedMode(): SiteMode {
  // Client: read the saved choice synchronously so the very first render
  // already reflects it (round 1 applied it in an effect, which made the
  // toggle and stream-mode UI "mount late" / flicker). Server: default.
  if (typeof window === "undefined") return "download";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "stream" && STREAM_MODE_FREE) return "stream";
  } catch {
    /* storage unavailable — stay in Download Mode */
  }
  return "download";
}

export function SiteModeProvider({ children }: { children: ReactNode }) {
  // Default is Download Mode (the classic experience); a returning visitor's
  // saved Stream Mode applies from the first client render, not after mount.
  const [mode, setModeState] = useState<SiteMode>(readSavedMode);

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
