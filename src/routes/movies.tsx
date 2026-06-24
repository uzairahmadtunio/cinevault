import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { SiteShell, MovieGrid, FALLBACK_MOVIES, type Movie } from "@/components/cinevault";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { fetchMoviesPaginated, getFilterCounts } from "@/lib/api/server.movies";
import { ChevronLeft, ChevronRight, Search as SearchIcon, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/movies")({
  head: () => ({
    title: "All Movies — CineVault",
    meta: [
      { name: "description", content: "Browse all movies from CineVault" },
    ],
  }),
  validateSearch: (search: Record<string, any>) => ({
    page: search.page ? parseInt(search.page) : 1,
    filter: search.filter as string | undefined,
    search: search.search as string | undefined,
    sort: search.sort as string | undefined,
  }),
  component: MoviesBrowser,
});

const MOVIES_PER_PAGE = 20;
const FILTER_TABS = [
  { label: "All", value: "all" },
  { label: "4K", value: "4K" },
  { label: "FHD", value: "FHD" },
  { label: "Netflix", value: "Netflix" },
  { label: "Bollywood", value: "Bollywood" },
  { label: "Hollywood", value: "Hollywood" },
  { label: "South Indian", value: "South" },
  { label: "Korean", value: "Korean" },
  { label: "Bengali", value: "Bengali" },
  { label: "Anime", value: "Anime" },
  { label: "Web Series", value: "Series" },
];

const SORT_OPTIONS = [
  { label: "Latest", value: "latest" },
  { label: "Oldest", value: "oldest" },
  { label: "Top Rated", value: "top-rated" },
  { label: "A-Z", value: "a-z" },
];

