import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { showToast } from "@/components/cinevault";
import { cleanTitle, type Movie } from "@/lib/supabase";
import { isInMyList, subscribeMyList, toggleMyList } from "@/lib/myList";

/** Re-render the component whenever My List changes anywhere. */
export function useMyListVersion() {
  const [, setV] = useState(0);
  useEffect(() => subscribeMyList(() => setV((x) => x + 1)), []);
}

type Props = {
  movie: Pick<Movie, "id" | "title" | "thumbnail" | "banner" | "year">;
  variant?: "circle" | "full";
  className?: string;
};

/** Netflix-style + / ✓ My List toggle. `circle` for hover panels and the
 *  detail modal, `full` (labelled pill) for the detail page. */
export function MyListButton({ movie, variant = "circle", className = "" }: Props) {
  useMyListVersion();
  const inList = isInMyList(movie.id);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowIn = toggleMyList({
      id: movie.id,
      title: cleanTitle(movie.title) || movie.title,
      poster: movie.thumbnail ?? null,
      backdrop: movie.banner ?? null,
      year: movie.year ?? null,
    });
    showToast(nowIn ? "Added to My List" : "Removed from My List");
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={inList}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
          inList
            ? "border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]"
            : "border-white/30 bg-white/5 text-white hover:border-white/70"
        } ${className}`}
      >
        {inList ? <Check size={16} /> : <Plus size={16} />}
        {inList ? "In My List" : "My List"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={inList}
      title={inList ? "Remove from My List" : "Add to My List"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#141414]/80 backdrop-blur transition-colors ${
        inList ? "border-[#06B6D4] text-[#06B6D4]" : "border-white/50 text-white hover:border-white"
      } ${className}`}
    >
      {inList ? <Check size={17} /> : <Plus size={17} />}
    </button>
  );
}
