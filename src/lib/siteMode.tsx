import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

// ============================================================================
// FUTURE PREMIUM GROUNDWORK — single gate for Stream Mode.
// Stream Mode is currently FREE for everyone (STREAM_MODE_FREE = true).
// To gate it later, flip this one flag to false: the header toggle will then
// show Stream Mode as unavailable and the site stays in Download Mode.
// No accounts / payments / locks exist yet — this flag is the only switch.
// ============================================================================
export const STREAM_MODE_FREE = true;

export type SiteMode = "download" | "stream";

// THE one and only storage key for the mode. Every consumer reads/writes the
// mode exclusively through this module's provider — no other key, no local
// copies, no per-route state.
const STORAGE_KEY = "cv_site_mode";

type SiteModeCtx = { mode: SiteMode; setMode: (m: SiteMode) => void };

const SiteModeContext = createContext<SiteModeCtx>({ mode: "download", setMode: () => {} });

function readSavedMode(): SiteMode {
  if (typeof window === "undefined") return "download";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "stream" && STREAM_MODE_FREE) return "stream";
  } catch {
    /* storage unavailable — stay in Download Mode */
  }
  return "download";
}

// Layout effect on the client (runs during commit, before the browser
// paints the hydrated tree); plain effect on the server to avoid SSR
// useLayoutEffect warnings.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function SiteModeProvider({ children }: { children: ReactNode }) {
  // CRITICAL: the initial state MUST equal the server render ("download")
  // so the client's first render matches the SSR HTML exactly.
  //
  // Round 2 read localStorage inside the useState initializer. That made the
  // first client render differ from the SSR markup whenever a visitor had
  // saved "stream" — and React hydration ADOPTS the server-rendered DOM
  // attributes without patching them, so the toggle (and every other
  // mode-dependent element) kept its server-rendered "Download" appearance
  // after every full page load, even though the live state was "stream".
  // Clicking "▶ Stream" was then a state no-op (already "stream"), so
  // nothing ever re-rendered to correct the DOM — the mode looked dead on
  // fresh loads and only "came alive" after a client-side navigation
  // remounted components with the true state.
  const [mode, setModeState] = useState<SiteMode>("download");

  // Apply the saved choice immediately after mount, before first paint:
  // this is a real state update, so React re-renders and patches the DOM to
  // the saved mode in the same frame hydration completes.
  useIsoLayoutEffect(() => {
    const saved = readSavedMode();
    if (saved !== "download") setModeState(saved);
    // Keep multiple open tabs in sync with each other.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(readSavedMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
