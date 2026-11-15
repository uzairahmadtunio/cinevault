import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTrendingOrTopRated } from "@/lib/api/server.movies";

/* ------------------------------------------------------------------
 * Today's Top 10 — fetched once per Stream Mode session and shared
 * via context so EVERY surface (row cards, search results, the detail
 * modal, More Like This) can badge titles that are in today's Top 10,
 * not just the Top 10 row itself (delta report, implication #10).
 * ------------------------------------------------------------------ */

const Top10Context = createContext<Map<string, number>>(new Map());

export function Top10Provider({ children }: { children: ReactNode }) {
  const [ranks, setRanks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetchTrendingOrTopRated({ data: { limit: 10 } })
      .then((r: any) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        ((r?.movies || []) as { id: string | number }[]).slice(0, 10).forEach((m, i) => {
          map.set(String(m.id), i + 1);
        });
        setRanks(map);
      })
      .catch(() => {
        /* ribbons simply never appear */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Top10Context.Provider value={ranks}>{children}</Top10Context.Provider>;
}

/** 1-based rank of a title in today's Top 10, or null. Safe to call
 *  outside the provider (returns null). */
export function useTop10Rank(id: string | number | null | undefined): number | null {
  const ranks = useContext(Top10Context);
  if (id == null) return null;
  return ranks.get(String(id)) ?? null;
}

/** The corner ribbon Netflix puts on Top 10 titles in every row and in
 *  search results — rendered in CineVault cyan, not Netflix red.
 *  Parent must be position:relative. */
export function Top10Ribbon({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="In today's Top 10"
      className={`pointer-events-none absolute right-0 top-0 z-20 flex flex-col items-center rounded-bl-lg bg-[#06B6D4] px-1.5 py-1 text-black shadow-md ${className}`}
    >
      <span className="text-[8px] font-black leading-none tracking-[0.14em]">TOP</span>
      <span className="text-[13px] font-black leading-none">10</span>
    </span>
  );
}
