import { useEffect, useState } from "react";
import { ArrowLeft, Download, Play, X } from "lucide-react";
import { QualityBadge, titlePosterDataUrl } from "@/components/cinevault";
import { cleanTitle, type Movie } from "@/lib/supabase";
import {
  fetchMovieById,
  fetchMoviesPaginated,
  fetchTrendingOrTopRated,
} from "@/lib/api/server.movies";
import {
  bestVariant,
  cleanFileSize,
  episodeBestLink,
  episodeDisplayTitle,
  episodeNumber,
  metaGenres,
  parseEpisodes,
  pickCardStream,
  playableLinkCount,
  runtimeLabel,
  titleKey,
  validQualities,
  validRating,
} from "@/lib/mediaHelpers";
import { buildStreamUrl } from "@/utils/linkBypasser";
import { continueWatchingUrl, findContinueWatching, loadContinueWatching } from "@/lib/continueWatching";
import { MyListButton } from "./MyListButton";
import { TrailerHero } from "./TrailerHero";
import { GlanceChips } from "./StreamHome";
import { Top10Ribbon, useTop10Rank } from "./Top10Context";

type Props = {
  movieId: string | null;
  onClose: () => void;
  onOpenTitle: (id: string) => void;
};

/** More Like This card — carries the Top 10 ribbon when the title is
 *  in today's Top 10 (implication #10) and the standardised metadata
 *  order (Year · Rating · Quality, implication #9). */
