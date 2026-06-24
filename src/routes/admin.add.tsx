import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Search as SearchIcon } from "lucide-react";
import { AdminShell } from "@/components/cinevault/AdminShell";
import { cleanTitle, type EpisodeLink } from "@/lib/supabase";
import { showToast } from "@/components/cinevault";
import { getAdminAccessToken } from "@/lib/auth";
import { addMovie } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/add")({ component: AddMovie });

const QUALITIES = ["CAM", "HD", "FHD", "4K", "BluRay", "WEB-DL"];
const CATEGORIES = ["Bollywood", "Hollywood", "South Indian", "Korean", "Anime", "Bengali", "Punjabi"];
const PLATFORMS = ["", "Netflix", "Amazon", "Disney+", "Jio HotStar", "Apple TV+"];

const TMDB_API_KEY = "a610d2b017d065200a6571d8b565281d";

const initial = {
  type: "movie",
  title: "", year: 2026, language: "", quality: "WEB-DL", format: "WEB-DL",
  imdb_rating: 7.0, category: "Hollywood", platform: "",
  description: "", thumbnail: "", banner: "",
  screenshot_1: "", screenshot_2: "", screenshot_3: "",
  link_480p: "", link_720p: "", link_1080p: "", link_4k: "",
  season_number: 1, total_episodes: 0,
  episode_links: [] as EpisodeLink[],
  is_trending: false, is_featured: false,
};

type TMDbResult = {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
};

