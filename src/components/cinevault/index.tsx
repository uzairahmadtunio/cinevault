import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search, Send, Menu, X, ChevronDown, ChevronLeft, ChevronRight,
  Download, Info, Home, Flame, Film, MoreHorizontal, Play, Star,
} from "lucide-react";
import { publicClient, qualityColor, FALLBACK_MOVIES, FEATURED_FALLBACK, cleanTitle, type Movie, type EpisodeLink } from "@/lib/supabase";
import { fetchFeaturedOrLatest } from "@/lib/api/server.movies";
import { STREAM_MODE_FREE, useSiteMode } from "@/lib/siteMode";
import { pickCardStream, validRating } from "@/lib/mediaHelpers";
import { buildStreamUrl } from "@/utils/linkBypasser";
import { fuzzyFind, getSearchIndex, type SearchIndexItem } from "@/lib/searchIndex";

/* ---------------- Toast ---------------- */
type ToastMsg = { id: number; text: string };
const toastListeners: Array<(t: ToastMsg) => void> = [];
export function showToast(text: string) {
  const t = { id: Date.now() + Math.random(), text };
  toastListeners.forEach((l) => l(t));
}
export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const fn = (t: ToastMsg) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 3000);
    };
    toastListeners.push(fn);
    return () => { toastListeners.splice(toastListeners.indexOf(fn), 1); };
  }, []);
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="bg-[#0D1321] border-l-4 border-[#06B6D4] px-4 py-3 rounded shadow-lg text-sm text-[#F1F5F9] min-w-[240px] animate-fade-up">
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Quality badge ---------------- */
export function QualityBadge({ quality, className = "" }: { quality?: string | null; className?: string }) {
  if (!quality) return null;
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-bold rounded text-white uppercase tracking-wide ${className}`}
      style={{ background: qualityColor(quality) }}
    >
      {quality}
    </span>
  );
}

/* ---------------- Movie Card ---------------- */
export function MovieCard({ movie, className = "", aspect = "2/3" }: { movie: Partial<Movie>; className?: string; aspect?: "2/3" | "16/9" }) {
  const navigate = useNavigate();
  const { mode } = useSiteMode();
  const thumb = movie.thumbnail && movie.thumbnail.trim() !== "" && movie.thumbnail !== "N/A" && movie.thumbnail !== "null"
    ? movie.thumbnail
    : null;

  const aspectStyle = aspect === "16/9" ? { aspectRatio: "16 / 9" } : { aspectRatio: "2 / 3" };
  const rating = validRating(movie.imdb_rating);
  // In Stream Mode a card click plays the title directly (best valid quality,
  // falling back to the first playable episode for series); in Download Mode —
  // or when no playable link exists — it opens the detail page.
  const cardStream = mode === "stream" ? pickCardStream(movie) : null;

  const goDetail = () => navigate({ to: "/movie/$id", params: { id: String(movie.id) } });
  const handleClick = () => {
    if (mode === "stream" && cardStream) {
      window.location.assign(
        buildStreamUrl(cardStream.url, {
          id: movie.id,
          title: cleanTitle(movie.title),
          poster: thumb,
          ep: cardStream.ep,
        }),
      );
    } else {
      goDetail();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group block w-full max-w-[200px] rounded-lg overflow-hidden bg-[#0D1321] border border-[rgba(14,165,233,0.2)] transition-all duration-200 hover:scale-[1.04] hover:glow-cyan cursor-pointer ${className}`}
    >
      <div className="relative w-full overflow-hidden bg-[#111827] flex items-center justify-center" style={aspectStyle}>
        {thumb ? (
          <img
            src={thumb}
            alt={movie.title ?? "Poster"}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = titlePosterDataUrl(movie.title ?? "");
            }}
          />
        ) : (
          <img
            src={titlePosterDataUrl(movie.title ?? "")}
            alt={movie.title ?? "Poster"}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-2 left-2"><QualityBadge quality={movie.quality} /></div>
        {rating != null && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400">
            <Star size={10} fill="currentColor" /> {rating.toFixed(1)}
          </div>
        )}
        {mode === "stream" && cardStream && (
          <>
            {/* Play overlay (hover, desktop) */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="w-12 h-12 rounded-full bg-[#06B6D4]/90 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center text-white">
                <Play size={20} fill="currentColor" className="ml-0.5" />
              </span>
            </div>
            {/* Always-visible play badge — touch devices have no hover, so the
                Stream Mode affordance must not depend on it. */}
            <span className="absolute bottom-2 left-2 z-10 w-8 h-8 rounded-full bg-[#06B6D4] shadow-[0_0_14px_rgba(6,182,212,0.55)] flex items-center justify-center text-white pointer-events-none">
              <Play size={14} fill="currentColor" className="ml-0.5" />
            </span>
            {/* Info affordance: still reach the detail page in Stream Mode */}
            <button
              type="button"
              aria-label="View details"
              title="View details"
              onClick={(e) => {
                e.stopPropagation();
                goDetail();
              }}
              className="absolute bottom-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 border border-white/25 text-white flex items-center justify-center hover:bg-black/90 transition"
            >
              <Info size={14} />
            </button>
          </>
        )}
      </div>
      <div className="p-2">
        <h3 className="text-sm font-bold text-[#F1F5F9] line-clamp-2 leading-tight min-h-[2.5em]">{cleanTitle(movie.title)}</h3>
        <p className="text-[11px] text-[#64748B] mt-1 truncate">
          {[movie.year, movie.language, movie.format].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export function MovieCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-[200px] rounded-lg overflow-hidden bg-[#0D1321] border border-[rgba(14,165,233,0.2)] ${className}`}>
      <div className="aspect-[2/3] w-full bg-[#111827] animate-pulse" />
      <div className="p-2 space-y-2">
        <div className="h-3 bg-[#111827] rounded animate-pulse" />
        <div className="h-2 bg-[#111827] rounded w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

/* ---------------- Download / Stream mode toggle ---------------- */
export function ModeToggle() {
  const { mode, setMode } = useSiteMode();
  const base = "px-2 sm:px-2.5 py-1 rounded-full transition whitespace-nowrap";
  return (
    <div
      className="flex items-center rounded-full border border-[rgba(14,165,233,0.35)] bg-[#0D1321] p-0.5 text-[10px] sm:text-[11px] font-bold"
      role="group"
      aria-label="Site mode: switch between Download and Stream"
      suppressHydrationWarning
    >
      <button
        type="button"
        onClick={() => setMode("download")}
        className={`${base} ${mode === "download" ? "bg-[#06B6D4] text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]" : "text-[#94A3B8] hover:text-white"}`}
        aria-pressed={mode === "download"}
      >
        Download
      </button>
      <button
        type="button"
        onClick={() => STREAM_MODE_FREE && setMode("stream")}
        disabled={!STREAM_MODE_FREE}
        title={STREAM_MODE_FREE ? "Stream Mode — watch instantly, Netflix-style" : "Stream Mode — coming soon"}
        className={`${base} ${mode === "stream" ? "bg-[#06B6D4] text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]" : "text-[#94A3B8] hover:text-white"} ${!STREAM_MODE_FREE ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-pressed={mode === "stream"}
      >
        ▶ Stream{!STREAM_MODE_FREE ? " · Soon" : ""}
      </button>
    </div>
  );
}

/* ---------------- Navbar ---------------- */
const NAV_OTT = ["Netflix", "Amazon", "Jio HotStar", "Disney", "Apple TV", "HBO Max"];
const NAV_MOVIES = ["Hollywood", "Bollywood", "South Indian", "Hindi", "English", "Dual Audio", "Korean", "Punjabi", "Bengali"];
const NAV_GENRE = ["Action", "Romance", "Horror", "Comedy", "Drama", "Thriller", "Crime", "Sci-Fi", "Animation", "Documentary"];

export function Navbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [drawer, setDrawer] = useState(false);
  return (
    <>
      <header
        className="sticky top-0 z-40 h-14 flex items-center px-4 md:px-6 border-b"
        style={{ background: "rgba(8,12,20,0.97)", backdropFilter: "blur(12px)", borderColor: "rgba(14,165,233,0.15)" }}
      >
        <button className="md:hidden mr-3 text-[#F1F5F9]" onClick={() => setDrawer(true)} aria-label="menu"><Menu size={22} /></button>
        <Link to="/" search={{ view: "catalog" }} className="flex items-center gap-2 font-extrabold text-lg">
          <Play size={18} className="text-[#06B6D4]" fill="currentColor" />
          <span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-8 text-sm">
          <NavDrop label="OTT" items={NAV_OTT} />
          <NavDrop label="Movies" items={NAV_MOVIES} />
          <NavLink to="/" search={{ view: "catalog", type: "series", page: 1 }}>Web-Series</NavLink>
          <NavDrop label="Genre" items={NAV_GENRE} />
          <NavLink to="/" search={{ view: "catalog", category: "anime", page: 1 }}>Anime</NavLink>
          <NavLink to="/" search={{ view: "catalog", category: "4k", page: 1 }}>4K</NavLink>
          <NavLink to="/" search={{ view: "catalog", category: "kdrama", page: 1 }}>K-Drama</NavLink>
          {/* Age-restricted Adult++ category */}
          <NavAdultLink to="/" search={{ view: "catalog", category: "adult", page: 1 }}>
            <span className="flex items-center gap-1">
              <span className="text-[11px]">🔞</span>
              <span>Adult++</span>
            </span>
          </NavAdultLink>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ModeToggle />
          <button onClick={onOpenSearch} className="text-[#F1F5F9] hover:text-[#06B6D4]" aria-label="search"><Search size={20} /></button>
          <a href="https://t.me/cinevaultmoviesdownload" target="_blank" rel="noreferrer" className="text-[#F1F5F9] hover:text-[#06B6D4]" aria-label="telegram"><Send size={20} /></a>
        </div>
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0D1321] border-r border-[rgba(14,165,233,0.2)] p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold"><span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span></span>
              <button onClick={() => setDrawer(false)}><X size={20} /></button>
            </div>
            <DrawerGroup title="OTT" items={NAV_OTT} category="ott" />
            <DrawerGroup title="Movies" items={NAV_MOVIES} category="movies" />
            <DrawerGroup title="Genre" items={NAV_GENRE} category="genre" />
            <div className="mt-4 space-y-2 text-sm">
              <Link to="/" search={{ view: "catalog", type: "series", page: 1 }} className="block text-[#F1F5F9] hover:text-[#06B6D4]">Web-Series</Link>
              <Link to="/" search={{ view: "catalog", category: "anime", page: 1 }} className="block text-[#F1F5F9] hover:text-[#06B6D4]">Anime</Link>
              <Link to="/" search={{ view: "catalog", category: "4k", page: 1 }} className="block text-[#F1F5F9] hover:text-[#06B6D4]">4K</Link>
              <Link to="/" search={{ view: "catalog", category: "kdrama", page: 1 }} className="block text-[#F1F5F9] hover:text-[#06B6D4]">K-Drama</Link>
              {/* Age-restricted Adult++ category - mobile drawer */}
              <Link
                to="/"
                search={{ view: "catalog", category: "adult", page: 1 } as any}
                className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold"
              >
                <span>🔞</span>
                <span>Adult++</span>
                <span className="text-[9px] bg-rose-900/40 border border-rose-500/40 text-rose-400 px-1.5 py-0.5 rounded-full font-bold tracking-wide">18+</span>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
function NavLink({ children, to = "/", search }: { children: React.ReactNode; to?: string; search?: any }) {
  return (
    <Link to={to} search={search} className="px-3 py-2 text-[#F1F5F9] hover:text-[#06B6D4] cursor-pointer" activeProps={{ className: "text-[#06B6D4]" }}>
      {children}
    </Link>
  );
}

// Special styled nav link for the Adult++ category with red/rose hover tint
function NavAdultLink({ children, to = "/", search }: { children: React.ReactNode; to?: string; search?: any }) {
  return (
    <Link
      to={to}
      search={search}
      className="group relative px-3 py-2 text-rose-400 hover:text-rose-300 cursor-pointer transition-colors duration-200 flex items-center"
      title="18+ Age-Restricted Content"
    >
      {children}
      {/* Subtle red glow line underneath on hover */}
      <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-rose-500 opacity-0 group-hover:opacity-60 transition-opacity duration-200 rounded-full" />
    </Link>
  );
}
function NavDrop({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="relative group">
      <button className="px-3 py-2 flex items-center gap-1 text-[#F1F5F9] hover:text-[#06B6D4]">{label} <ChevronDown size={14} /></button>
      <div className="absolute left-0 top-full pt-2 hidden group-hover:block min-w-[180px]">
        <div className="bg-[#111827] border border-[rgba(14,165,233,0.2)] rounded-lg shadow-xl py-2">
          {items.map((it) => {
            if (label === "Movies") {
              const categoryMap: Record<string, string> = {
                "Hollywood": "hollywood",
                "Bollywood": "bollywood",
                "South Indian": "south",
                "Korean": "kdrama",
                "Hindi": "hindi",
                "English": "english",
                "Dual Audio": "dual audio",
                "Punjabi": "punjabi",
                "Bengali": "bengali",
              };
              const cat = categoryMap[it];
              return (
                <Link
                  key={it}
                  to="/"
                  search={{ view: "catalog", category: cat, page: 1 }}
                  className="block px-4 py-1.5 text-sm text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.15)] hover:text-[#06B6D4]"
                >
                  {it}
                </Link>
              );
            }
            if (label === "Genre") {
              return (
                <Link
                  key={it}
                  to="/"
                  search={{ view: "catalog", genres: it, page: 1 }}
                  className="block px-4 py-1.5 text-sm text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.15)] hover:text-[#06B6D4]"
                >
                  {it}
                </Link>
              );
            }
            return (
              <Link
                key={it}
                to="/"
                search={{ view: "catalog", platform: it.toLowerCase(), page: 1 }}
                className="block px-4 py-1.5 text-sm text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.15)] hover:text-[#06B6D4]"
              >
                {it}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function DrawerGroup({ title, items, category = "" }: { title: string; items: string[]; category?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-semibold text-[#06B6D4]">
        {title} <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {open && (
        <div className="mt-2 pl-3 space-y-1.5">
          {items.map((i) => {
            if (category === "movies") {
              const categoryMap: Record<string, string> = {
                "Hollywood": "hollywood",
                "Bollywood": "bollywood",
                "South Indian": "south",
                "Korean": "kdrama",
                "Hindi": "hindi",
                "English": "english",
                "Dual Audio": "dual audio",
                "Punjabi": "punjabi",
                "Bengali": "bengali",
              };
              const cat = categoryMap[i];
              return (
                <Link
                  key={i}
                  to="/"
                  search={{ view: "catalog", category: cat, page: 1 }}
                  className="block text-xs text-[#F1F5F9] hover:text-[#06B6D4]"
                >
                  {i}
                </Link>
              );
            }
            if (category === "genre") {
              return (
                <Link
                  key={i}
                  to="/"
                  search={{ view: "catalog", genres: i, page: 1 }}
                  className="block text-xs text-[#F1F5F9] hover:text-[#06B6D4]"
                >
                  {i}
                </Link>
              );
            }
            return (
              <Link
                key={i}
                to="/"
                search={{ view: "catalog", platform: i.toLowerCase(), page: 1 }}
                className="block text-xs text-[#F1F5F9] hover:text-[#06B6D4]"
              >
                {i}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Mobile Bottom Nav ---------------- */
export function MobileBottomNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0D1321] border-t border-[rgba(14,165,233,0.4)] flex justify-around py-2">
      <BItem icon={<Home size={18} />} label="Home" to="/" />
      <BItem icon={<Flame size={18} />} label="Trending" to="/" />
      <button onClick={onOpenSearch} className="flex flex-col items-center text-[#F1F5F9] hover:text-[#06B6D4] text-[10px]">
        <Search size={18} /><span>Search</span>
      </button>
      <BItem icon={<Film size={18} />} label="Movies" to="/" />
      <BItem icon={<MoreHorizontal size={18} />} label="More" to="/" />
    </nav>
  );
}
function BItem({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="flex flex-col items-center text-[#F1F5F9] hover:text-[#06B6D4] text-[10px] [&.active]:text-[#06B6D4]" activeProps={{ className: "active" }}>
      {icon}<span>{label}</span>
    </Link>
  );
}

/* ---------------- Notice Banner ---------------- */
export function NoticeBanner() {
  const msg = "⚠️ CineVault Official Site — Bookmark cinevault.to | Use VPN for access | Join Telegram for latest updates";
  return (
    <div className="overflow-hidden text-white text-sm py-2" style={{ background: "linear-gradient(to right, #0EA5E9, #0891B2)" }}>
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="px-8">{msg}</span><span className="px-8">{msg}</span><span className="px-8">{msg}</span><span className="px-8">{msg}</span>
      </div>
    </div>
  );
}

/* ---------------- Notice Popup ---------------- */
export function NoticePopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const hide = localStorage.getItem("cv_notice_hide");
    if (hide && Date.now() - Number(hide) < 24 * 3600 * 1000) return;
    setOpen(true);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-[#06B6D4] bg-[#111827] overflow-hidden animate-fade-up">
        <div className="bg-[#06B6D4] text-white font-bold px-4 py-3 text-center tracking-wider">CINEVAULT OFFICIAL NOTICE</div>
        <div className="p-5 text-[#F1F5F9] text-sm space-y-2">
          <p>Official domain → <span className="text-[#06B6D4] font-semibold">cinevault.to</span></p>
          <p>Use with VPN for best experience.</p>
        </div>
        <div className="flex gap-2 p-4 border-t border-[rgba(14,165,233,0.2)]">
          <button onClick={() => setOpen(false)} className="flex-1 px-3 py-2 rounded bg-[#1f2937] text-[#F1F5F9] text-sm">Dismiss</button>
          <button
            onClick={() => { localStorage.setItem("cv_notice_hide", String(Date.now())); setOpen(false); }}
            className="flex-1 px-3 py-2 rounded bg-[#06B6D4] text-white text-sm font-semibold"
          >Hide 24h</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Search Overlay ---------------- */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Partial<Movie>[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState<SearchIndexItem[]>([]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Load the (cached) title index once when the overlay opens — matching then
  // happens entirely on-device, so typing never waits on the network.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getSearchIndex().then((items) => {
      if (!cancelled) setIndex(items);
    });
    return () => {
      cancelled = true;
    };
  }, [open ]);
  useEffect(() => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      const hits = fuzzyFind(index, q, 24);
      setResults(
        hits.map((h) => ({
          id: h.item.id,
          title: h.item.title,
          thumbnail: h.item.thumbnail,
          year: h.item.year,
        })),
      );
      setLoading(false);
    }, 120);
    return () => clearTimeout(t);
  }, [q, index]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto" style={{ background: "rgba(8,12,20,0.97)" }}>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Search className="text-[#06B6D4]" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies, series, anime…"
            className="flex-1 bg-transparent border-b-2 border-[rgba(14,165,233,0.3)] focus:border-[#06B6D4] outline-none text-xl py-3 text-[#F1F5F9]"
          />
          <button onClick={onClose} className="text-[#F1F5F9]"><X size={24} /></button>
        </div>
        {loading && <p className="text-[#64748B]">Searching…</p>}
        {!loading && q && results.length === 0 && (
          <div className="text-center py-20 text-[#64748B]">
            <Search size={48} className="mx-auto mb-3 opacity-40" />
            <p>No results for "{q}"</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {results.map((m) => <div key={m.id} onClick={onClose}><MovieCard movie={m} /></div>)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hero Slider ---------------- */
export function HeroSlider() {
  const { mode } = useSiteMode();
  const [slides, setSlides] = useState<Partial<Movie>[]>(FEATURED_FALLBACK);
  const [i, setI] = useState(0);
  useEffect(() => {
    (async () => {
      const res = await fetchFeaturedOrLatest({ data: { limit: 8 } });
      if (res?.movies && res.movies.length) setSlides(res.movies as Movie[]);
    })();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i] || {};
  const bg = s.banner || `https://picsum.photos/seed/heroX${i}/1200/500`;
  return (
    <section className="relative w-full overflow-hidden" style={{ height: "min(480px, 56vw)", minHeight: 260 }}>
      {slides.map((sl, idx) => (
        <div key={idx} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: idx === i ? 1 : 0 }}>
          <img src={sl.banner || bg} alt={sl.title || ""} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #080C14 0%, transparent 60%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(14,165,233,0.4) 0%, transparent 50%)" }} />
        </div>
      ))}
      <div className="relative z-10 max-w-6xl mx-auto h-full flex flex-col justify-end p-6 md:p-12">
        <QualityBadge quality={s.quality} className="self-start mb-3" />
        <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg">{cleanTitle(s.title)}</h1>
        <p className="text-[#cbd5e1] mt-2 text-sm md:text-base">
          {[s.language, s.year, s.format].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[#94a3b8] mt-2 max-w-2xl line-clamp-2 hidden md:block">{s.description}</p>
        <div className="flex gap-3 mt-4">
          <Link to="/movie/$id" params={{ id: String(s.id || 1) }} className="inline-flex items-center gap-2 bg-[#06B6D4] hover:bg-[#0891B2] text-white px-5 py-2.5 rounded font-semibold text-sm">
            {mode === "stream" ? (
              <><Play size={16} fill="currentColor" /> Watch Now</>
            ) : (
              <><Download size={16} /> Download Now</>
            )}
          </Link>
          <Link to="/movie/$id" params={{ id: String(s.id || 1) }} className="inline-flex items-center gap-2 border border-[#06B6D4] text-[#06B6D4] hover:bg-[rgba(6,182,212,0.1)] px-5 py-2.5 rounded font-semibold text-sm">
            <Info size={16} /> More Info
          </Link>
        </div>
      </div>
      <button onClick={() => setI((p) => (p - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full"><ChevronLeft /></button>
      <button onClick={() => setI((p) => (p + 1) % slides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full"><ChevronRight /></button>
      <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center gap-1.5">
        {slides.map((_, idx) => (
          <button key={idx} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-[#06B6D4]" : "w-1.5 bg-white/40"}`} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- Trending Section ---------------- */
export function TrendingSection({ movies, loading }: { movies: Movie[]; loading: boolean }) {
  return (
    <section className="px-4 md:px-8 py-6">
      <h2 className="text-xl md:text-2xl font-bold mb-4 text-[#F1F5F9]">🔥 Trending This Week</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <MovieCardSkeleton key={i} className="w-[140px] sm:w-[200px] shrink-0" />)
          : movies.map((m, idx) => (
              <div key={m.id} className="relative shrink-0 pl-10">
                <span className="absolute left-0 bottom-0 text-[80px] leading-none font-black text-[#06B6D4]/20 select-none pointer-events-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <MovieCard movie={m} className="w-[140px] sm:w-[200px] shrink-0" />
              </div>
            ))}
      </div>
    </section>
  );
}

/* ---------------- Filter Tabs ---------------- */
export const FILTERS = ["All", "New Releases", "4K", "Netflix", "Amazon", "Anime", "Bollywood", "Hollywood", "Series"];
export function FilterTabs({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 md:px-8 flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
            active === f ? "bg-[#0EA5E9] text-white" : "text-[#64748B] hover:text-[#F1F5F9]"
          }`}
        >{f}</button>
      ))}
    </div>
  );
}

/* ---------------- Movie Grid ---------------- */
export function MovieGrid({ movies, loading }: { movies: Movie[] | Partial<Movie>[]; loading: boolean }) {
  return (
    <div className="px-2 sm:px-4 md:px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 justify-items-center">
      {loading
        ? Array.from({ length: 10 }).map((_, i) => <MovieCardSkeleton key={i} className="w-full" />)
        : movies.map((m) => <MovieCard key={m.id} movie={m} className="w-full" />)}
    </div>
  );
}

/* ---------------- Footer ---------------- */
export function Footer() {
  return (
    <footer className="mt-12 bg-[#080C14] border-t border-[rgba(14,165,233,0.15)] px-6 md:px-10 pt-10 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-extrabold text-lg flex items-center gap-2 mb-2">
            <Play size={18} className="text-[#06B6D4]" fill="currentColor" />
            <span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span>
          </div>
          <div className="flex gap-2 mb-3">
            <Link to="/4k-movies" className="text-[#06B6D4] hover:text-[#0891B2] font-semibold text-xs">4K</Link>
            <span className="text-[#64748B]">·</span>
            <Link to="/movies?filter=FHD" className="text-[#06B6D4] hover:text-[#0891B2] font-semibold text-xs">HD</Link>
            <span className="text-[#64748B]">·</span>
            <Link to="/movies" className="text-[#06B6D4] hover:text-[#0891B2] font-semibold text-xs">WEB-DL</Link>
            <span className="text-[#64748B]">·</span>
            <Link to="/movies/anime" className="text-[#06B6D4] hover:text-[#0891B2] font-semibold text-xs">Anime</Link>
          </div>
          <a href="https://t.me/cinevaultmoviesdownload" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#06B6D4] text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-[#0891B2]">
            <Send size={14} /> Join Telegram
          </a>
        </div>
        <div>
          <h4 className="text-[#F1F5F9] font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-1.5 text-[#64748B]">
            <li><Link to="/" className="hover:text-[#06B6D4]">Home</Link></li>
            <li><Link to="/movies" className="hover:text-[#06B6D4]">Movies</Link></li>
            <li><Link to="/series" className="hover:text-[#06B6D4]">Web Series</Link></li>
            <li><Link to="/movies/anime" className="hover:text-[#06B6D4]">Anime</Link></li>
            <li><Link to="/4k-movies" className="hover:text-[#06B6D4]">4K</Link></li>
            <li><Link to="/?filter=kdrama" className="hover:text-[#06B6D4]">K-Drama</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[#F1F5F9] font-semibold mb-3">Categories</h4>
          <ul className="space-y-1.5 text-[#64748B]">
            <li><Link to="/movies/hollywood" className="hover:text-[#06B6D4]">Hollywood</Link></li>
            <li><Link to="/movies/bollywood" className="hover:text-[#06B6D4]">Bollywood</Link></li>
            <li><Link to="/movies/south-indian" className="hover:text-[#06B6D4]">South Indian</Link></li>
            <li><Link to="/movies?filter=Netflix" className="hover:text-[#06B6D4]">Netflix</Link></li>
            <li><Link to="/movies?filter=Amazon" className="hover:text-[#06B6D4]">Amazon</Link></li>
            <li><Link to="/movies" className="hover:text-[#06B6D4]">All Movies</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-4 border-t border-[rgba(14,165,233,0.15)]">
        <div className="flex flex-wrap justify-center gap-4 mb-4 text-xs">
          <Link to="/about-us" className="text-[#64748B] hover:text-[#06B6D4] transition">About Us</Link>
          <span className="text-[#64748B]">·</span>
          <Link to="/privacy-policy" className="text-[#64748B] hover:text-[#06B6D4] transition">Privacy Policy</Link>
          <span className="text-[#64748B]">·</span>
          <Link to="/contact-us" className="text-[#64748B] hover:text-[#06B6D4] transition">Contact Us</Link>
        </div>
        <div className="text-xs text-[#64748B] text-center space-y-2">
          <div>
            © 2026 CineVault | Disclaimer: CineVault does not host any files. Content provided by third-party links.
          </div>
          <div className="text-sm pt-2">
            Developed by <span className="text-[#06B6D4] font-bold tracking-wide hover:text-[#22d3ee] transition duration-300" style={{ textShadow: "0 0 10px rgba(6, 182, 212, 0.6)" }}>Uzair Ahmad</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Site Shell ---------------- */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState(false);
  return (
    <div className="min-h-screen bg-[#080C14] text-[#F1F5F9]">
      <Navbar onOpenSearch={() => setSearch(true)} />
      {children}
      <Footer />
      <MobileBottomNav onOpenSearch={() => setSearch(true)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      <NoticePopup />
      <ToastHost />
    </div>
  );
}

export { FALLBACK_MOVIES, cleanTitle };
export type { Movie, EpisodeLink };

// Generate a simple SVG poster as a data URL using the movie title.
export function titlePosterDataUrl(title?: string) {
  const text = cleanTitle(title || "") || "CineVault";
  const safe = String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<?xml version='1.0' encoding='UTF-8'?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1800' viewBox='0 0 1200 1800'><rect width='100%' height='100%' fill='%230D1321' /><text x='50%' y='50%' font-family='Inter, Arial, sans-serif' font-size='64' fill='%2306B6D4' font-weight='700' dominant-baseline='middle' text-anchor='middle'>${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
