import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Info,
  MoreVertical,
  Play,
  Search as SearchIcon,
  ThumbsUp,
  X,
} from "lucide-react";
import { QualityBadge, titlePosterDataUrl } from "@/components/cinevault";
import { cleanTitle, type Movie } from "@/lib/supabase";
import {
  fetchFeaturedOrLatest,
  fetchMoviesByIds,
  fetchMoviesPaginated,
  fetchTrendingOrTopRated,
} from "@/lib/api/server.movies";
import {
  dedupeByTitle,
  glanceChips,
  linkHostTier,
  metaGenres,
  pickCardStream,
  runtimeLabel,
  validRating,
} from "@/lib/mediaHelpers";
import { buildStreamUrl } from "@/utils/linkBypasser";
import type { CWEntry } from "@/lib/continueWatching";
import type { FuzzyHit } from "@/lib/searchIndex";
import { loadMyList } from "@/lib/myList";
import { isLiked, subscribeLikes, toggleLike } from "@/lib/likes";
import { MyListButton, useMyListVersion } from "./MyListButton";
import { TrailerHero } from "./TrailerHero";
import { Top10Ribbon, useTop10Rank } from "./Top10Context";

/* ------------------------------------------------------------------ */
/* Shared context: anything inside Stream Mode can open the detail    */
/* modal for a title id.                                              */
/* ------------------------------------------------------------------ */
const OpenTitleContext = createContext<(id: string) => void>(() => {});
export const useOpenTitle = () => useContext(OpenTitleContext);

type CardMovie = Partial<Movie> & { id: string | number; title: string };

const displayTitle = (m: CardMovie) => cleanTitle(m.title) || m.title;
const genreList = (m: CardMovie) => metaGenres(m as Partial<Movie>);

/* "At a Glance" chips live in their own module (shared with the modal
 * and the watch page). */
import { GlanceChips } from "./GlanceChips";
export { GlanceChips };

/* Hover-card thumbs (delta implication #4): the viewer's own local
 * rating, stored on-device like My List. */
