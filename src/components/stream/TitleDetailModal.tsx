import { useEffect, useState } from "react";
import { Download, Play, X } from "lucide-react";
import { QualityBadge, titlePosterDataUrl } from "@/components/cinevault";
import { cleanTitle, type Movie } from "@/lib/supabase";
import {
  fetchMovieById,
  fetchMoviesPaginated,
  fetchTrendingOrTopRated,
} from "@/lib/api/server.movies";
import {
  cleanFileSize,
  episodeBestLink,
  episodeDisplayTitle,
  episodeNumber,
  parseEpisodes,
  pickCardStream,
  validQualities,
  validRating,
} from "@/lib/mediaHelpers";
import { buildStreamUrl } from "@/utils/linkBypasser";
import { continueWatchingUrl, findContinueWatching, loadContinueWatching } from "@/lib/continueWatching";
import { MyListButton } from "./MyListButton";
import { TrailerHero } from "./TrailerHero";

type Props = {
  movieId: string | null;
  onClose: () => void;
  onOpenTitle: (id: string) => void;
};

/**
 * Netflix-style title detail modal for Stream Mode. Opens over the browse
 * view (body scroll locked, browse scroll position preserved), closes on
 * ✕ / backdrop click / Esc. The /movie/:id page stays untouched and keeps
 * serving Download Mode and direct links.
 */
