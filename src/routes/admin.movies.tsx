import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { AdminShell } from "@/components/cinevault/AdminShell";
import { cleanTitle, type Movie } from "@/lib/supabase";
import { fetchMoviesPaginated } from "@/lib/api/server.movies";
import { showToast } from "@/components/cinevault";
import { deleteMovie, editMovie } from "@/lib/api/admin.functions";
import { getAdminAccessToken } from "@/lib/auth";

export const Route = createFileRoute("/admin/movies")({ component: ManageMovies });

function ManageMovies() {
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState<Movie[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Movie | null>(null);
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  const load = async (pageNumber: number, searchTerm: string) => {
    setLoading(true);
    const res = await fetchMoviesPaginated({
      data: {
        page: pageNumber,
        limit: PAGE_SIZE,
        search: searchTerm,
        sort: "latest",
      },
    });
    setRows((res?.movies as Movie[]) || []);
    setTotal(res?.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [q]);

  useEffect(() => {
    load(page, debouncedQ);
  }, [page, debouncedQ]);

  const filtered = rows;

  const del = async (id: string) => {
    if (!confirm("Delete this movie?")) return;
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        throw new Error("Please sign in as an admin to delete movies.");
      }
      await deleteMovie({ data: { accessToken: token, id } });
      showToast("Deleted");
      load(page, debouncedQ);
    } catch (error: any) {
      showToast(`Error: ${error?.message ?? "Unable to delete movie."}`);
    }
  };

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Manage Movies</h1>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          className="bg-[#0D1321] border border-[rgba(14,165,233,0.25)] rounded px-3 py-2 text-sm outline-none focus:border-[#06B6D4]"
        />
      </div>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Movies</h1>
          <p className="text-sm text-[#64748B] mt-1">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} movies</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="bg-[#0D1321] border border-[rgba(14,165,233,0.25)] rounded px-3 py-2 text-sm outline-none focus:border-[#06B6D4]"
        />
      </div>
      <div className="overflow-x-auto bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[#111827] text-[#64748B] uppercase text-xs">
            <tr>
              <th className="text-left p-3">Thumbnail</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Year</th>
              <th className="text-left p-3">Quality</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-[#64748B]">Loading movies…</td></tr>
            ) : filtered.length > 0 ? filtered.map((m) => {
              const isSeries = (m.type || "").toLowerCase() === "series";
              return (
                <tr key={m.id} className="border-t border-[rgba(14,165,233,0.1)]">
                  <td className="p-3">
                    {m.thumbnail
                      ? <img src={m.thumbnail} className="w-10 h-14 object-cover rounded" />
                      : <div className="w-10 h-14 rounded bg-[#111827] border border-[rgba(14,165,233,0.15)]" />}
                  </td>
                  <td className="p-3 font-medium">
                    {cleanTitle(m.title)}
                    <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded font-semibold ${isSeries ? "bg-purple-500/20 text-purple-300" : "bg-cyan-500/20 text-cyan-300"}`}>
                      {isSeries ? "📺 Series" : "🎬 Movie"}
                    </span>
                  </td>
                  <td className="p-3 text-[#64748B]">{m.year}</td>
                  <td className="p-3 text-[#06B6D4]">{m.quality}</td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => setEdit(m)} className="text-[#06B6D4] hover:opacity-80"><Pencil size={16} /></button>
                    <button onClick={() => del(m.id)} className="text-red-400 hover:opacity-80"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="p-8 text-center text-[#64748B]">No movies found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="text-sm text-[#64748B]">
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded bg-[#111827] px-3 py-2 text-sm text-[#F1F5F9] disabled:opacity-50"
          >Previous</button>
          <button
            type="button"
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded bg-[#111827] px-3 py-2 text-sm text-[#F1F5F9] disabled:opacity-50"
          >Next</button>
        </div>
      </div>
      {edit && <EditModal movie={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(page, debouncedQ); }} />}
    </AdminShell>
  );
}

function EditModal({ movie, onClose, onSaved }: { movie: Movie; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Movie>(movie);
  const [busy, setBusy] = useState(false);
  const upd = (k: keyof Movie, v: any) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true);
    const { id, created_at, ...patch } = f;
    const patchData = { ...patch } as Record<string, any>;
    // Don't send episode_links in the patch unless the admin explicitly edits them.
    // Many existing rows may have invalid/malformed episode entries which cause
    // server-side zod validation to fail (expects numeric `episode`). Omit to avoid errors.
    if (patchData.hasOwnProperty("episode_links")) {
      delete patchData.episode_links;
    }
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        throw new Error("Please sign in as an admin to update movies.");
      }
      await editMovie({ data: { accessToken: token, id, patch: patchData } });
      showToast("Updated");
      onSaved();
    } catch (error: any) {
      showToast(`Error: ${error?.message ?? "Unable to update movie."}`);
    } finally {
      setBusy(false);
    }
  };
  const inputCls = "w-full bg-[#080C14] border border-[rgba(14,165,233,0.25)] rounded px-3 py-2 text-sm outline-none focus:border-[#06B6D4]";
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0D1321] border border-[rgba(14,165,233,0.3)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[rgba(14,165,233,0.2)] sticky top-0 bg-[#0D1321]">
          <h2 className="font-bold">Edit Movie</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          {(["title","year","language","quality","format","imdb_rating","category","platform","type","season_number","total_episodes","thumbnail","banner","screenshot_1","screenshot_2","screenshot_3","link_480p","link_720p","link_1080p","link_4k"] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-[#64748B] uppercase tracking-wider">{k}</span>
              <input value={(f as any)[k] ?? ""} onChange={(e) => upd(k as keyof Movie, e.target.value)} className={inputCls + " mt-1"} />
            </label>
          ))}
          <label className="col-span-2 block">
            <span className="text-[#64748B] uppercase tracking-wider">description</span>
            <textarea value={f.description ?? ""} onChange={(e) => upd("description", e.target.value)} rows={3} className={inputCls + " mt-1"} />
          </label>
          <ToggleRow label="Trending" v={!!f.is_trending} onChange={(v) => upd("is_trending", v)} />
          <ToggleRow label="Featured" v={!!f.is_featured} onChange={(v) => upd("is_featured", v)} />
        </div>
        <div className="p-4 border-t border-[rgba(14,165,233,0.2)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-[#1f2937] text-sm">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded bg-[#06B6D4] text-white font-semibold text-sm disabled:opacity-50">
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
function ToggleRow({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between bg-[#080C14] border border-[rgba(14,165,233,0.2)] rounded px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!v)} className={`w-10 h-5 rounded-full relative ${v ? "bg-[#06B6D4]" : "bg-[#374151]"}`}>
        <span className={`absolute top-0.5 ${v ? "left-5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition-all`} />
      </button>
    </label>
  );
}