function RelatedCard({
  movie: m,
  onOpenTitle,
}: {
  movie: Movie;
  onOpenTitle: (id: string) => void;
}) {
  const mDisplay = cleanTitle(m.title) || m.title;
  const mRating = validRating(m.imdb_rating);
  const mRank = useTop10Rank(m.id);
  return (
    <div
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
        {mRank != null && <Top10Ribbon />}
        <div
          className={`absolute top-2 ${mRank != null ? "right-12" : "right-2"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MyListButton movie={m} />
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 text-xs">
          {m.year != null && <span className="text-[#E5E5E5]">{m.year}</span>}
          {mRating != null && (
            <span className="font-bold text-amber-400">★ {mRating.toFixed(1)}</span>
          )}
          {m.quality && (
            <span className="rounded border border-white/40 px-1 py-px text-[10px] font-semibold text-[#E5E5E5]">
              {m.quality}
            </span>
          )}
        </div>
        <div className="mt-1.5 line-clamp-1 text-sm font-semibold text-white">{mDisplay}</div>
        {m.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#B3B3B3]">
            {m.description}
          </p>
        )}
      </div>
    </div>
  );
}

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
        let m = (res?.movie as Movie) || null;
        // F3: if this row is a weak duplicate (e.g. a "Links coming
        // soon" shell) and a same-title row carries more playable
        // links, present the playable variant instead.
        if (m) {
          try {
            const cleaned = cleanTitle(m.title) || m.title;
            const vr: any = await fetchMoviesPaginated({
              data: { page: 1, limit: 10, search: cleaned, sort: "latest" },
            });
            const variants = ((vr?.movies || []) as Movie[]).filter(
              (x) => titleKey(x.title) === titleKey(m!.title),
            );
            const best = bestVariant(variants);
            if (best && String(best.id) !== String(m.id) && playableLinkCount(best) > playableLinkCount(m)) {
              const br: any = await fetchMovieById({ data: { id: String(best.id) } });
              if (br?.movie) m = br.movie as Movie;
            }
          } catch {
            /* variant swap is best-effort — the opened row still shows */
          }
          if (cancelled) return;
        }
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

  const rank = useTop10Rank(movie?.id ?? movieId);

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
                  className="mt-5 rounded-full bg-white px-6 py-2 text-sm font-bold text-black transition hover:bg-white/80"
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
                  <GlanceChips movie={movie} rank={rank} className="mt-3" />
                  <div className="mt-4 flex flex-wrap items-start gap-2.5">
                    {playUrl && (
                      <button
                        type="button"
                        onClick={() => window.location.assign(playUrl)}
                        className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-base font-bold text-black transition hover:bg-white/80"
                      >
                        <Play size={20} fill="currentColor" /> {cw ? "Resume" : "Play"}
                        {cw && cw.ep != null ? ` · Ep ${cw.ep}` : ""}
                      </button>
                    )}
                    {/* Mobile detail anatomy (implication #8): labelled
                        action row under Play, as in the mobile app. */}
                    <span className="flex flex-col items-center gap-1">
                      <MyListButton movie={movie} />
                      <span className="text-[10px] font-medium text-white/75 md:hidden">My List</span>
                    </span>
                    {qualities.length > 0 && (
                      <span className="flex flex-col items-center gap-1">
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
                        <span className="text-[10px] font-medium text-white/75 md:hidden">Download</span>
                      </span>
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
                          className="rounded-full border border-white/30 bg-black/60 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:border-[#06B6D4] hover:text-[#06B6D4]"
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
                {/* Standardised metadata line (implication #9):
                    Genre · Year · Runtime/Seasons · Rating · Quality */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  {metaGenres(movie).length > 0 && (
                    <span className="font-medium text-[#E5E5E5]">
                      {metaGenres(movie).slice(0, 3).join(" · ")}
                    </span>
                  )}
                  {movie.year != null && <span className="text-[#E5E5E5]">{movie.year}</span>}
                  {runtimeLabel(movie) && (
                    <span className="text-[#B3B3B3]">{runtimeLabel(movie)}</span>
                  )}
                  {rating != null && (
                    <span className="font-bold text-amber-400">★ {rating.toFixed(1)}</span>
                  )}
                  {movie.quality && <QualityBadge quality={movie.quality} size="sm" />}
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
                {/* Drill-in season header (implication #6). Our catalog
                    stores one season per entry (season_number), so there
                    is no season list to drill back to — the header takes
                    the "Season N" form and the current episode is the
                    expanded one, the rest collapsed rows, as in V1. */}
                <div className="flex items-baseline justify-between border-t border-white/10 pt-5">
                  <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
                    <ArrowLeft size={19} className="text-[#B3B3B3]" />
                    {movie.season_number ? `Season ${movie.season_number}` : "Episodes"}
                  </h3>
                  <span className="text-sm text-[#B3B3B3]">
                    {episodes.length} Episode{episodes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  {episodes.map((epObj, idx) => {
                    const num = episodeNumber(epObj, idx);
                    const link = episodeBestLink(epObj);
                    // Fallback targets for episodes whose stored links
                    // are junk-but-present (e.g. source post-page URLs
                    // from a bad scrape) or empty: navigate anyway with
                    // the raw link / the title's best stream. The watch
                    // page resolves that episode's real candidates (F1
                    // chain) and, in Stream Mode, its provider servers
                    // don't depend on the local link at all. Previously
                    // such rows were rendered dead (no cursor, click did
                    // nothing) — the gate hit exactly that on MobLand.
                    const rawLink = ["link_480p", "link_720p", "link_1080p", "link_4k"]
                      .map((f) => (epObj as any)?.[f])
                      .find((u) => typeof u === "string" && u.trim());
                    const epTarget = link || rawLink || pick?.url || null;
                    const playEpisode = () => {
                      if (!epTarget) return;
                      window.location.assign(
                        buildStreamUrl(epTarget, {
                          id: movie.id,
                          title: display,
                          poster: movie.thumbnail,
                          ep: num,
                        }),
                      );
                    };
                    const epCw = findContinueWatching(movie.id, num);
                    const extraTitle = episodeDisplayTitle(epObj);
                    const pct =
                      epCw && epCw.duration > 0
                        ? Math.min(100, (epCw.position / epCw.duration) * 100)
                        : 0;
                    const isCurrent = pct > 0 || (cw?.ep != null && cw.ep === num);
                    return (
                      <div
                        key={num}
                        onClick={playEpisode}
                        className={`flex items-center gap-4 border-t border-white/10 px-2 ${
                          isCurrent ? "bg-white/5 py-4" : "py-3.5"
                        } ${epTarget ? "cursor-pointer transition hover:bg-white/5" : "opacity-50"}`}
                      >
                        <span className="w-8 flex-none text-center text-xl text-[#E5E5E5]">
                          {num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-sm font-semibold text-white ${
                              isCurrent ? "line-clamp-2" : "truncate"
                            }`}
                          >
                            {extraTitle || `Episode ${num}`}
                          </div>
                          {isCurrent && (
                            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#06B6D4]">
                              Continue Watching{pct > 0 ? ` · ${Math.round(pct)}% watched` : ""}
                            </div>
                          )}
                          {pct > 0 && (
                            <div className="mt-1.5 h-[3px] w-44 max-w-full rounded bg-[#404040]">
                              <div
                                className="h-full rounded bg-[#06B6D4]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Play episode ${num}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            playEpisode();
                          }}
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/40 text-white transition hover:border-white hover:bg-white/10"
                        >
                          <Play size={14} fill="currentColor" />
                        </button>
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
                  {related.map((m) => (
                    <RelatedCard key={m.id} movie={m} onOpenTitle={onOpenTitle} />
                  ))}
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