export function TitleDetailModal({ movieId, onClose, onOpenTitle }: Props) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [related, setRelated] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);

  useEffect(() => {
    if (!movieId) {
      setMovie(null);
      setRelated([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMovie(null);
    setRelated([]);
    setDlOpen(false);
    (async () => {
      try {
        const res: any = await fetchMovieById({ data: { id: movieId } });
        if (cancelled) return;
        const m = (res?.movie as Movie) || null;
        setMovie(m);
        if (m) {
          let rel: Movie[] = [];
          const g = (m.genre || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)[0];
          if (g) {
            try {
              const r: any = await fetchMoviesPaginated({
                data: { page: 1, limit: 12, genres: g, sort: "latest" },
              });
              rel = ((r?.movies || []) as Movie[]).filter(
                (x) => String(x.id) !== String(m.id),
              );
            } catch {
              /* fall through to trending top-up */
            }
          }
          if (rel.length < 3) {
            try {
              const t: any = await fetchTrendingOrTopRated({ data: { limit: 12 } });
              const extra = ((t?.movies || []) as Movie[]).filter(
                (x) =>
                  String(x.id) !== String(m.id) &&
                  !rel.some((y) => String(y.id) === String(x.id)),
              );
              rel = [...rel, ...extra];
            } catch {
              /* related simply stays shorter */
            }
          }
          if (!cancelled) setRelated(rel.slice(0, 9));
        }
      } catch {
        if (!cancelled) setMovie(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  // Scroll lock + Esc while open.
  useEffect(() => {
    if (!movieId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [movieId, onClose]);

  if (!movieId) return null;

  const display = movie ? cleanTitle(movie.title) || movie.title : "";
  const rating = movie ? validRating(movie.imdb_rating) : null;
  const cw = movie
    ? (findContinueWatching(movie.id) ??
      loadContinueWatching().find((e) => String(e.id) === String(movie.id)))
    : undefined;
  const pick = movie ? pickCardStream(movie) : null;
  const playUrl = movie
    ? cw
      ? continueWatchingUrl(cw)
      : pick
        ? buildStreamUrl(pick.url, {
            id: movie.id,
            title: display,
            poster: movie.thumbnail,
            ep: pick.ep,
          })
        : null
    : null;
  const qualities = movie ? validQualities(movie) : [];
  const episodes = movie && movie.type === "series" ? parseEpisodes(movie) : [];
  const shots = movie
    ? movie.screenshots && movie.screenshots.length
      ? movie.screenshots.filter(Boolean)
      : [
          movie.screenshot_1,
          movie.screenshot_2,
          movie.screenshot_3,
          movie.screenshot_4,
          movie.screenshot_5,
          movie.screenshot_6,
        ].filter(Boolean)
    : [];
  const size = movie ? cleanFileSize(movie.file_size) : null;

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/75 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={display || "Title details"}
    >
      <div
        className="animate-fade-up mx-auto my-4 w-[min(880px,94vw)] overflow-hidden rounded-xl bg-[#181818] shadow-2xl md:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !movie ? (
          <div className="p-6 md:p-10">
            {loading ? (
              <>
                <div className="aspect-video w-full animate-pulse rounded-lg bg-white/5" />
                <div className="mt-6 h-6 w-2/3 animate-pulse rounded bg-white/5" />
                <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-white/5" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-white/5" />
              </>
            ) : (
              <div className="py-14 text-center">
                <p className="text-lg font-semibold text-white">Title not found</p>
                <p className="mt-1 text-sm text-[#B3B3B3]">
                  This title could not be loaded. It may have been removed from the catalog.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-5 rounded bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/80"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <TrailerHero
                movie={movie}
                image={movie.banner || movie.thumbnail}
                className="aspect-video w-full"
                delayMs={1200}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
                <div className="absolute bottom-5 left-6 right-20 z-10 md:left-10">
                  <h2 className="line-clamp-2 text-3xl font-black leading-tight text-white drop-shadow-lg md:text-5xl">
                    {display}
                  </h2>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {playUrl && (
                      <button
                        type="button"
                        onClick={() => window.location.assign(playUrl)}
                        className="flex items-center gap-2 rounded bg-white px-5 py-2 text-base font-bold text-black transition hover:bg-white/80"
                      >
                        <Play size={20} fill="currentColor" /> {cw ? "Resume" : "Play"}
                        {cw && cw.ep != null ? ` · Ep ${cw.ep}` : ""}
                      </button>
                    )}
                    <MyListButton movie={movie} />
                    {qualities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDlOpen((o) => !o)}
                        aria-expanded={dlOpen}
                        title="Download options"
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[#141414]/80 text-white backdrop-blur transition ${
                          dlOpen ? "border-[#06B6D4] text-[#06B6D4]" : "border-white/50 hover:border-white"
                        }`}
                      >
                        <Download size={17} />
                      </button>
                    )}
                  </div>
                  {dlOpen && qualities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {qualities.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() =>
                            window.location.assign(
                              buildStreamUrl(q.url, {
                                id: movie.id,
                                title: display,
                                poster: movie.thumbnail,
                              }),
                            )
                          }
                          className="rounded border border-white/30 bg-black/60 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:border-[#06B6D4] hover:text-[#06B6D4]"
                        >
                          {q.label} Download
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </TrailerHero>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-[#181818] text-white transition hover:bg-black"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-8 px-6 py-6 md:grid-cols-[2fr_1fr] md:px-10">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  {rating != null && (
                    <span className="font-bold text-amber-400">★ {rating.toFixed(1)}</span>
                  )}
                  {movie.year != null && <span className="text-[#E5E5E5]">{movie.year}</span>}
                  {movie.quality && <QualityBadge quality={movie.quality} size="sm" />}
                  {movie.duration && <span className="text-[#B3B3B3]">{movie.duration}</span>}
                  <span className="text-[#B3B3B3]">
                    {movie.type === "series" ? "Web Series" : "Movie"}
                  </span>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-[#E5E5E5]">
                  {movie.description || "No storyline available for this title yet."}
                </p>
              </div>
              <div className="space-y-2.5 text-[13px] leading-relaxed">
                {movie.cast_names && (
                  <p>
                    <span className="text-[#777]">Cast: </span>
                    <span className="text-[#E5E5E5]">{movie.cast_names}</span>
                  </p>
                )}
                {movie.director && (
                  <p>
                    <span className="text-[#777]">
                      {movie.type === "series" ? "Creator: " : "Director: "}
                    </span>
                    <span className="text-[#E5E5E5]">{movie.director}</span>
                  </p>
                )}
                {movie.genre && (
                  <p>
                    <span className="text-[#777]">Genres: </span>
                    <span className="text-[#E5E5E5]">{movie.genre}</span>
                  </p>
                )}
                {movie.platform && (
                  <p>
                    <span className="text-[#777]">Platform: </span>
                    <span className="text-[#E5E5E5]">{movie.platform}</span>
                  </p>
                )}
                {movie.language && (
                  <p>
                    <span className="text-[#777]">Language: </span>
                    <span className="text-[#E5E5E5]">{movie.language}</span>
                  </p>
                )}
                {size && (
                  <p>
                    <span className="text-[#777]">File size: </span>
                    <span className="text-[#E5E5E5]">{size}</span>
                  </p>
                )}
              </div>
            </div>

            {episodes.length > 0 && (
              <div className="px-6 pb-2 md:px-10">
                <div className="flex items-baseline justify-between border-t border-white/10 pt-5">
                  <h3 className="text-xl font-semibold text-white">Episodes</h3>
                  <span className="text-sm text-[#B3B3B3]">
                    {movie.season_number ? `Season ${movie.season_number} · ` : ""}
                    {episodes.length} Episode{episodes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  {episodes.map((epObj, idx) => {
                    const num = episodeNumber(epObj, idx);
                    const link = episodeBestLink(epObj);
                    const epCw = findContinueWatching(movie.id, num);
                    const extraTitle = episodeDisplayTitle(epObj);
                    const pct =
                      epCw && epCw.duration > 0
                        ? Math.min(100, (epCw.position / epCw.duration) * 100)
                        : 0;
                    return (
                      <div
                        key={num}
                        onClick={() => {
                          if (link) {
                            window.location.assign(
                              buildStreamUrl(link, {
                                id: movie.id,
                                title: display,
                                poster: movie.thumbnail,
                                ep: num,
                              }),
                            );
                          }
                        }}
                        className={`flex items-center gap-4 border-t border-white/10 px-2 py-3.5 ${
                          link ? "cursor-pointer transition hover:bg-white/5" : "opacity-50"
                       }`}
                      >
                        <span className="w-8 flex-none text-center text-xl text-[#E5E5E5]">
                          {num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {extraTitle || `Episode ${num}`}
                          </div>
                          {pct > 0 && (
                            <div className="mt-1.5 h-[3px] w-44 max-w-full rounded bg-[#404040]">
                              <div
                                className="h-full rounded bg-[#06B6D4]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/40 text-white">
                          <Play size={14} fill="currentColor" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {related.length > 0 && (
              <div className="px-6 pt-4 md:px-10">
                <h3 className="text-xl font-semibold text-white">More Like This</h3>
                <div className="mt-4 grid gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((m) => {
                    const mDisplay = cleanTitle(m.title) || m.title;
                    const mRating = validRating(m.imdb_rating);
                    return (
                      <div
                        key={m.id}
                        className="cursor-pointer overflow-hidden rounded-lg bg-[#2A2A2A] transition hover:bg-[#333]"
                        onClick={() => onOpenTitle(String(m.id))}
                      >
                        <div className="relative">
                          <img
                            src={m.banner || m.thumbnail || titlePosterDataUrl(mDisplay)}
                            alt={mDisplay}
                            loading="lazy"
                            className="aspect-video w-full object-cover"
                          />
                          <div
                            className="absolute right-2 top-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MyListButton movie={m} />
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-2 text-xs">
                            {mRating != null && (
                              <span className="font-bold text-amber-400">
                                ★ {mRating.toFixed(1)}
                              </span>
                            )}
                            {m.year != null && <span className="text-[#E5E5E5]">{m.year}</span>}
                            {m.quality && (
                              <span className="rounded border border-white/40 px-1 py-px text-[10px] font-semibold text-[#E5E5E5]">
                                {m.quality}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 line-clamp-1 text-sm font-semibold text-white">
                            {mDisplay}
                          </div>
                          {m.description && (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#B3B3B3]">
                              {m.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {shots.length > 0 && (
              <div className="px-6 pb-8 pt-4 md:px-10">
                <h3 className="text-xl font-semibold text-white">Screenshots</h3>
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                  {shots.map((s, i) => (
                    <img
                      key={i}
                      src={s as string}
                      alt={`Screenshot ${i + 1}`}
                      loading="lazy"
                      className="h-24 flex-none rounded-md object-cover md:h-28"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
