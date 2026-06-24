import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Star, Download } from "lucide-react";
import { SiteShell, MovieCard, showToast, cleanTitle, titlePosterDataUrl, type Movie, type EpisodeLink } from "@/components/cinevault";
import { fetchMovieById, fetchMovies } from "@/lib/api/server.movies";
import { getBypassedUrl } from "@/utils/linkBypasser";

export const Route = createFileRoute("/movie/$id")({
  component: MovieDetail,
});

const SIZE_EST: Record<string, string> = {
  "480p": "~400-700 MB",
  "720p": "~1-1.5 GB",
  "1080p": "~2-4 GB",
  "4K": "~6-15 GB",
};

function MovieDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [related, setRelated] = useState<Movie[]>([]);
  const relatedRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const tryLink = (url: string | null | undefined, label: string) => {
    if (url) {
      const bypassed = getBypassedUrl(url);
      window.open(bypassed, "_blank", "noopener");
    } else {
      showToast(`Join Telegram for ${label} links!`);
    }
  };

  const handleMovieDownload = (quality: string) => {
    if (movie) {
      navigate({
        to: "/download/$movieId/$quality",
        params: { movieId: String(movie.id), quality },
      });
    }
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
  const episodes: EpisodeLink[] = Array.isArray(movie.episode_links)
    ? movie.episode_links
    : (() => {
        try { return movie.episode_links ? JSON.parse(movie.episode_links as unknown as string) : []; }
        catch { return []; }
      })();

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
  if (!isSeries && movie.duration) leftRows.push(["⏱️ Duration", movie.duration]);
  if (isSeries && movie.season_number) leftRows.push(["📺 Season", movie.season_number]);
  if (movie.quality) leftRows.push(["📀 Quality", movie.quality]);
  if (movie.format) leftRows.push(["🎬 Format", movie.format]);
  if (movie.file_size) leftRows.push(["💾 File Size", movie.file_size]);

  const rightRows: Array<[string, React.ReactNode]> = [];
  if (movie.imdb_rating != null) rightRows.push(["⭐ IMDb", <span className="text-yellow-400">{Number(movie.imdb_rating).toFixed(1)}/10</span>]);
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
        <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow">{cleanTitle(movie.title)}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          {movie.year && <Chip>{movie.year}</Chip>}
          {movie.language && <Chip>{movie.language}</Chip>}
          {movie.quality && <Chip>{movie.quality}</Chip>}
          {movie.format && <Chip>{movie.format}</Chip>}
          {isSeries && <Chip>📺 Series</Chip>}
          {movie.imdb_rating != null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded font-semibold">
              <Star size={12} fill="currentColor" /> {Number(movie.imdb_rating).toFixed(1)}
            </span>
          )}
          {movie.platform && (
            <span className="px-2 py-1 rounded text-white font-semibold" style={{ background: platformColor(movie.platform) }}>{movie.platform}</span>
          )}
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
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">
              Episodes {movie.season_number ? `— Season ${movie.season_number}` : ""}
            </h2>
            <div className="space-y-3">
              {episodes.length === 0 && <p className="text-[#64748B] text-sm">No episodes added yet.</p>}
              {episodes.map((ep) => (
                <div
                  key={ep.episode}
                  className="rounded-lg p-4"
                  style={{ background: "#0D1321", borderLeft: "3px solid #06B6D4" }}
                >
                  <div className="font-semibold text-[#F1F5F9] mb-3">
                    Episode {String(ep.episode).padStart(2, "0")}{ep.title ? ` — ${ep.title}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DBtn onClick={() => tryLink(ep.link_480p, `Ep${ep.episode} 480p`)} bg="#374151">480p</DBtn>
                    <DBtn onClick={() => tryLink(ep.link_720p, `Ep${ep.episode} 720p`)} bg="#2563EB">720p</DBtn>
                    <DBtn onClick={() => tryLink(ep.link_1080p, `Ep${ep.episode} 1080p`)} bg="#059669">1080p</DBtn>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-8 mb-3 text-lg font-bold text-[#F1F5F9]">Download Links</h2>
            <div className="flex flex-wrap gap-4">
              <DownloadBlock label="480p" bg="#374151" size={movie.file_size || SIZE_EST["480p"]} onClick={() => handleMovieDownload("480p")} />
              <DownloadBlock label="720p" bg="#2563EB" size={movie.file_size || SIZE_EST["720p"]} onClick={() => handleMovieDownload("720p")} />
              <DownloadBlock label="1080p" bg="#059669" size={movie.file_size || SIZE_EST["1080p"]} onClick={() => handleMovieDownload("1080p")} />
              <DownloadBlock label="4K" bg="#0EA5E9" size={movie.file_size || SIZE_EST["4K"]} onClick={() => handleMovieDownload("4K")} />
            </div>
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
function DownloadBlock({ label, onClick, bg, size }: { label: string; onClick: () => void; bg: string; size: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <DBtn onClick={onClick} bg={bg}>{label}</DBtn>
      <span className="text-[11px] text-[#64748B] pl-1">{size}</span>
    </div>
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