function LikeButton({ id }: { id: string | number }) {
  const [, setV] = useState(0);
  useEffect(() => subscribeLikes(() => setV((x) => x + 1)), []);
  const liked = isLiked(id);
  return (
    <button
      type="button"
      aria-label={liked ? "Rated: liked" : "Rate: like"}
      aria-pressed={liked}
      title={liked ? "You liked this" : "Like this"}
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(id);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 backdrop-blur transition-colors ${
        liked
          ? "border-[#06B6D4] bg-[#06B6D4]/20 text-[#06B6D4]"
          : "border-white/50 bg-[#141414]/80 text-white hover:border-white"
      }`}
    >
      <ThumbsUp size={15} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* StreamCard — 16:9 backdrop card (portrait for Top 10) with a       */
/* Netflix-style dwell hover expansion rendered in a portal so row    */
/* overflow never clips it. Tap (touch) opens the detail modal; the   */
/* play badge always opens the player directly.                       */
/* ------------------------------------------------------------------ */
function StreamCard({
  movie,
  variant = "backdrop",
  widthClass = "w-[208px] sm:w-[238px] xl:w-[264px]",
  progress,
  onRemoveFromRow,
}: {
  movie: CardMovie;
  variant?: "backdrop" | "poster";
  widthClass?: string;
  progress?: number;
  onRemoveFromRow?: () => void;
}) {
  const openTitle = useOpenTitle();
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [imgErr, setImgErr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const display = displayTitle(movie);
  const rawImg = variant === "poster" ? movie.thumbnail || movie.banner : movie.banner || movie.thumbnail;
  const src = imgErr || !rawImg ? titlePosterDataUrl(display) : rawImg;
  const stream = pickCardStream(movie as Movie);
  const rating = validRating(movie.imdb_rating);
  const genres = genreList(movie);
  const rank = useTop10Rank(movie.id);
  const chips = glanceChips(movie as Partial<Movie>, rank);
  const runtime = runtimeLabel(movie as Partial<Movie>);

  const openPlayer = () => {
    if (!stream) return;
    window.location.assign(
      buildStreamUrl(stream.url, {
        id: movie.id,
        title: display,
        poster: movie.thumbnail,
        ep: stream.ep,
      }),
    );
  };

  const handleBodyClick = () => {
    const touch =
      typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
    if (!touch && stream) openPlayer();
    else openTitle(String(movie.id));
  };

  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (min-width: 768px)").matches;

  const onEnter = () => {
    if (!canHover()) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      const el = wrapRef.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
      setExpanded(true);
    }, 450);
  };
  const scheduleClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    closeTimer.current = window.setTimeout(() => setExpanded(false), 140);
  };

  useEffect(() => {
    if (!expanded) return;
    const close = () => setExpanded(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [expanded]);

  const expandedCard = () => {
    if (!rect || typeof document === "undefined") return null;
    const w = rect.width * 1.45;
    const artH = w * (variant === "poster" ? 1.5 : 9 / 16);
    // Panel grows with the focused-preview content (implication #1
    // subset): synopsis line + At-a-Glance chips when present.
    const panelH = 118 + (movie.description ? 36 : 0) + (chips.length ? 26 : 0);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    const top = Math.max(
      8,
      Math.min(
        window.innerHeight - artH - panelH - 8,
        rect.top + rect.height / 2 - (artH + panelH) / 2,
      ),
    );
    return createPortal(
      <div
        className="fixed z-[70] overflow-hidden rounded-lg bg-[#181818] shadow-[0_12px_24px_rgba(0,0,0,0.8)] ring-1 ring-white/10 animate-fade-up"
        style={{ left, top, width: w }}
        onMouseEnter={() => {
          if (closeTimer.current) window.clearTimeout(closeTimer.current);
        }}
        onMouseLeave={scheduleClose}
      >
        <div className="relative cursor-pointer" onClick={stream ? openPlayer : () => openTitle(String(movie.id))}>
          <img src={src} alt={display} className="w-full object-cover" style={{ height: artH }} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#181818] to-transparent p-3 pt-8">
            <div className="line-clamp-1 text-sm font-bold text-white drop-shadow">{display}</div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            {stream && (
              <button
                type="button"
                onClick={openPlayer}
                aria-label="Play"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/80"
              >
                <Play size={16} fill="currentColor" />
              </button>
            )}
            <MyListButton movie={movie as Movie} />
            <LikeButton id={movie.id} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => openTitle(String(movie.id))}
              aria-label="More info"
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/50 text-white transition hover:border-white"
            >
              <ChevronDown size={17} />
            </button>
          </div>
          {/* Standardised metadata line (implication #9): Genre · Year ·
              Runtime/Seasons · Rating · Quality. No match % — Netflix
              itself omits it on most cards (delta CORRECTS #5). */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            {genres.length > 0 && (
              <span className="font-medium text-[#E5E5E5]">{genres.slice(0, 2).join(" · ")}</span>
            )}
            {movie.year != null && <span className="text-[#E5E5E5]">{movie.year}</span>}
            {runtime && <span className="text-[#B3B3B3]">{runtime}</span>}
            {rating != null && <span className="font-bold text-amber-400">★ {rating.toFixed(1)}</span>}
            {movie.quality && (
              <span className="rounded border border-white/40 px-1 py-px text-[10px] font-semibold text-[#E5E5E5]">
                {movie.quality}
              </span>
            )}
          </div>
          {movie.description && (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[#B3B3B3]">
              {movie.description}
            </p>
          )}
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/10"
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}
          {progress != null && (
            <div className="mt-2.5 h-[3px] w-full rounded bg-[#404040]">
              <div
                className="h-full rounded bg-[#06B6D4]"
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <div
      ref={wrapRef}
      className={`relative flex-none ${widthClass}`}
      onMouseEnter={onEnter}
      onMouseLeave={() => {
        scheduleClose();
        setMenuOpen(false);
      }}
    >
      <div
        className="relative cursor-pointer overflow-hidden rounded-md bg-[#181818]"
        onClick={handleBodyClick}
      >
        <img
          src={src}
          alt={display}
          loading="lazy"
          onError={() => setImgErr(true)}
          className={`w-full object-cover ${variant === "poster" ? "aspect-[2/3]" : "aspect-video"}`}
        />
        {movie.quality && (
          <div className="absolute left-1.5 top-1.5">
            <QualityBadge quality={movie.quality} size="sm" />
          </div>
        )}
        {rank != null && <Top10Ribbon />}
        {onRemoveFromRow && (
          <button
            type="button"
            aria-label="Row options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className={`absolute right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/85 ${
              rank != null ? "top-11" : "top-1.5"
            }`}
          >
            <MoreVertical size={15} />
          </button>
        )}
        {stream && (
          <button
            type="button"
            aria-label={`Play ${display}`}
            onClick={(e) => {
              e.stopPropagation();
              openPlayer();
            }}
            className="absolute bottom-1.5 left-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#06B6D4] text-white shadow-lg shadow-cyan-500/40 transition hover:bg-cyan-400"
          >
            <Play size={14} fill="currentColor" />
          </button>
        )}
        {variant === "backdrop" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-2 pb-1.5 pt-6">
            <div className="line-clamp-1 text-[13px] font-semibold text-white drop-shadow">
              {display}
            </div>
          </div>
        )}
        {progress != null && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-[#404040]">
            <div
              className="h-full bg-[#06B6D4]"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        )}
      </div>
      {menuOpen && onRemoveFromRow && (
        <div
          className={`absolute right-0 z-30 w-44 overflow-hidden rounded-md border border-white/15 bg-[#181818] py-1 shadow-2xl ${
            rank != null ? "top-[4.7rem]" : "top-9"
          }`}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-[#E5E5E5] hover:bg-white/10"
            onClick={() => {
              setMenuOpen(false);
              openTitle(String(movie.id));
            }}
          >
            More Info
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-[#E5E5E5] hover:bg-white/10"
            onClick={() => {
              setMenuOpen(false);
              onRemoveFromRow();
            }}
          >
            Remove from row
          </button>
        </div>
      )}
      {expanded && expandedCard()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StreamRow — horizontal row with desktop paging chevrons + peek.    */
/* ------------------------------------------------------------------ */
function StreamRow({ title, children }: { title: string; children: ReactNode }) {
  const scRef = useRef<HTMLDivElement>(null);
  const page = (dir: number) => {
    const el = scRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <section className="relative mb-6 md:mb-9">
      <h2 className="mb-2 px-4 text-base font-semibold text-[#E5E5E5] md:px-12 md:text-xl">
        {title}
      </h2>
      <div className="group/row relative">
        <div
          ref={scRef}
          className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-4 py-1 md:px-12"
        >
          {children}
        </div>
        <button
          type="button"
          aria-label="Scroll row back"
          onClick={() => page(-1)}
          className="absolute bottom-0 left-0 top-0 z-30 hidden w-12 items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover/row:opacity-100 md:flex"
        >
          <ChevronLeft size={26} />
        </button>
        <button
          type="button"
          aria-label="Scroll row forward"
          onClick={() => page(1)}
          className="absolute bottom-0 right-0 top-0 z-30 hidden w-12 items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover/row:opacity-100 md:flex"
        >
          <ChevronRight size={26} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Billboard — one featured title, trailer crossfade (TrailerHero).   */
/* ------------------------------------------------------------------ */
function Billboard({ movie }: { movie: Movie }) {
  const openTitle = useOpenTitle();
  const display = displayTitle(movie);
  const stream = pickCardStream(movie);
  const rating = validRating(movie.imdb_rating);
  const genres = genreList(movie);
  const rank = useTop10Rank(movie.id);
  const runtime = runtimeLabel(movie);
  const play = () => {
    if (!stream) return;
    window.location.assign(
      buildStreamUrl(stream.url, {
        id: movie.id,
        title: display,
        poster: movie.thumbnail,
        ep: stream.ep,
      }),
    );
  };
  return (
    <TrailerHero
      movie={movie}
      image={movie.banner || movie.thumbnail}
      className="h-[62vh] min-h-[430px] md:h-[56.25vw] md:max-h-[92vh] md:min-h-[540px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#141414]/85 via-[#141414]/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#141414] to-transparent" />
      <div className="absolute bottom-[13%] left-4 z-10 max-w-[620px] pr-4 md:left-12">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#06B6D4] md:text-xs">
          <Clapperboard size={15} /> CineVault Featured
        </div>
        <h1 className="mt-3 line-clamp-2 text-4xl font-black leading-[1.02] text-white drop-shadow-lg md:text-6xl">
          {display}
        </h1>
        <GlanceChips movie={movie} rank={rank} className="mt-3.5" />
        {/* Standardised metadata line (implication #9):
            Genre · Year · Runtime/Seasons · Rating · Quality */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {genres.length > 0 && (
            <span className="font-medium text-white/90">{genres.join(" · ")}</span>
          )}
          {movie.year != null && <span className="text-white/90">{movie.year}</span>}
          {runtime && <span className="text-white/80">{runtime}</span>}
          {rating != null && <span className="font-bold text-amber-400">★ {rating.toFixed(1)}</span>}
          {movie.quality && (
            <span className="rounded border border-white/40 px-1.5 py-px text-[11px] font-semibold text-white/90">
              {movie.quality}
            </span>
          )}
        </div>
        {movie.description && (
          <p className="mt-3 hidden max-w-[540px] text-sm leading-relaxed text-white/90 drop-shadow line-clamp-3 sm:block md:text-[15px]">
            {movie.description}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          {stream && (
            <button
              type="button"
              onClick={play}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-base font-bold text-black transition hover:bg-white/80 md:px-8 md:text-lg"
            >
              <Play size={22} fill="currentColor" /> Play
            </button>
          )}
          <button
            type="button"
            onClick={() => openTitle(String(movie.id))}
            className="flex items-center gap-2 rounded-full bg-[rgba(109,109,110,0.7)] px-6 py-2.5 text-base font-bold text-white backdrop-blur transition hover:bg-[rgba(109,109,110,0.45)] md:px-7 md:text-lg"
          >
            <Info size={22} /> More Info
          </button>
        </div>
      </div>
    </TrailerHero>
  );
}

/* ------------------------------------------------------------------ */
/* StreamHome — billboard + all rows.                                 */
/* ------------------------------------------------------------------ */
const GENRE_ORDER = ["Action", "Comedy", "Drama", "Thriller", "Horror", "Romance"];

function StreamHome({
  cwEntries,
  onRemoveCw,
}: {
  cwEntries: CWEntry[];
  onRemoveCw: (e: CWEntry) => void;
}) {
  const [featured, setFeatured] = useState<Movie[]>([]);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [latest, setLatest] = useState<Movie[]>([]);
  const [genreRows, setGenreRows] = useState<{ genre: string; movies: Movie[] }[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [cwMovies, setCwMovies] = useState<Record<string, Movie>>({});
  const [listMovies, setListMovies] = useState<Movie[]>([]);
  const [because, setBecause] = useState<{ title: string; movies: Movie[] } | null>(null);
  const myListVersion = useMyListVersion();

  useEffect(() => {
    let cancelled = false;
    // F6: each shelf resolves independently — the billboard paints as
    // soon as featured OR trending lands instead of waiting for all
    // three requests (and the genre rows) to finish.
    let settledCount = 0;
    const settle = <T,>(p: Promise<T>, apply: (v: T) => void) =>
      p
        .then((v) => {
          if (!cancelled) apply(v);
        })
        .catch(() => {})
        .finally(() => {
          settledCount += 1;
          if (!cancelled && settledCount >= 3) setHomeLoading(false);
        });
    settle(fetchFeaturedOrLatest({ data: { limit: 8 } }), (f: any) =>
      setFeatured(((f as any)?.movies || []) as Movie[]),
    );
    settle(fetchTrendingOrTopRated({ data: { limit: 16 } }), (t: any) =>
      setTrending(((t as any)?.movies || []) as Movie[]),
    );
    settle(fetchMoviesPaginated({ data: { page: 1, limit: 14, sort: "latest" } }), (l: any) =>
      setLatest(((l as any)?.movies || []) as Movie[]),
    );
    (async () => {
      const rows = await Promise.all(
        GENRE_ORDER.map(async (g) => {
          try {
            const r: any = await fetchMoviesPaginated({
              data: { page: 1, limit: 14, genres: g, sort: "latest" },
            });
            return { genre: g, movies: (r?.movies || []) as Movie[] };
          } catch {
            return { genre: g, movies: [] as Movie[] };
          }
        }),
      );
      if (!cancelled) setGenreRows(rows.filter((r) => r.movies.length >= 6));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cwIdsKey = cwEntries.map((e) => String(e.id)).join(",");
  useEffect(() => {
    if (!cwEntries.length) {
      setCwMovies({});
      return;
    }
    let cancelled = false;
    fetchMoviesByIds({ data: { ids: cwEntries.map((e) => String(e.id)) } })
      .then((r: any) => {
        if (cancelled) return;
        const map: Record<string, Movie> = {};
        (r?.movies || []).forEach((m: Movie) => {
          map[String(m.id)] = m;
        });
        setCwMovies(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwIdsKey]);

  useEffect(() => {
    const items = loadMyList();
    if (!items.length) {
      setListMovies([]);
      return;
    }
    let cancelled = false;
    const snapshots = items.map(
      (i) =>
        ({
          id: i.id,
          title: i.title,
          thumbnail: i.poster,
          banner: i.backdrop,
          year: i.year,
        }) as unknown as Movie,
    );
    fetchMoviesByIds({ data: { ids: items.map((i) => i.id) } })
      .then((r: any) => {
        if (cancelled) return;
        const byId = new Map<string, Movie>(
          ((r?.movies || []) as Movie[]).map((m) => [String(m.id), m]),
        );
        setListMovies(items.map((i) => byId.get(i.id) || snapshots[items.indexOf(i)]));
      })
      .catch(() => {
        if (!cancelled) setListMovies(snapshots);
      });
    return () => {
      cancelled = true;
    };
  }, [myListVersion]);

  useEffect(() => {
    if (!cwEntries.length || !Object.keys(cwMovies).length) return;
    let cancelled = false;
    (async () => {
      const source = cwEntries.map((e) => cwMovies[String(e.id)]).find((m) => m && m.genre);
      if (!source) return;
      const g = genreList(source)[0];
      if (!g) return;
      try {
        const r: any = await fetchMoviesPaginated({
          data: { page: 1, limit: 14, genres: g, sort: "latest" },
        });
        if (cancelled) return;
        const cwIds = new Set(cwEntries.map((e) => String(e.id)));
        const movies = ((r?.movies || []) as Movie[]).filter((m) => !cwIds.has(String(m.id)));
        if (movies.length >= 4) {
          setBecause({
            title: `Because You Watched "${displayTitle(source)}"`,
            movies,
          });
        }
      } catch {
        /* row simply stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cwMovies, cwEntries]);

  const billboard = useMemo(() => {
    // F1 audit: prefer a featured title whose best source is on a
    // playable host (mdrive tier) over one that leads with a blocked
    // hubcloud link; featured order breaks ties.
    const candidates = [...featured, ...trending].filter(
      (m) => (m.banner || m.thumbnail) && pickCardStream(m),
    );
    let best: Movie | null = null;
    let bestTier = -1;
    for (const m of candidates) {
      const s = pickCardStream(m);
      const tier = s ? linkHostTier(s.url) : 0;
      if (tier > bestTier) {
        best = m;
        bestTier = tier;
      }
    }
    return best || featured[0] || trending[0] || null;
  }, [featured, trending]);

  const cwCard = (e: CWEntry): CardMovie =>
    cwMovies[String(e.id)] ||
    ({ id: String(e.id), title: e.title, thumbnail: e.poster } as unknown as Movie);
  const cwProgress = (e: CWEntry) =>
    e.duration > 0 ? Math.min(1, e.position / e.duration) : undefined;
  const watchAgain = cwEntries.filter(
    (e) => e.duration > 0 && e.position / e.duration >= 0.95,
  );

  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      {billboard ? (
        <Billboard movie={billboard} />
      ) : (
        /* F6: branded skeleton from first paint — never a black void
           while the featured shelf is in flight. */
        <div className="relative h-[62vh] min-h-[430px] overflow-hidden bg-gradient-to-b from-[#1b1b1b] to-[#141414] md:h-[56.25vw] md:max-h-[92vh] md:min-h-[540px]">
          <div className="absolute bottom-[13%] left-4 max-w-[620px] md:left-12">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#06B6D4] md:text-xs">
              <Clapperboard size={15} /> CineVault Featured
            </div>
            <div className="mt-4 h-10 w-72 max-w-[70vw] animate-pulse rounded bg-white/10 md:h-14" />
            <div className="mt-4 h-4 w-52 animate-pulse rounded bg-white/8" />
            <div className="mt-3 hidden h-4 w-96 max-w-[60vw] animate-pulse rounded bg-white/6 sm:block" />
            <div className="mt-6 flex gap-3">
              <div className="h-11 w-32 animate-pulse rounded-full bg-white/15" />
              <div className="h-11 w-36 animate-pulse rounded-full bg-white/8" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#141414] to-transparent" />
        </div>
      )}

      <div className="relative z-10 -mt-14 pb-16 md:-mt-24">
        {/* Row order follows the video evidence (implication #5 /
            delta CORRECTS #3 + #6): Continue Watching has no sacred
            first slot — My List may precede it, as on V1's home. */}
        {listMovies.length > 0 && (
          <StreamRow title="My List">
            {listMovies.map((m) => (
              <StreamCard key={`ml-${m.id}`} movie={m} />
            ))}
          </StreamRow>
        )}

        {trending.length > 0 && (
          <StreamRow title="Trending Now">
            {trending.map((m) => (
              <StreamCard key={`tr-${m.id}`} movie={m} />
            ))}
          </StreamRow>
        )}

        {cwEntries.length > 0 && (
          <StreamRow title="Continue Watching">
            {cwEntries.map((e) => (
              <StreamCard
                key={`cw-${e.id}-${e.ep ?? "m"}`}
                movie={cwCard(e)}
                progress={cwProgress(e)}
                onRemoveFromRow={() => onRemoveCw(e)}
              />
            ))}
          </StreamRow>
        )}

        {trending.length >= 4 && (
          <StreamRow title="Top 10 on CineVault Today">
            {trending.slice(0, 10).map((m, i) => (
              <div key={`t10-${m.id}`} className="flex flex-none items-end">
                <span
                  aria-hidden
                  className="select-none font-black leading-[0.78] tracking-tighter"
                  style={{
                    fontSize: "clamp(104px, 14.5vw, 205px)",
                    color: "#141414",
                    WebkitTextStroke: "4px #4d4d4d",
                    marginRight: "-0.16em",
                  }}
                >
                  {i + 1}
                </span>
                <div className="relative z-10">
                  <StreamCard movie={m} variant="poster" widthClass="w-[118px] md:w-[138px]" />
                </div>
              </div>
            ))}
          </StreamRow>
        )}

        {latest.length > 0 && (
          <StreamRow title="New on CineVault">
            {latest.map((m) => (
              <StreamCard key={`new-${m.id}`} movie={m} />
            ))}
          </StreamRow>
        )}

        {genreRows.map((row) => (
          <StreamRow key={`g-${row.genre}`} title={row.genre}>
            {row.movies.map((m) => (
              <StreamCard key={`g-${row.genre}-${m.id}`} movie={m} />
            ))}
          </StreamRow>
        ))}

        {because && (
          <StreamRow title={because.title}>
            {because.movies.map((m) => (
              <StreamCard key={`bw-${m.id}`} movie={m} />
            ))}
          </StreamRow>
        )}

        {watchAgain.length > 0 && (
          <StreamRow title="Watch It Again">
            {watchAgain.map((e) => (
              <StreamCard
                key={`wa-${e.id}-${e.ep ?? "m"}`}
                movie={cwCard(e)}
                progress={cwProgress(e)}
              />
            ))}
          </StreamRow>
        )}

        {!homeLoading && !billboard && trending.length === 0 && latest.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-[#B3B3B3] md:px-12">
            The catalog could not be loaded right now. Please refresh in a moment.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StreamResults — Netflix-style results grid for search / filters.   */
/* ------------------------------------------------------------------ */
const SEARCH_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Thriller",
  "Sci-Fi", "Horror", "Romance", "Fantasy", "Animation",
  "Crime", "Mystery",
];

function StreamResults({
  resultsParams,
  searchQuery,
  didYouMean,
  onDidYouMean,
  fuzzy,
  searchInput,
  onSearchChange,
  suggestions,
  onSuggestionPick,
  resultsLabel,
  onResetAll,
  onGenrePick,
  activeGenre,
}: StreamResultsProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boxFocus, setBoxFocus] = useState(false);
  const paramsKey = JSON.stringify(resultsParams || {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMoviesPaginated({
      data: {
        page: 1,
        limit: 60,
        sort: "latest",
        filter: resultsParams?.filter || undefined,
        search: resultsParams?.search || undefined,
        genres: resultsParams?.genres || undefined,
        years: resultsParams?.years || undefined,
      },
    })
      .then((r: any) => {
        if (cancelled) return;
        // F3: collapse same-title duplicates to the most playable
        // variant so a junk "coming soon" row never fronts a search.
        const raw = (r?.movies || []) as Movie[];
        const deduped = dedupeByTitle(raw);
        setMovies(deduped);
        setTotal(resultsParams?.search ? deduped.length : r?.total || 0);
      })
      .catch(() => {
        if (!cancelled) {
          setMovies([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  return (
    <div className="min-h-screen bg-[#141414] px-4 pb-16 pt-24 text-[#E5E5E5] md:px-12">
      <button
        type="button"
        onClick={onResetAll}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[#B3B3B3] transition hover:text-white"
      >
        <ArrowLeft size={16} /> Back to browse
      </button>
      <h1 className="text-2xl font-bold text-white md:text-3xl">{resultsLabel}</h1>
      <p className="mt-1 text-sm text-[#B3B3B3]">
        {loading ? "Loading…" : `${total} title${total === 1 ? "" : "s"}`}
      </p>

      <div className="relative mt-5 max-w-xl">
        <SearchIcon
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setBoxFocus(true)}
          onBlur={() => window.setTimeout(() => setBoxFocus(false), 150)}
          placeholder="Search titles…"
          className="w-full rounded-md border border-white/20 bg-black/60 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-slate-500 focus:border-[#06B6D4] focus:outline-none"
        />
        {searchInput && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => {
              e.preventDefault();
              onSearchChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
        {boxFocus && suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[46vh] overflow-y-auto rounded-lg border border-white/12 bg-[#181818] py-1.5 shadow-2xl">
            {suggestions.map(({ item }) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setBoxFocus(false);
                  onSuggestionPick(item.id);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/8"
              >
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-11 w-8 flex-none rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="h-11 w-8 flex-none rounded bg-white/10" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">
                    {item.display}
                  </span>
                  {item.year != null && (
                    <span className="block text-xs text-slate-400">{item.year}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {didYouMean && (
        <button
          type="button"
          onClick={onDidYouMean}
          className="mt-4 rounded-full border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-3.5 py-1.5 text-[13px] text-cyan-200 transition hover:bg-[#06B6D4]/20"
        >
          Did you mean: <span className="font-bold text-white">{didYouMean}</span>
        </button>
      )}

      {/* Browsable category pills on the search surface (implication
          #7 — the new Netflix TV search tab keeps categories inside
          Search). Pill geometry, filled-white selected state (#2). */}
      {onGenrePick && (
        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-12 md:px-12">
          <button
            type="button"
            onClick={() => onGenrePick(null)}
            className={`flex-none rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
              !activeGenre
                ? "bg-white text-black"
                : "border border-white/30 text-white/85 hover:border-white"
            }`}
          >
            All
          </button>
          {SEARCH_GENRES.map((g) => {
            const selected = (activeGenre || "") === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onGenrePick(selected ? null : g)}
                className={`flex-none rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  selected
                    ? "bg-white text-black"
                    : "border border-white/30 text-white/85 hover:border-white"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-md bg-[#181818]" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {movies.map((m) => (
            <StreamCard key={`res-${m.id}`} movie={m} widthClass="w-full" />
          ))}
        </div>
      ) : fuzzy.length > 0 ? (
        <div className="mt-8">
          <p className="text-sm text-[#B3B3B3]">
            No exact matches for "{searchQuery}" — closest titles:
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {fuzzy.map(({ item }) => (
              <StreamCard
                key={`fz-${item.id}`}
                movie={
                  {
                    id: item.id,
                    title: item.display,
                    thumbnail: item.thumbnail,
                    year: item.year,
                  } as unknown as Movie
                }
                widthClass="w-full"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg font-semibold text-white">No titles matched</p>
          <p className="mt-1 text-sm text-[#B3B3B3]">Try a different title or clear the filters.</p>
          <button
            type="button"
            onClick={onResetAll}
            className="mt-5 rounded-full bg-white px-6 py-2 text-sm font-bold text-black transition hover:bg-white/80"
          >
            Reset search
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public entry — used by the index route in Stream Mode.             */
/* ------------------------------------------------------------------ */
export type StreamResultsProps = {
  resultsParams?: { filter?: string; search?: string; genres?: string; years?: string };
  searchQuery: string;
  didYouMean: string | null;
  onDidYouMean: () => void;
  fuzzy: FuzzyHit[];
  searchInput: string;
  onSearchChange: (v: string) => void;
  suggestions: FuzzyHit[];
  onSuggestionPick: (id: string) => void;
  resultsLabel: string;
  onResetAll: () => void;
  onGenrePick?: (genre: string | null) => void;
  activeGenre?: string;
};

export type StreamExperienceProps = StreamResultsProps & {
  view: "home" | "results";
  cwEntries: CWEntry[];
  onRemoveCw: (e: CWEntry) => void;
  onOpenTitle: (id: string) => void;
};

export function StreamExperience(props: StreamExperienceProps) {
  return (
    <OpenTitleContext.Provider value={props.onOpenTitle}>
      {props.view === "results" ? (
        <StreamResults {...props} />
      ) : (
        <StreamHome cwEntries={props.cwEntries} onRemoveCw={props.onRemoveCw} />
      )}
    </OpenTitleContext.Provider>
  );
}
