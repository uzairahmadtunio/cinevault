import type { Movie } from "@/lib/supabase";
import { glanceChips } from "@/lib/mediaHelpers";

/* "At a Glance" chip cluster (delta implication #3): dark pills with
 * small labels, only for facts our data backs — Top 10 rank today,
 * a recently added new season, a recent addition. Shared by the
 * billboard, the detail modal and the watch page. */
export function GlanceChips({
  movie,
  rank,
  className = "",
}: {
  movie: Partial<Movie>;
  rank?: number | null;
  className?: string;
}) {
  const chips = glanceChips(movie, rank);
  if (!chips.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15 backdrop-blur"
        >
          {c.key === "top10" && <span className="font-black text-[#06B6D4]">TOP 10</span>}
          {c.label}
        </span>
      ))}
    </div>
  );
}
