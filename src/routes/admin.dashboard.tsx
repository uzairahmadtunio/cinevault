import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/cinevault/AdminShell";
import { fetchMovies } from "@/lib/api/server.movies";

export const Route = createFileRoute("/admin/dashboard")({ component: Dashboard });

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, trending: 0, featured: 0 });
  useEffect(() => {
    (async () => {
      try {
        const [all, trending, featured] = await Promise.all([
          fetchMovies({ data: { mode: "all", limit: 1000 } }),
          fetchMovies({ data: { mode: "trending", limit: 1000 } }),
          fetchMovies({ data: { mode: "featured", limit: 1000 } }),
        ]);
        setStats({
          total: (all?.count ?? all?.movies?.length) || 0,
          trending: (trending?.count ?? trending?.movies?.length) || 0,
          featured: (featured?.count ?? featured?.movies?.length) || 0,
        });
      } catch (err: any) {
        console.error("Admin dashboard fetch error", err);
        setStats({ total: 0, trending: 0, featured: 0 });
      }
    })();
  }, []);
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Total Movies" value={stats.total} />
        <Card label="Trending" value={stats.trending} />
        <Card label="Featured" value={stats.featured} />
      </div>
    </AdminShell>
  );
}
function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0D1321] border border-[rgba(14,165,233,0.2)] rounded-lg p-5">
      <p className="text-xs uppercase tracking-wider text-[#64748B]">{label}</p>
      <p className="text-3xl font-extrabold text-[#06B6D4] mt-2">{value}</p>
    </div>
  );
}
