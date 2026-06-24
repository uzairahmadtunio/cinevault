import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/cinevault/AdminShell";
import { type Movie } from "@/lib/supabase";
import { fetchMoviesPaginated } from "@/lib/api/server.movies";
import { showToast } from "@/components/cinevault";
import { getAdminAccessToken } from "@/lib/auth";
import { toggleFeatured, toggleTrending } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/trending")({ component: () => <TogglePage field="is_trending" title="Trending Manager" /> });

export function TogglePage({ field, title }: { field: "is_trending" | "is_featured"; title: string }) {
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async (pageNumber = 1) => {
    setLoading(true);
    const mode = field === "is_trending" ? "trending" : "featured";
    const res = await fetchMoviesPaginated({ data: { mode, page: pageNumber, limit: PAGE_SIZE } });
    setRows((res?.movies as Movie[]) || []);
    setTotal(res?.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(page); }, [page, field]);

  const toggle = async (m: Movie) => {
    const next = !(m as any)[field];
    setRows((r) => r.map((x) => x.id === m.id ? { ...x, [field]: next } : x));
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        throw new Error("Please sign in as an admin to update this movie.");
      }
      if (field === "is_trending") {
        await toggleTrending({ data: { accessToken: token, id: m.id, value: next } });
      } else {
        await toggleFeatured({ data: { accessToken: token, id: m.id, value: next } });
      }
      showToast("Updated successfully");
      load(page);
    } catch (error: any) {
      showToast(`Error: ${error?.message ?? "Unable to toggle"}`);
      load(page);
    }
  };

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-5">{title}</h1>
      <div className="bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded-lg divide-y divide-[rgba(14,165,233,0.1)]">
        {loading ? (
          <div className="p-8 text-center text-[#64748B]">Loading movies…</div>
        ) : rows.map((m) => {
          const v = !!(m as any)[field];
          return (
            <div key={m.id} className="flex items-center gap-4 p-3">
              <img src={m.thumbnail || ""} className="w-10 h-14 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.title}</p>
                <p className="text-xs text-[#64748B]">{m.year} · {m.quality}</p>
              </div>
              <button onClick={() => toggle(m)} className={`w-11 h-6 rounded-full relative ${v ? "bg-[#06B6D4]" : "bg-[#374151]"}`}>
                <span className={`absolute top-0.5 ${v ? "left-5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition-all`} />
              </button>
            </div>
          );
        })}
        {!loading && rows.length === 0 && <div className="p-8 text-center text-[#64748B]">No movies</div>}
      </div>
      <div className="flex items-center justify-between gap-2 mt-4 text-sm text-[#64748B]">
        <div>Showing {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</div>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded bg-[#111827] px-3 py-2 text-sm text-[#F1F5F9] disabled:opacity-50"
          >Previous</button>
          <button
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded bg-[#111827] px-3 py-2 text-sm text-[#F1F5F9] disabled:opacity-50"
          >Next</button>
        </div>
      </div>
    </AdminShell>
  );
}
 