function MoviesBrowser() {
  const { page = 1, filter, search, sort } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState(search || "");
  const [sortBy, setSortBy] = useState(sort || "latest");
  const searchTimeout = useRef<NodeJS.Timeout>(undefined);

  // Fetch filter counts on mount
  useEffect(() => {
    (async () => {
      const res = await getFilterCounts({ data: {} });
      setCounts(res);
    })();
  }, []);

  // Fetch movies when params change
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchMoviesPaginated({
        data: {
          page,
          filter: filter || "",
          search: search || "",
          sort: sortBy as "latest" | "oldest" | "top-rated" | "a-z",
          limit: MOVIES_PER_PAGE,
        },
      });
      setMovies((res?.movies as Movie[]) || []);
      setTotal(res?.total || 0);
      setLoading(false);
    })();
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page, filter, search, sortBy, navigate]);

  // Debounced search handler
  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      navigate({
        to: "/movies",
        search: { page: 1, filter, search: value || undefined, sort: sortBy },
      });
    }, 500);
  }, [filter, sortBy, navigate]);

  // Pagination calculations
  const totalPages = Math.ceil(total / MOVIES_PER_PAGE);
  const start = (page - 1) * MOVIES_PER_PAGE + 1;
  const end = Math.min(page * MOVIES_PER_PAGE, total);

  // Smart pagination: show first 2, last 2, current ± 2
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const first2 = [1, 2];
    const last2 = [Math.max(1, totalPages - 1), totalPages];
    const around = [
      Math.max(1, page - 2),
      Math.max(1, page - 1),
      page,
      Math.min(totalPages, page + 1),
      Math.min(totalPages, page + 2),
    ];

    const allPages = new Set([...first2, ...last2, ...around]);
    const sorted = Array.from(allPages).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        pages.push("...");
      }
      pages.push(sorted[i]);
    }
    return pages;
  };

  const activeFilter = filter || "all";
  const activeSort = sortBy || "latest";

  return (
    <SiteShell>
      <section className="py-6 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-2">
            🎬 Browse Movies & Series
          </h1>
          <p className="text-[#64748B] text-sm">
            {total > 0 ? `Showing ${start}-${end} of ${total} titles` : "No movies found"}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[#06B6D4]" size={18} />
            <input
              type="text"
              placeholder="Search movies..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#111827] border border-[rgba(14,165,233,0.2)] text-[#F1F5F9] placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
            />
          </div>
          {/* Sort Dropdown */}
          <select
            value={activeSort}
            onChange={(e) => {
              setSortBy(e.target.value);
              navigate({
                to: "/movies",
                search: { page: 1, filter, search, sort: e.target.value },
              });
            }}
            className="px-3 py-2.5 rounded-lg bg-[#111827] border border-[rgba(14,165,233,0.2)] text-[#F1F5F9] focus:border-[#06B6D4] focus:outline-none flex items-center gap-2"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Tabs with Counts */}
        <div className="mb-6 overflow-x-auto no-scrollbar pb-2">
          <div className="flex gap-2">
            {FILTER_TABS.map((tab) => {
              const count = counts[tab.value === "all" ? "all" : tab.value.toLowerCase()] || 0;
              const isActive = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() =>
                    navigate({
                      to: "/movies",
                      search: { page: 1, filter: tab.value === "all" ? undefined : tab.value, search, sort: sortBy },
                    })
                  }
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                    isActive
                      ? "bg-[#06B6D4] text-white"
                      : "bg-[#111827] text-[#64748B] border border-[rgba(14,165,233,0.2)] hover:text-[#F1F5F9]"
                  }`}
                >
                  {tab.label} <span className="text-xs opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Movies Grid */}
        {loading ? <SkeletonLoader /> : movies.length > 0 ? <MovieGrid movies={movies} loading={false} /> : (
          <div className="text-center py-20 text-[#64748B]">
            <SearchIcon size={48} className="mx-auto mb-3 opacity-40" />
            <p>No movies found</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 space-y-4">
            {/* Desktop Pagination */}
            <div className="hidden md:flex justify-center items-center gap-2 flex-wrap">
              {/* Previous Button */}
              <button
                onClick={() => navigate({ to: "/movies", search: { page: Math.max(1, page - 1), filter, search, sort: sortBy } })}
                disabled={page === 1}
                className={`p-2 rounded ${
                  page === 1
                    ? "bg-[#111827] text-[#64748B] cursor-not-allowed"
                    : "bg-[#111827] text-[#F1F5F9] hover:border-[#06B6D4] border border-[rgba(14,165,233,0.2)]"
                }`}
              >
                <ChevronLeft size={18} />
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((num, idx) => {
                if (num === "...") {
                  return (
                    <span key={`dots-${idx}`} className="text-[#64748B] px-2">
                      …
                    </span>
                  );
                }
                const pageNum = num as number;
                const isActive = pageNum === page;
                return (
                  <button
                    key={pageNum}
                    onClick={() => navigate({ to: "/movies", search: { page: pageNum, filter, search, sort: sortBy } })}
                    className={`w-10 h-10 rounded text-sm font-medium transition ${
                      isActive
                        ? "bg-[#06B6D4] text-white"
                        : "bg-[#111827] text-[#F1F5F9] border border-[rgba(14,165,233,0.2)] hover:border-[#06B6D4]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                onClick={() => navigate({ to: "/movies", search: { page: Math.min(totalPages, page + 1), filter, search, sort: sortBy } })}
                disabled={page === totalPages}
                className={`p-2 rounded ${
                  page === totalPages
                    ? "bg-[#111827] text-[#64748B] cursor-not-allowed"
                    : "bg-[#111827] text-[#F1F5F9] hover:border-[#06B6D4] border border-[rgba(14,165,233,0.2)]"
                }`}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Mobile Pagination */}
            <div className="md:hidden flex justify-center items-center gap-3">
              <button
                onClick={() => navigate({ to: "/movies", search: { page: Math.max(1, page - 1), filter, search, sort: sortBy } })}
                disabled={page === 1}
                className={`p-2 rounded ${page === 1 ? "text-[#64748B] cursor-not-allowed" : "text-[#F1F5F9]"}`}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-sm text-[#F1F5F9] font-medium">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => navigate({ to: "/movies", search: { page: Math.min(totalPages, page + 1), filter, search, sort: sortBy } })}
                disabled={page === totalPages}
                className={`p-2 rounded ${page === totalPages ? "text-[#64748B] cursor-not-allowed" : "text-[#F1F5F9]"}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
