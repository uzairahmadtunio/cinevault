import { fetchTrailer } from "@/lib/api/server.movies";
import { cleanTitle } from "@/lib/supabase";

/* Client helper for trailer lookup. The actual TMDb call happens in the
 * fetchTrailer server function (key stays server-side); here we only
 * memoize per title for the session so billboard + modal don't refetch. */

type TrailerTitle = {
  id: string | number;
  title: string;
  year?: number | null;
  type?: string;
  tmdb_id?: number | null;
  tmdbId?: number | null;
};

const mem = new Map<string, string | null>();
const SS_PREFIX = "cv_trailer_";

export async function getTrailerKey(movie: TrailerTitle): Promise<string | null> {
  const id = String(movie.id);
  if (mem.has(id)) return mem.get(id) ?? null;
  try {
    const raw = window.sessionStorage.getItem(SS_PREFIX + id);
    if (raw !== null) {
      const v = raw ? raw : null;
      mem.set(id, v);
      return v;
    }
  } catch {
    /* sessionStorage unavailable — fall through to the server call */
  }
  let key: string | null = null;
  try {
    const res = await fetchTrailer({
      data: {
        title: cleanTitle(movie.title) || movie.title,
        year: movie.year ?? null,
        type: movie.type,
        tmdbId: movie.tmdb_id ?? movie.tmdbId ?? null,
      },
    });
    key = res?.key ?? null;
  } catch {
    key = null;
  }
  mem.set(id, key);
  try {
    window.sessionStorage.setItem(SS_PREFIX + id, key ?? "");
  } catch {
    /* best-effort cache */
  }
  return key;
}
