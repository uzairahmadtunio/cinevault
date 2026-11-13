import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, MovieGrid, FALLBACK_MOVIES, type Movie } from "@/components/cinevault";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { fetchMoviesPaginated } from "@/lib/api/server.movies";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/movies/hollywood")({
  head: () => ({
    title: "Hollywood Movies — CineVault",
    meta: [
      { name: "description", content: "Browse Hollywood movies from CineVault" },
    ],
  }),
  validateSearch: (search: Record<string, any>) => ({
    page: search.page ? parseInt(search.page) : 1,
    sort: search.sort as string | undefined,
    genres: search.genres as string | undefined,
    years: search.years as string | undefined,
  }),
  component: HollywoodPage,
});

const MOVIES_PER_PAGE = 20;

function HollywoodPage() {
  const { page = 1 } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchMoviesPaginated({
        data: { page, filter: "Hollywood", limit: MOVIES_PER_PAGE },
      });
      setMovies((res?.movies as Movie[]) || []);
      setTotal(res?.total || 0);
      setLoading(false);
    })();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const totalPages = Math.ceil(total / MOVIES_PER_PAGE);
  const start = (page - 1) * MOVIES_PER_PAGE + 1;
  const end = Math.min(page * MOVIES_PER_PAGE, total);

  return (
    <SiteShell>
      <section className="py-6 px-4 md:px-8 max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-2">
          🎬 Hollywood Movies
        </h1>
        <p className="text-[#64748B] text-sm mb-6">
          {total > 0 ? `Showing ${start}-${end} of ${total} titles` : "No movies found"}
        </p>

        {loading ? <SkeletonLoader /> : movies.length > 0 ? <MovieGrid movies={movies} loading={false} /> : (
          <div className="text-center py-20 text-[#64748B]">
            <p>No Hollywood movies found</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate({ to: "/movies/hollywood", search: { page: Math.max(1, page - 1), filter: undefined, search: undefined, sort: undefined } })}
              disabled={page === 1}
              className={`p-2 rounded ${page === 1 ? "text-[#64748B] cursor-not-allowed" : "text-[#F1F5F9]"}`}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm text-[#F1F5F9]">Page {page} of {totalPages}</div>
            <button
              onClick={() => navigate({ to: "/movies/hollywood", search: { page: Math.min(totalPages, page + 1), filter: undefined, search: undefined, sort: undefined } })}
              disabled={page === totalPages}
              className={`p-2 rounded ${page === totalPages ? "text-[#64748B] cursor-not-allowed" : "text-[#F1F5F9]"}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
