import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Star, Download, Play, MoreVertical } from "lucide-react";
import { SiteShell, MovieCard, cleanTitle, titlePosterDataUrl, type Movie } from "@/components/cinevault";
import { fetchMovieById, fetchMovies } from "@/lib/api/server.movies";
import { buildStreamUrl } from "@/utils/linkBypasser";
import {
  cleanFileSize, episodeDisplayTitle, episodeNumber, episodeQualityLinks,
  parseEpisodes, pickBestQualityLink, pickCardStream, validQualities, validRating,
} from "@/lib/mediaHelpers";
import { useSiteMode } from "@/lib/siteMode";
import { MyListButton } from "@/components/stream/MyListButton";

export const Route = createFileRoute("/movie/$id")({
  component: MovieDetail,
});

function qualityBtnColor(label: string): string {
  switch (label) {
    case "720p": return "#2563EB";
    case "1080p": return "#059669";
    case "4K": return "#0EA5E9";
    default: return "#374151";
  }
}

function MovieDetail() {
  const { id } = Route.useParams();
  const { mode } = useSiteMode();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [related, setRelated] = useState<Movie[]>([]);
  const relatedRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dlMenuOpen, setDlMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const idParam = String(id);
      try {
        console.debug("MovieDetail: calling fetchMovieById", idParam);
        const res = await fetchMovieById({ data: { id: idParam } });
        console.debug("MovieDetail: fetchMovieById resolved", res);
        const movieData = res?.movie as Movie | null;
        setMovie(movieData);
        if (movieData?.category) {
          const relRes = await fetchMovies({ data: { mode: "all", limit: 10 } });
          const rel = (relRes?.movies as Movie[] || []).filter((r) => r.category === movieData.category && r.id !== movieData.id).slice(0, 10);
          setRelated(rel);
        }
      } catch (err: any) {
        console.error("movie detail fetch error", err);
        setFetchError(err?.message ?? String(err));
        setMovie(null);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!relatedRef.current || related.length === 0) return;
    const container = relatedRef.current;
    let scrollPosition = 0;
    const step = container.offsetWidth * 0.8;
    const interval = window.setInterval(() => {
      if (!container || container.scrollWidth <= container.clientWidth) {
        return;
      }
      scrollPosition += step;
      if (scrollPosition >= container.scrollWidth - container.clientWidth + 20) {
        scrollPosition = 0;
      }
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }, 4500);

    return () => window.clearInterval(interval);
  }, [related]);

  if (loading) {
    return <SiteShell><div className="p-10 text-center text-[#64748B]">Loading…</div></SiteShell>;
  }
  if (!movie) {
    return (
      <SiteShell>
        <div className="p-10 text-center">
          {fetchError && <div className="mb-4 text-red-400">Error: {fetchError}</div>}
          <h1 className="text-2xl font-bold mb-2">Movie not found</h1>
          <Link to="/" search={{}} className="text-[#06B6D4]">← Back to home</Link>
        </div>
      </SiteShell>
    );
  }

  const posterSrc =
    movie.thumbnail && movie.thumbnail.trim() !== "" && movie.thumbnail !== "N/A" && movie.thumbnail !== "null"
      ? movie.thumbnail
      : null;

  // Every watch/download action goes straight to the in-site player (which
  // carries the real Download button) — no intermediate "Generate" page.
  const goToPlayer = (url: string, epNum?: number) => {
    window.location.assign(
      buildStreamUrl(url, {
        id: movie.id,
        title: cleanTitle(movie.title),
        poster: posterSrc,
        ep: epNum ?? null,
      }),
    );
  };

  // Gather screenshots from screenshot_1..10 + screenshots jsonb array
  const numbered = [
    movie.screenshot_1, movie.screenshot_2, movie.screenshot_3, movie.screenshot_4,
    movie.screenshot_5, movie.screenshot_6, movie.screenshot_7, movie.screenshot_8,
    movie.screenshot_9, movie.screenshot_10,
  ];
  let extra: string[] = [];
  if (movie.screenshots) {
    if (Array.isArray(movie.screenshots)) extra = movie.screenshots as string[];
    else {
      try {
        const parsed = JSON.parse(movie.screenshots as unknown as string);
        if (Array.isArray(parsed)) extra = parsed;
      } catch { /* ignore */ }
    }
  }
  const screenshots = [...numbered, ...extra].filter(
    (s): s is string => !!s && typeof s === "string" && s.trim() !== "",
  );

  const isSeries = (movie.type || "").toLowerCase() === "series";
  const episodes = parseEpisodes(movie);
  const qualities = validQualities(movie);
  const bestLink = pickBestQualityLink(movie);
  // For series, Watch Now targets the best top-level link, else Episode 1's
  // first playable link — computed from the same helper the cards use.
  const seriesStream = isSeries ? pickCardStream(movie) : null;
  const rating = validRating(movie.imdb_rating);

  const leftRows: Array<[string, React.ReactNode]> = [];
  leftRows.push(["🎬 Name", cleanTitle(movie.title)]);
  if (movie.year) leftRows.push(["📅 Year", movie.year]);
  if (movie.language) leftRows.push(["🌐 Language", movie.language]);
  if (movie.genre) {
    const genreList = movie.genre.split(",").map(g => g.trim()).filter(Boolean);
    const genreChips = (
      <div className="flex flex-wrap gap-1">
        {genreList.map((g) => (
          <span key={g} className="px-2 py-1 bg-[#06B6D4]/20 border border-[#06B6D4] rounded text-[#06B6D4] text-xs font-semibold">
            {g}
          </span>
        ))}
      </div>
    );
    leftRows.push(["🎭 Genre", genreChips]);
  }
  if (movie.duration) leftRows.push(["⏱️ Duration", movie.duration]);
  if (isSeries && movie.season_number) leftRows.push(["📺 Season", movie.season_number]);
  if (movie.quality) leftRows.push(["📀 Quality", movie.quality]);
  if (movie.format) leftRows.push(["🎬 Format", movie.format]);
  const cleanedSize = cleanFileSize(movie.file_size);
  if (cleanedSize) leftRows.push(["💾 File Size", cleanedSize]);

  const rightRows: Array<[string, React.ReactNode]> = [];
  if (rating != null) rightRows.push(["⭐ IMDb", <span className="text-yellow-400">{rating.toFixed(1)}/10</span>]);
  if (movie.director) {
    const directors = movie.director.split(",").map(d => d.trim()).filter(Boolean).join(", ");
    rightRows.push(["🎥 Director", <span className="text-[#06B6D4]">{directors}</span>]);
  }
  if (movie.cast_names) {
    const cast = movie.cast_names.split(",").map(c => c.trim()).filter(Boolean).join(", ");
    rightRows.push(["👥 Stars", <span className="text-[#06B6D4]">{cast}</span>]);
  }
  if (isSeries && movie.total_episodes) rightRows.push(["📊 Episodes", movie.total_episodes]);
  if (movie.platform) rightRows.push(["🏢 Platform", movie.platform]);

  return (
    <SiteShell>
      <div className="relative w-full" style={{ height: "min(420px, 50vw)", minHeight: 240 }}>
        <img src={movie.banner || movie.thumbnail || titlePosterDataUrl(movie.title)} alt={cleanTitle(movie.title)} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #080C14 0%, rgba(8,12,20,0.3) 60%, rgba(14,165,233,0.25) 100%)" }} />
      </div>
      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-16 relative z-10">
        <div className="flex items-end gap-4 sm:gap-5">
          {/* Poster thumbnail in the header — always visible (round 1 hid it
              below the sm breakpoint, so phones showed banner only). */}
          <img
            src={posterSrc || titlePosterDataUrl(movie.title)}
            alt={cleanTitle(movie.title)}
            className="block w-20 sm:w-28 md:w-36 aspect-[2/3] object-cover rounded-lg border border-[rgba(14,165,233,0.35)] shadow-[0_10px_30px_rgba(0,0,0,0.6)] shrink-0 bg-[#0D1321]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow">{cleanTitle(movie.title)}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              {movie.year && <Chip>{movie.year}</Chip>}
              {movie.language && <Chip>{movie.language}</Chip>}
              {movie.quality && <Chip>{movie.quality}</Chip>}
              {movie.format && <Chip>{movie.format}</Chip>}
              {isSeries && <Chip>📺 Series</Chip>}
              {rating != null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded font-semibold">
                  <Star size={12} fill="currentColor" /> {rating.toFixed(1)}
                </span>
              )}
              {movie.platform && (
                <span className="px-2 py-1 rounded text-white font-semibold" style={{ background: platformColor(movie.platform) }}>{movie.platform}</span>
              )}
            </div>
            <div className="mt-4">
              <MyListButton movie={movie} variant="full" />
            </div>
          </div>
        </div>

        {/* INFO CARD */}
        <div
          className="mt-6 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2"
          style={{ background: "#0D1321", borderLeft: "3px solid #06B6D4" }}
        >
          <div className="space-y-2">{leftRows.map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}</div>
          <div className="space-y-2">{rightRows.map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}</div>
        </div>

        {/* STORYLINE */}
        {movie.description && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#06B6D4]">◆ Storyline</h2>
            <div
              className="rounded-lg p-5 text-[#F1F5F9] leading-relaxed"
              style={{ background: "#0D1321", border: "1px solid rgba(14,165,233,0.2)" }}
            >
              {movie.description}
            </div>
          </>
        )}

        {isSeries ? (
          <>
            {seriesStream && (
              <>
                <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Watch</h2>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <button
                    onClick={() => goToPlayer(seriesStream.url, seriesStream.ep ?? undefined)}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-base shadow-[0_0_25px_rgba(6,182,212,0.35)] transition hover:scale-[1.02] cursor-pointer"
                  >
                    <Play size={20} fill="currentColor" /> Watch Now
                    {seriesStream.ep != null ? ` — Episode ${String(seriesStream.ep).padStart(2, "0")}` : ""}
                  </button>
                </div>
              </>
            )}
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">
              Episodes {movie.season_number ? `— Season ${movie.season_number}` : ""}
            </h2>
            <div className="space-y-3">
              {episodes.length === 0 && <p className="text-[#64748B] text-sm">No episodes added yet.</p>}
              {episodes.map((ep, i) => {
                const num = episodeNumber(ep, i);
                const dTitle = episodeDisplayTitle(ep);
                const links = episodeQualityLinks(ep);
                return (
                  <div
                    key={i}
                    className="rounded-lg p-4"
                    style={{ background: "#0D1321", borderLeft: "3px solid #06B6D4" }}
                  >
                    <div className="font-semibold text-[#F1F5F9] mb-3">
                      Episode {String(num).padStart(2, "0")}{dTitle ? ` — ${dTitle}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {links.length > 0 ? (
                        links.map((l) => (
                          <DBtn key={l.label} onClick={() => goToPlayer(l.url, num)} bg={qualityBtnColor(l.label)}>
                            {l.label}
                          </DBtn>
                        ))
                      ) : (
                        <span className="text-xs text-[#64748B]">Links coming soon</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : mode === "stream" ? (
          <>
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Watch</h2>
            <div className="flex flex-wrap items-center gap-3">
              {bestLink ? (
                <button
                  onClick={() => goToPlayer(bestLink.url)}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-base shadow-[0_0_25px_rgba(6,182,212,0.35)] transition hover:scale-[1.02] cursor-pointer"
                >
                  <Play size={20} fill="currentColor" /> Watch Now
                </button>
              ) : (
                <p className="text-sm text-[#64748B]">Streaming links for this title are being updated — please check back soon.</p>
              )}
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setDlMenuOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-lg border border-[rgba(14,165,233,0.35)] text-[#F1F5F9] font-semibold text-sm hover:bg-[rgba(14,165,233,0.1)] cursor-pointer"
                    aria-label="Download options"
                  >
                    <MoreVertical size={18} /> Download
                  </button>
                  {dlMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setDlMenuOpen(false)} />
                      <div className="absolute left-0 top-full mt-2 z-40 w-56 rounded-lg bg-[#111827] border border-[rgba(14,165,233,0.25)] shadow-2xl py-2">
                        {qualities.map((q) => (
                          <button
                            key={q.label}
                            onClick={() => {
                              setDlMenuOpen(false);
                              goToPlayer(q.url);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.12)] text-left cursor-pointer"
                          >
                            <Download size={14} className="text-[#06B6D4]" /> Download {q.label}
                          </button>
                        ))}
                        <p className="px-4 pt-2 text-[10px] text-[#64748B]">Opens the player page — the download button is there.</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Watch Now is offered in BOTH modes (round 1 showed it only in
                Stream Mode, so the default Download Mode had no way to play). */}
            {bestLink && (
              <>
                <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Watch</h2>
                <button
                  onClick={() => goToPlayer(bestLink.url)}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-base shadow-[0_0_25px_rgba(6,182,212,0.35)] transition hover:scale-[1.02] cursor-pointer"
                >
                  <Play size={20} fill="currentColor" /> Watch Now
                </button>
              </>
            )}
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Download Links</h2>
            {qualities.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {qualities.map((q) => (
                  <DBtn key={q.label} onClick={() => goToPlayer(q.url)} bg={qualityBtnColor(q.label)}>
                    {q.label}
                  </DBtn>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">Download links for this title are being updated — please check back soon.</p>
            )}
          </>
        )}

        {screenshots.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Screenshots</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {screenshots.map((src, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-[rgba(14,165,233,0.2)] bg-[#0D1321]">
                  <img
                    src={src}
                    loading="lazy"
                    alt={`Screenshot ${i + 1}`}
                    className="w-full aspect-[16/9] object-cover transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {related.length > 0 && (
          <>
            <h2 className="mt-10 mb-3 text-lg font-bold text-[#F1F5F9]">Related</h2>
            <div
              ref={relatedRef}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory scroll-smooth"
            >
              {related.map((m) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  aspect="16/9"
                  className="min-w-[260px] sm:min-w-[300px] snap-start"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 text-sm py-1.5 pl-3"
      style={{ borderLeft: "2px solid rgba(6,182,212,0.4)" }}
    >
      <span className="text-[#64748B] shrink-0 min-w-[90px]">{label}</span>
      <span className="text-white font-semibold text-right flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-1 bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded text-[#F1F5F9]">{children}</span>;
}
function DBtn({ children, onClick, bg }: { children: React.ReactNode; onClick: () => void; bg: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-white font-semibold text-sm hover:opacity-90" style={{ background: bg }}>
      <Download size={16} /> {children}
    </button>
  );
}
function platformColor(p: string) {
  const k = p.toLowerCase();
  if (k.includes("netflix")) return "#E50914";
  if (k.includes("amazon")) return "#00A8E1";
  if (k.includes("disney")) return "#113CCF";
  if (k.includes("apple")) return "#1f1f1f";
  if (k.includes("hbo")) return "#7B2CBF";
  if (k.includes("jio")) return "#7c3aed";
  return "#06B6D4";
}