function AddMovie() {
  const [f, setF] = useState<any>(initial);
  const [busy, setBusy] = useState(false);
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  // TMDb search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TMDbResult[]>([]);
  const [openDrop, setOpenDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults((j.results || []).filter((x: TMDbResult) => x.media_type === "movie" || x.media_type === "tv").slice(0, 8));
        setOpenDrop(true);
      } catch (_) { /* ignore */ }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpenDrop(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickTmdb = async (r: TMDbResult) => {
    setOpenDrop(false);
    const title = r.title || r.name || "";
    const date = r.release_date || r.first_air_date || "";
    const year = date ? Number(date.slice(0, 4)) : f.year;
    const isTv = r.media_type === "tv";

    // fetch backdrops as screenshots
    let backdrops: string[] = [];
    try {
      const imgRes = await fetch(`https://api.themoviedb.org/3/${isTv ? "tv" : "movie"}/${r.id}/images?api_key=${TMDB_API_KEY}`);
      const imgJ = await imgRes.json();
      backdrops = (imgJ.backdrops || [])
        .slice(0, 3)
        .map((b: { file_path: string }) => `https://image.tmdb.org/t/p/w780${b.file_path}`);
    } catch (_) { /* ignore */ }

    setF((p: any) => ({
      ...p,
      type: isTv ? "series" : "movie",
      title: cleanTitle(title),
      year,
      description: r.overview || p.description,
      thumbnail: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : p.thumbnail,
      banner: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : p.banner,
      imdb_rating: typeof r.vote_average === "number" ? Number(r.vote_average.toFixed(1)) : p.imdb_rating,
      screenshot_1: backdrops[0] || p.screenshot_1,
      screenshot_2: backdrops[1] || p.screenshot_2,
      screenshot_3: backdrops[2] || p.screenshot_3,
    }));
    setQ(title);
    showToast("Auto-filled from TMDb");
  };

  // Episode management
  const addEpisode = () => {
    const next = (f.episode_links as EpisodeLink[]).length + 1;
    upd("episode_links", [...(f.episode_links as EpisodeLink[]), { episode: next, title: "", link_480p: "", link_720p: "", link_1080p: "" }]);
  };
  const updEp = (i: number, k: keyof EpisodeLink, v: any) => {
    const arr = [...(f.episode_links as EpisodeLink[])];
    arr[i] = { ...arr[i], [k]: k === "episode" ? Number(v) : v };
    upd("episode_links", arr);
  };
  const rmEp = (i: number) => {
    const arr = [...(f.episode_links as EpisodeLink[])];
    arr.splice(i, 1);
    upd("episode_links", arr);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const isSeries = f.type === "series";
    const payload: any = {
      title: f.title,
      year: f.year,
      language: f.language,
      quality: f.quality,
      format: f.format,
      imdb_rating: f.imdb_rating,
      category: f.category,
      platform: f.platform || null,
      description: f.description,
      thumbnail: f.thumbnail,
      banner: f.banner,
      screenshot_1: f.screenshot_1 || null,
      screenshot_2: f.screenshot_2 || null,
      screenshot_3: f.screenshot_3 || null,
      type: f.type,
      is_trending: f.is_trending,
      is_featured: f.is_featured,
      ...(isSeries
        ? {
            season_number: f.season_number,
            total_episodes: f.total_episodes,
            episode_links: f.episode_links,
            link_480p: null, link_720p: null, link_1080p: null, link_4k: null,
          }
        : {
            link_480p: f.link_480p, link_720p: f.link_720p, link_1080p: f.link_1080p, link_4k: f.link_4k,
            episode_links: null,
          }),
    };
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        throw new Error("Please sign in as an admin to add movies.");
      }
      await addMovie({ data: { accessToken: token, movie: payload } });
      showToast(`${isSeries ? "Series" : "Movie"} added successfully`);
      setF(initial);
      setQ("");
    } catch (error: any) {
      showToast(`Error: ${error?.message ?? "Unable to add movie."}`);
    } finally {
      setBusy(false);
    }
  };

  const isSeries = f.type === "series";

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Add {isSeries ? "Web Series" : "Movie"}</h1>

      {/* Type toggle */}
      <div className="inline-flex bg-[#0D1321] border border-[rgba(14,165,233,0.25)] rounded-lg p-1 mb-6">
        <button
          type="button"
          onClick={() => upd("type", "movie")}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${f.type === "movie" ? "bg-[#06B6D4] text-white" : "text-[#cbd5e1]"}`}
        >🎬 Movie</button>
        <button
          type="button"
          onClick={() => upd("type", "series")}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${f.type === "series" ? "bg-[#06B6D4] text-white" : "text-[#cbd5e1]"}`}
        >📺 Web Series</button>
      </div>

      {/* TMDb search */}
      <div ref={dropRef} className="relative max-w-2xl mb-6">
        <div className="flex items-center gap-2 bg-[#0D1321] border border-[rgba(14,165,233,0.3)] rounded-lg px-3">
          <SearchIcon size={16} className="text-[#06B6D4]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpenDrop(true)}
            placeholder="Search on TMDb..."
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
          />
          {searching && <span className="text-xs text-[#64748B]">…</span>}
        </div>
        {openDrop && results.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-[#111827] border border-[rgba(14,165,233,0.3)] rounded-lg shadow-xl max-h-96 overflow-y-auto">
            {results.map((r) => {
              const title = r.title || r.name || "";
              const date = r.release_date || r.first_air_date || "";
              return (
                <button
                  key={`${r.media_type}-${r.id}`}
                  type="button"
                  onClick={() => pickTmdb(r)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-[rgba(14,165,233,0.1)] text-left"
                >
                  {r.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-[#0D1321] rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-[#F1F5F9]">{title}</div>
                    <div className="text-xs text-[#64748B]">
                      {r.media_type === "tv" ? "📺 TV" : "🎬 Movie"} {date && `· ${date.slice(0, 4)}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <Field label="Title"><Input value={f.title} onChange={(v) => upd("title", v)} required /></Field>
        <Field label="Year"><Input type="number" value={f.year} onChange={(v) => upd("year", Number(v))} /></Field>
        <Field label="Language"><Input value={f.language} onChange={(v) => upd("language", v)} /></Field>
        <Field label="Quality"><Select value={f.quality} onChange={(v) => upd("quality", v)} options={QUALITIES} /></Field>
        <Field label="Format"><Input value={f.format} onChange={(v) => upd("format", v)} /></Field>
        <Field label="IMDb Rating"><Input type="number" step="0.1" value={f.imdb_rating} onChange={(v) => upd("imdb_rating", Number(v))} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(v) => upd("category", v)} options={CATEGORIES} /></Field>
        <Field label="Platform"><Select value={f.platform} onChange={(v) => upd("platform", v)} options={PLATFORMS} /></Field>
        <Field label="Description" wide>
          <textarea value={f.description} onChange={(e) => upd("description", e.target.value)} rows={3} className={inputCls} />
        </Field>
        <Field label="Thumbnail URL">
          <Input value={f.thumbnail} onChange={(v) => upd("thumbnail", v)} />
          {f.thumbnail && <img src={f.thumbnail} alt="" className="mt-2 h-24 rounded" />}
        </Field>
        <Field label="Banner URL">
          <Input value={f.banner} onChange={(v) => upd("banner", v)} />
          {f.banner && <img src={f.banner} alt="" className="mt-2 h-24 rounded" />}
        </Field>
        <Field label="Screenshot 1"><Input value={f.screenshot_1} onChange={(v) => upd("screenshot_1", v)} /></Field>
        <Field label="Screenshot 2"><Input value={f.screenshot_2} onChange={(v) => upd("screenshot_2", v)} /></Field>
        <Field label="Screenshot 3" wide><Input value={f.screenshot_3} onChange={(v) => upd("screenshot_3", v)} /></Field>

        {!isSeries && (
          <>
            <Field label="Link 480p"><Input value={f.link_480p} onChange={(v) => upd("link_480p", v)} /></Field>
            <Field label="Link 720p"><Input value={f.link_720p} onChange={(v) => upd("link_720p", v)} /></Field>
            <Field label="Link 1080p"><Input value={f.link_1080p} onChange={(v) => upd("link_1080p", v)} /></Field>
            <Field label="Link 4K"><Input value={f.link_4k} onChange={(v) => upd("link_4k", v)} /></Field>
          </>
        )}

        {isSeries && (
          <>
            <Field label="Season Number"><Input type="number" value={f.season_number} onChange={(v) => upd("season_number", Number(v))} /></Field>
            <Field label="Total Episodes"><Input type="number" value={f.total_episodes} onChange={(v) => upd("total_episodes", Number(v))} /></Field>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[#F1F5F9] uppercase tracking-wider">Episodes</h3>
                <button type="button" onClick={addEpisode} className="inline-flex items-center gap-1 bg-[#06B6D4] text-white px-3 py-1.5 rounded text-xs font-semibold">
                  <Plus size={14} /> Add Episode
                </button>
              </div>
              <div className="space-y-2">
                {(f.episode_links as EpisodeLink[]).length === 0 && (
                  <p className="text-xs text-[#64748B]">No episodes yet. Click "Add Episode".</p>
                )}
                {(f.episode_links as EpisodeLink[]).map((ep, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded p-2">
                    <input type="number" value={ep.episode} onChange={(e) => updEp(i, "episode", e.target.value)} className={inputCls + " col-span-1"} />
                    <input placeholder="Title" value={ep.title || ""} onChange={(e) => updEp(i, "title", e.target.value)} className={inputCls + " col-span-3"} />
                    <input placeholder="480p" value={ep.link_480p || ""} onChange={(e) => updEp(i, "link_480p", e.target.value)} className={inputCls + " col-span-2"} />
                    <input placeholder="720p" value={ep.link_720p || ""} onChange={(e) => updEp(i, "link_720p", e.target.value)} className={inputCls + " col-span-2"} />
                    <input placeholder="1080p" value={ep.link_1080p || ""} onChange={(e) => updEp(i, "link_1080p", e.target.value)} className={inputCls + " col-span-3"} />
                    <button type="button" onClick={() => rmEp(i)} className="col-span-1 text-red-400 hover:text-red-300 flex justify-center"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Toggle label="Trending" value={f.is_trending} onChange={(v) => upd("is_trending", v)} />
        <Toggle label="Featured" value={f.is_featured} onChange={(v) => upd("is_featured", v)} />
        <div className="md:col-span-2">
          <button disabled={busy} className="bg-[#06B6D4] hover:opacity-90 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded">
            {busy ? "Saving…" : `Add ${isSeries ? "Series" : "Movie"}`}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

const inputCls = "w-full bg-[#080C14] border border-[rgba(14,165,233,0.25)] rounded px-3 py-2 text-sm outline-none focus:border-[#06B6D4]";
function Field({ label, children, wide }: any) {
  return <label className={`text-xs text-[#64748B] block ${wide ? "md:col-span-2" : ""}`}><span className="block mb-1 uppercase tracking-wider">{label}</span>{children}</label>;
}
function Input({ value, onChange, type = "text", step, required }: { value: any; onChange: (v: string) => void; type?: string; step?: string; required?: boolean }) {
  return <input type={type} step={step} required={required} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => <option key={o} value={o}>{o || "— None —"}</option>)}
    </select>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded px-3 py-2.5 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition relative ${value ? "bg-[#06B6D4]" : "bg-[#374151]"}`}>
        <span className={`absolute top-0.5 ${value ? "left-5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition-all`} />
      </button>
    </label>
  );
}
