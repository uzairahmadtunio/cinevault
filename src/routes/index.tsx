import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  SiteShell, HeroSlider, NoticeBanner, TrendingSection,
  MovieGrid, FALLBACK_MOVIES, titlePosterDataUrl, type Movie,
} from "@/components/cinevault";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { fetchMoviesPaginated, getFilterCounts, fetchTrendingOrTopRated } from "@/lib/api/server.movies";
import { useSiteMode } from "@/lib/siteMode";
import { fuzzyFind, getSearchIndex, normalizeForSearch, type SearchIndexItem } from "@/lib/searchIndex";
import { continueWatchingUrl, loadContinueWatching, removeContinueWatching, type CWEntry } from "@/lib/continueWatching";
import { ChevronLeft, ChevronRight, Search as SearchIcon, AlertCircle, SlidersHorizontal, X, Sparkles, Zap, Clapperboard, Globe, Film, Shield, Bookmark, TrendingUp, Play } from "lucide-react";
import { CURRENT_MIRROR_INDEX, BASE_DOMAIN, getActiveCatalogUrl, getCrossDomainCatalogUrl, isMirrorHostname } from "@/lib/utils/domainConfig";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "CineVault — 4K · HD · WEB-DL · Anime Downloads",
    meta: [
      { name: "description", content: "CineVault is your premium hub for 4K, HD, WEB-DL movies, web series, K-Drama and Anime downloads." },
      { property: "og:title", content: "CineVault — Premium Movie & Series Downloads" },
      { property: "og:description", content: "Download the latest 4K and HD movies, web series, anime and K-Drama at CineVault." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as string) || undefined,
    // NOTE: do NOT default page to 1 here — validateSearch canonicalization
    // force-redirects every bare URL to ?page=1 (307), and that redirect step
    // fails on some networks/browsers (ERR_FAILED). Home defaults page to 1.
    page: Number(search.page) || undefined,
    category: (search.category as string) || undefined, // handles '4k', 'fhd', 'anime', 'kdrama', 'adult'
    platform: (search.platform as string) || undefined, // handles 'netflix', 'amazon', 'hbo', etc.
    type: (search.type as string) || undefined,         // handles 'movie', 'series'
    search: (search.search as string) || undefined,
    sort: (search.sort as string) || undefined,
    genres: (search.genres as string) || undefined,
    years: (search.years as string) || undefined,
  }),
  component: Home,
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

const GENRES_LIST = [
  "Action", "Adventure", "Comedy", "Drama", "Thriller", 
  "Sci-Fi", "Horror", "Romance", "Fantasy", "Animation", 
  "Crime", "Mystery"
];

const YEARS_LIST = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

// ============================================================================
// PREMIUM LANDING PAGE COMPONENT
// ============================================================================
interface PremiumLandingPageProps {
  // Component is now fully self-contained with Link navigation
}

function PremiumLandingPage({ }: PremiumLandingPageProps) {
  const catalogHref = (typeof window !== 'undefined' ? getCrossDomainCatalogUrl(window.location.hostname) : null) ?? `/?view=catalog`;

  const features = [
    {
      icon: Film,
      title: "Comprehensive Movie Database",
      description: "7,000+ titles across all genres and platforms",
    },
    {
      icon: Globe,
      title: "Streaming Platform Guide",
      description: "Netflix, Amazon Prime, Disney+, and 10+ more",
    },
    {
      icon: Sparkles,
      title: "Expert Reviews & Ratings",
      description: "In-depth analysis and community ratings",
    },
    {
      icon: TrendingUp,
      title: "Latest Industry News",
      description: "Stay updated with trending releases",
    },
    {
      icon: Shield,
      title: "Privacy & Security",
      description: "Your data is protected with strict standards",
    },
    {
      icon: Bookmark,
      title: "Educational Content",
      description: "Learn about cinema, directors, and filmmaking",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "#0D1321" }}>
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
            animation: "slide 20s linear infinite",
          }}
        />
      </div>

      {/* Radial glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: "#06B6D4" }}
      />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24">
        
        {/* Header Section */}
        <div className="text-center space-y-6 mb-10 md:mb-12 max-w-3xl mx-auto animate-fade-up">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(6, 182, 212, 0.1)", border: "1px solid #06B6D4" }}>
              <Film size={28} style={{ color: "#06B6D4" }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              Advanced Cinematic Data Matrix
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white leading-tight">
            CineVault
          </h1>

          <p className="text-lg md:text-xl font-light text-slate-300 leading-relaxed max-w-2xl mx-auto mb-4">
            Your trusted source for movie reviews, ratings, trailers, and comprehensive streaming platform guides.
          </p>

          {/* Hero CTA Button - Top Section */}
          <a
            href={catalogHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex px-10 py-3.5 rounded-lg font-bold text-base transition-all duration-300 overflow-hidden text-white bg-[#06B6D4] hover:bg-[#0891B2] hover:glow-cyan hover:scale-[1.03] mt-2 mb-4"
            style={{
              boxShadow: "0 0 20px rgba(6, 182, 212, 0.25)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Explore Movies 🚀
            </span>
          </a>
        </div>

        {/* About CineVault Section */}
        <div className="bg-[#111827] border border-cyan-500/10 rounded-2xl p-8 md:p-12 mb-16 max-w-4xl mx-auto animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span style={{ color: "#06B6D4" }}>★</span> About CineVault
          </h2>
          <p className="text-slate-300 leading-relaxed">
            CineVault is an advanced cinematic data matrix and administrative information engine for global movies, web series, and anime content. We provide a clean, ad-free environment with strict user privacy standards and high structural quality. Our mission is to aggregate comprehensive metadata, ratings, and streaming availability information to help cinema enthusiasts discover their next favorite content across all major platforms worldwide.
          </p>
        </div>

        {/* Why Choose CineVault - Feature Grid */}
        <div className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center flex items-center justify-center gap-2">
            <span style={{ color: "#06B6D4" }}>★</span> Why Choose CineVault <span style={{ color: "#06B6D4" }}>★</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-xl border bg-[#0D1321] transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  style={{
                    borderColor: "rgba(6, 182, 212, 0.2)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#06B6D4";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(6, 182, 212, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(6, 182, 212, 0.2)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(6, 182, 212, 0.1)" }}>
                      <Icon size={24} style={{ color: "#06B6D4" }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-xs text-slate-400">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0D1321] border border-cyan-500/20 rounded-2xl p-12 text-center mb-20 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="text-3xl font-bold text-white mb-4">Join Our Community</h3>
          <p className="text-slate-300 mb-8 text-lg">
            Explore thousands of movies, series, and anime with advanced filtering, reviews, and ratings. Discover your next favorite content today.
          </p>
          
          {/* Link Button opening in new tab */}
          <a
            href={catalogHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex px-12 py-4 rounded-xl font-bold text-lg transition-all duration-300 overflow-hidden text-white"
            style={{
              background: "linear-gradient(135deg, #06B6D4 0%, #0891b2 100%)",
              boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(6, 182, 212, 0.5)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(6, 182, 212, 0.3)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Explore Movies 🚀
            </span>
            {/* Animated shimmer overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                animation: "shimmer 2s infinite",
              }}
            />
          </a>

          <p className="text-xs text-slate-500 font-medium mt-6">Join 100K+ cinema enthusiasts worldwide</p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-8 text-center mb-20 border-t border-slate-700 pt-12">
          <div>
            <p className="text-4xl md:text-5xl font-black" style={{ color: "#06B6D4" }}>
              7000+
            </p>
            <p className="text-xs text-slate-500 mt-3 uppercase tracking-wider">Titles Available</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-black" style={{ color: "#06B6D4" }}>
              4K/HD
            </p>
            <p className="text-xs text-slate-500 mt-3 uppercase tracking-wider">Max Quality</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-black" style={{ color: "#06B6D4" }}>
              99.9%
            </p>
            <p className="text-xs text-slate-500 mt-3 uppercase tracking-wider">Uptime</p>
          </div>
        </div>
      </div>

      {/* Legal Compliance Footer */}
      <div className="relative z-10 border-t border-slate-700 py-12 px-4 text-center bg-[#0D1321]/50">
        <div className="max-w-4xl mx-auto space-y-6">
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-300">⚖️ Legal Notice:</span> CineVault operates as an administrative metadata matrix and content information repository. We do not host, store, stream, or distribute any media files. All content links provided are sourced from public third-party platforms. We comply with all DMCA regulations and intellectual property laws. For copyright claims or inquiries, contact: legal@cinevault.cv or DMCA@cinevault.cv
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <Link to="/about-us" className="text-[#64748B] hover:text-[#06B6D4] transition duration-200">About Us</Link>
            <span className="text-[#64748B]">·</span>
            <Link to="/privacy-policy" className="text-[#64748B] hover:text-[#06B6D4] transition duration-200">Privacy Policy</Link>
            <span className="text-[#64748B]">·</span>
            <Link to="/contact-us" className="text-[#64748B] hover:text-[#06B6D4] transition duration-200">Contact Us</Link>
          </div>

          <div className="text-xs text-slate-500 font-medium space-y-2">
            <div>
              © 2026 CineVault. All rights reserved. | Terms of Service | DMCA
            </div>
            <div className="text-sm pt-2">
              Developed by <span className="text-[#06B6D4] font-bold tracking-wide hover:text-[#22d3ee] transition duration-300" style={{ textShadow: "0 0 10px rgba(6, 182, 212, 0.6)" }}>Uzair Ahmad</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(50px);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-fade-up {
          animation: fade-up 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-fade-up:nth-child(1) { animation-delay: 0s; }
        .animate-fade-up:nth-child(2) { animation-delay: 0.1s; }
        .animate-fade-up:nth-child(3) { animation-delay: 0.2s; }
      `}</style>
    </div>
  );
}

function Home() {
  const { page = 1, search, sort, view, category, platform, type, genres, years } = Route.useSearch();
  const navigate = Route.useNavigate();
  
  // ---- Multi-domain detection ----
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const subdomainPrefix = hostname.split('.')[0];
  const isDev =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.") ||
    port === "8080";
  const hasDefaultCatalogQuery = !search && !category && !platform && !type && !genres && !years;
  const showCatalog =
    view === "catalog" ||
    isMirrorHostname(hostname) ||
    (isDev && (page === 1 || hasDefaultCatalogQuery));

  // If on root landing domain, show simple landing page instead of catalog
  // NOTE (2026-11-13, on Uzair's order): landing-first also applies on the
  // vercel.app deployment — root shows the decoy landing, catalog opens via
  // ?view=catalog (Explore Movies button), exactly like the original setup.
  const showLandingOnly = !showCatalog && (
    hostname === BASE_DOMAIN ||
    hostname === `www.${BASE_DOMAIN}` ||
    (!isDev && !isMirrorHostname(hostname))
  );

  // Catalog domain matching
  const isCatalogDomain = showCatalog || isMirrorHostname(hostname) || hostname.endsWith(".vercel.app") || isDev;
  
  // Outdated mirror detection
  const subdomainMatch = subdomainPrefix.match(/^(\d+)movie$/);
  const currentMirrorNum = subdomainMatch ? parseInt(subdomainMatch[1], 10) : null;
  const isOutdatedMirror = currentMirrorNum !== null && currentMirrorNum < CURRENT_MIRROR_INDEX;

  const sortBy = sort || "latest";

  // ============================================================================
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks)
  // ============================================================================
  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [trending, setTrending] = useState<Movie[]>([]);
  // Start in the loading state: the first paint must show skeletons, never a
  // false "No titles matched" empty state while the catalog request is flying.
  const [loading, setLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const { mode } = useSiteMode();
  const [cwEntries, setCwEntries] = useState<CWEntry[]>([]);
  const [searchIdx, setSearchIdx] = useState<SearchIndexItem[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  
  const [searchInput, setSearchInput] = useState(search || "");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>(undefined);

  // Dynamic Page Titles & SEO Meta
  useEffect(() => {
    if (view === "catalog") {
      document.title = `Browse Movies & Series | Page ${page || 1} - CineVault`;
    } else {
      document.title = "CineVault - Comprehensive Streaming Guide & Reviews";
    }
  }, [view, page]);

  const scrollToCatalogGrid = () => {
    setTimeout(() => {
      const anchor = document.getElementById("catalog-grid-anchor");
      if (anchor) {
        anchor.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 50);
  };

  // Fetch trending movies on mount
  useEffect(() => {
    (async () => {
      setTrendingLoading(true);
      const res = await fetchTrendingOrTopRated({ data: { limit: 10 } });
      setTrending((res?.movies as Movie[]) || FALLBACK_MOVIES.slice(0, 8));
      setTrendingLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await getFilterCounts({ data: {} });
      setCounts(res);
      setCountsLoaded(true);
    })();
  }, []);

  // Continue Watching entries (localStorage) + the smart-search title index
  // (fetched once, cached) — both are client-only niceties, loaded on mount.
  useEffect(() => {
    setCwEntries(loadContinueWatching());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSearchIndex().then((items) => {
      if (!cancelled) setSearchIdx(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeCw = (e: CWEntry) => {
    removeContinueWatching(e.id, e.ep);
    setCwEntries(loadContinueWatching());
  };

  useEffect(() => {
    setSearchInput(search || "");
  }, [search]);

  // Map route search params to server `filter` values used by fetchMoviesPaginated
  const getFilterValue = () => {
    if (category && category.toLowerCase() === "4k") return "4K";
    if (category && category.toLowerCase() === "fhd") return "FHD";
    if (platform && platform.toLowerCase() === "netflix") return "Netflix";
    if (category && category.toLowerCase() === "bollywood") return "Bollywood";
    if (category && category.toLowerCase() === "hollywood") return "Hollywood";
    if (category && category.toLowerCase() === "south") return "South";
    if (category && category.toLowerCase() === "korean") return "Korean";
    if (category && category.toLowerCase() === "bengali") return "Bengali";
    if (category && category.toLowerCase() === "anime") return "Anime";
    if (type && type.toLowerCase() === "series") return "Series";
    return "";
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchMoviesPaginated({
        data: {
          page,
          limit: MOVIES_PER_PAGE,
          filter: getFilterValue(),
          search: search || "",
          sort: sortBy as "latest" | "oldest" | "top-rated" | "a-z",
          genres: genres || undefined,
          years: years || undefined,
        },
      });
      setMovies((res?.movies as Movie[]) || []);
      setTotal(res?.total || 0);
      setLoading(false);
    })();
  }, [page, category, platform, type, genres, years, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / MOVIES_PER_PAGE));
  const start = total > 0 ? (page - 1) * MOVIES_PER_PAGE + 1 : 0;
  const end = Math.min(page * MOVIES_PER_PAGE, total);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  // Auto-redirect to active mirror if current domain is outdated
  useEffect(() => {
    if (isOutdatedMirror && typeof window !== 'undefined') {
      window.location.replace(`https://${getActiveCatalogUrl()}${window.location.pathname}${window.location.search}`);
    }
  }, [isOutdatedMirror]);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      navigate({
        to: "/",
        search: (prev) => ({
          ...prev,
          view: "catalog",
          page: 1,
          search: value || undefined,
        }),
      });
    }, 300);
  }, [navigate]);

  const handleToggleGenre = (g: string) => {
    const selectedList = genres ? genres.split(",") : [];
    let newList;
    if (selectedList.includes(g)) {
      newList = selectedList.filter((x) => x !== g);
    } else {
      newList = [...selectedList, g];
    }
    
    navigate({
      to: "/",
      search: (prev) => ({
        ...prev,
        view: "catalog",
        page: 1,
        genres: newList.length > 0 ? newList.join(",") : undefined,
      }),
    });
  };

  const handleToggleYear = (y: string) => {
    const selectedList = years ? years.split(",") : [];
    let newList;
    if (selectedList.includes(y)) {
      newList = selectedList.filter((x) => x !== y);
    } else {
      newList = [...selectedList, y];
    }
    
    navigate({
      to: "/",
      search: (prev) => ({
        ...prev,
        view: "catalog",
        page: 1,
        years: newList.length > 0 ? newList.join(",") : undefined,
      }),
    });
  };

  const handleResetAll = () => {
    setSearchInput("");
    navigate({
      to: "/",
      search: {
        view: "catalog",
        page: 1,
      },
    });
  };


  const getActiveTab = () => {
    if (!category && !platform && !type) return "all";
    if (category === "4k") return "4K";
    if (category === "fhd") return "FHD";
    if (platform?.toLowerCase() === "netflix") return "Netflix";
    if (category === "bollywood") return "Bollywood";
    if (category === "hollywood") return "Hollywood";
    if (category === "south") return "South";
    if (category === "korean") return "Korean";
    if (category === "bengali") return "Bengali";
    if (category === "anime") return "Anime";
    if (type === "series") return "Series";
    return "all";
  };

  const getTabSearch = (tabValue: string) => {
    const cleanFilters = {
      category: undefined,
      platform: undefined,
      type: undefined,
    };
    if (tabValue === "4K") return { ...cleanFilters, category: "4k" };
    if (tabValue === "FHD") return { ...cleanFilters, category: "fhd" };
    if (tabValue === "Netflix") return { ...cleanFilters, platform: "netflix" };
    if (tabValue === "Bollywood") return { ...cleanFilters, category: "bollywood" };
    if (tabValue === "Hollywood") return { ...cleanFilters, category: "hollywood" };
    if (tabValue === "South") return { ...cleanFilters, category: "south" };
    if (tabValue === "Korean") return { ...cleanFilters, category: "korean" };
    if (tabValue === "Bengali") return { ...cleanFilters, category: "bengali" };
    if (tabValue === "Anime") return { ...cleanFilters, category: "anime" };
    if (tabValue === "Series") return { ...cleanFilters, type: "series" };
    return cleanFilters;
  };

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

  const activeFilter = getActiveTab();
  const activeSort = sortBy || "latest";

  // Hero + Trending are discovery furniture for the default view only — while
  // a search or filter is active they ignore it, which confuses users, so
  // they are hidden until the view is reset.
  const filtersActive = Boolean(search || category || platform || type || genres || years);

  // Live suggestions for the catalog search box (local fuzzy index, no network).
  const suggestions = useMemo(() => {
    if (!suggestOpen || !searchInput.trim() || !searchIdx.length) return [];
    return fuzzyFind(searchIdx, searchInput, 8);
  }, [suggestOpen, searchInput, searchIdx]);

  // "Did you mean": a submitted search with (almost) no results, but a close
  // title exists in the catalog — offer the corrected search, YouTube-style.
  const didYouMean = useMemo(() => {
    if (!search || loading || movies.length > 2 || !searchIdx.length) return null;
    const top = fuzzyFind(searchIdx, search, 3)[0];
    if (!top) return null;
    if (movies.some((m) => String(m.id) === top.item.id)) return null;
    const candidate = top.item.display;
    if (!candidate || normalizeForSearch(candidate) === normalizeForSearch(search)) return null;
    return candidate;
  }, [search, loading, movies, searchIdx]);

  // ============================================================================
  // CONDITIONAL RENDERING (no early return - JSX level only)
  // ============================================================================
  if (showCatalog) {
    // Force the catalog view when the explicit view parameter is present.
  } else if (showLandingOnly || !isCatalogDomain) {
    return <PremiumLandingPage />;
  }

  return (
    <SiteShell>
      {!filtersActive && <HeroSlider />}
      <NoticeBanner />
      {mode === "stream" && cwEntries.length > 0 && (
        <ContinueWatchingRow entries={cwEntries} onRemove={removeCw} />
      )}
      {!filtersActive && <TrendingSection movies={trending} loading={trendingLoading} />}
      {mode === "download" && cwEntries.length > 0 && (
        <ContinueWatchingRow entries={cwEntries} onRemove={removeCw} />
      )}
      
      <section id="catalog-grid-anchor" className="py-8 px-4 md:px-8 max-w-7xl mx-auto">
        
        {/* HEADER AREA */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#F1F5F9] mb-2 tracking-tight">
              🎬 Latest Releases
            </h1>
            <p className="text-[#64748B] text-sm font-medium">
              {loading ? "Loading titles…" : total > 0 ? `Showing ${start}-${end} of ${total} titles` : "No titles matched"}
            </p>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-start md:self-end">
            <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">Sort by:</span>
            <select
              value={activeSort}
              onChange={(e) => {
                navigate({
                  to: "/",
                  search: (prev) => ({
                    ...prev,
                    page: 1,
                    sort: e.target.value,
                  }),
                });
              }}
              className="px-3 py-2 rounded-lg bg-[#111827] border border-[rgba(14,165,233,0.15)] text-[#F1F5F9] focus:border-[#06B6D4] focus:outline-none text-xs font-semibold cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SEARCH & HORIZONTAL FILTER CHIPS */}
        <div className="space-y-4 mb-8">
          {/* Live Search Input & Toggle Filters trigger row */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#06B6D4]" size={18} />
              <input
                type="text"
                placeholder="Search catalog by movie title, series name..."
                value={searchInput}
                onChange={(e) => {
                  handleSearch(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSuggestOpen(false);
                }}
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#0D1321] border border-[rgba(14,165,233,0.15)] text-[#F1F5F9] placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none text-sm transition shadow-inner focus:shadow-[0_0_20px_rgba(6,182,212,0.1)]"
              />
              {/* Live suggestions (typo-tolerant, from the local title index) */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl bg-[#111827] border border-[rgba(14,165,233,0.25)] shadow-2xl overflow-hidden">
                  {suggestions.map((h) => (
                    <button
                      key={h.item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSuggestOpen(false);
                        navigate({ to: "/movie/$id", params: { id: h.item.id } });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[rgba(14,165,233,0.12)] transition"
                    >
                      {h.item.thumbnail ? (
                        <img src={h.item.thumbnail} alt="" className="w-8 h-11 object-cover rounded shrink-0" loading="lazy" />
                      ) : (
                        <span className="w-8 h-11 rounded bg-[#0D1321] flex items-center justify-center text-[#06B6D4] shrink-0">
                          <Film size={14} />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#F1F5F9] truncate">{h.item.display}</span>
                        {h.item.year ? <span className="block text-[11px] text-[#64748B]">{h.item.year}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Slide-Over Toggle Button */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-5 py-3.5 rounded-xl bg-[#0D1321] border border-cyan-500/30 text-cyan-400 hover:text-white hover:bg-cyan-950/20 hover:border-cyan-500 flex items-center gap-2 font-bold text-sm transition shadow-md cursor-pointer whitespace-nowrap relative"
              style={{ boxShadow: "0 0 15px rgba(6, 182, 212, 0.05)" }}
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
              {(genres || years) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
              )}
            </button>
          </div>

          {/* Horizontal Filter Tabs */}
          <div className="overflow-x-auto no-scrollbar pb-1">
            <div className="flex gap-2">
              {FILTER_TABS.map((tab) => {
                const key = tab.value === "all" ? "all" : tab.value.toLowerCase();
                const count = counts[key] || 0;
                const isActive = activeFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() =>
                      navigate({
                        to: "/",
                        search: (prev) => ({
                          ...prev,
                          page: 1,
                          ...getTabSearch(tab.value),
                        }),
                      })
                    }
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-md shadow-cyan-500/20"
                        : "bg-[#111827] text-[#64748B] border border-[rgba(14,165,233,0.15)] hover:bg-gray-800/60 hover:text-white hover:border-gray-700/50 transition-all duration-200 cursor-pointer"
                    }`}
                  >
                    {tab.label} {countsLoaded && <span className="text-[10px] opacity-75">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* DID YOU MEAN */}
        {didYouMean && (
          <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[rgba(14,165,233,0.25)] bg-[#0D1321] px-4 py-3 text-sm">
            <span className="text-[#94A3B8]">Did you mean:</span>
            <button
              onClick={() =>
                navigate({
                  to: "/",
                  search: (prev) => ({ ...prev, view: "catalog", page: 1, search: didYouMean }),
                })
              }
              className="font-bold text-[#06B6D4] hover:underline cursor-pointer"
            >
              {didYouMean}
            </button>
            <span className="text-[#94A3B8]">?</span>
          </div>
        )}

        {/* FULL-WIDTH CARD CATALOG GRID */}
        <div className="w-full space-y-8">
          
          {loading ? (
            <SkeletonLoader />
          ) : movies.length > 0 ? (
            /* Movie Catalog Grid */
            <MovieGrid movies={movies} loading={false} />
          ) : (
            /* Custom NO MATCHES overlay placeholder */
            <div className="text-center py-20 bg-[#0D1321] border border-cyan-500/10 rounded-2xl p-8 max-w-xl mx-auto animate-fade-up">
              <AlertCircle size={48} className="text-[#06B6D4]/70 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-[#F1F5F9] mb-2">
                No Cinematic Records Found for this Query
              </h3>
              <p className="text-sm text-[#64748B] mb-6">
                Try searching another title! 🎬
              </p>
              <button
                onClick={handleResetAll}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white rounded-lg font-bold shadow-lg hover:scale-105 transition duration-300 text-xs tracking-wide uppercase cursor-pointer"
                style={{ boxShadow: "0 0 15px rgba(6, 182, 212, 0.2)" }}
              >
                Reset Search
              </button>
            </div>
          )}

          {/* Pagination controls */}
          {!loading && totalPages > 1 && (
            <div className="mt-8 space-y-4 border-t border-cyan-500/5 pt-6">
              
              {/* Desktop Pagination */}
              <div className="hidden md:flex justify-center items-center gap-2 flex-wrap">
                {/* Previous Button */}
                <button
                  onClick={() => {
                    navigate({ to: "/", search: (prev) => ({ ...prev, page: Math.max(1, page - 1), view: "catalog" }) });
                    scrollToCatalogGrid();
                  }}
                  disabled={page === 1}
                  className={`p-2.5 rounded-lg transition ${
                    page === 1
                      ? "bg-[#111827] text-[#64748B] cursor-not-allowed border border-transparent"
                      : "bg-[#111827] text-[#F1F5F9] hover:border-[#06B6D4]/50 border border-[rgba(14,165,233,0.15)] cursor-pointer"
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {getPageNumbers().map((num, idx) => {
                  if (num === "...") {
                    return (
                      <span key={`dots-${idx}`} className="text-[#64748B] px-2 font-bold">
                        …
                      </span>
                    );
                  }
                  const pageNum = num as number;
                  const isActive = pageNum === page;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => {
                        navigate({ to: "/", search: (prev) => ({ ...prev, page: pageNum, view: "catalog" }) });
                        scrollToCatalogGrid();
                      }}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-[#06B6D4] text-white shadow-md shadow-cyan-500/20"
                          : "bg-[#111827] text-[#F1F5F9] border border-[rgba(14,165,233,0.15)] hover:border-[#06B6D4]/50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Next Button */}
                <button
                  onClick={() => {
                    navigate({ to: "/", search: (prev) => ({ ...prev, page: Math.min(totalPages, page + 1), view: "catalog" }) });
                    scrollToCatalogGrid();
                  }}
                  disabled={page === totalPages}
                  className={`p-2.5 rounded-lg transition ${
                    page === totalPages
                      ? "bg-[#111827] text-[#64748B] cursor-not-allowed border border-transparent"
                      : "bg-[#111827] text-[#F1F5F9] hover:border-[#06B6D4]/50 border border-[rgba(14,165,233,0.15)] cursor-pointer"
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Mobile Pagination */}
              <div className="md:hidden flex justify-center items-center gap-3">
                <button
                  onClick={() => {
                    navigate({ to: "/", search: (prev) => ({ ...prev, page: Math.max(1, page - 1), view: "catalog" }) });
                    scrollToCatalogGrid();
                  }}
                  disabled={page === 1}
                  className={`p-2 rounded border border-[rgba(14,165,233,0.15)] ${page === 1 ? "text-[#64748B] cursor-not-allowed bg-transparent" : "text-[#F1F5F9] bg-[#111827]"}`}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-xs text-[#CBD5E1] font-semibold">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => {
                    navigate({ to: "/", search: (prev) => ({ ...prev, page: Math.min(totalPages, page + 1), view: "catalog" }) });
                    scrollToCatalogGrid();
                  }}
                  disabled={page === totalPages}
                  className={`p-2 rounded border border-[rgba(14,165,233,0.15)] ${page === totalPages ? "text-[#64748B] cursor-not-allowed bg-transparent" : "text-[#F1F5F9] bg-[#111827]"}`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

            </div>
          )}

        </div>

      </section>

      {/* DYNAMIC FIXED SLIDE-OVER DRAWER FOR FILTERS */}
      {/* Clickable Backdrop overlay */}
      <div
        onClick={() => setIsFilterOpen(false)}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isFilterOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer Body content */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#131926]/95 border-r border-cyan-500/20 backdrop-blur-md shadow-2xl z-50 p-6 overflow-y-auto transform transition-transform duration-300 flex flex-col justify-between ${
          isFilterOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex justify-between items-center pb-4 border-b border-cyan-500/10">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-cyan-400" />
              <span className="font-bold text-[#F1F5F9] text-xs uppercase tracking-wider">Filters Matrix</span>
            </div>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="p-1 rounded-full text-[#64748B] hover:text-white hover:bg-gray-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Genre Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">Genres</label>
              {genres && (
                <button
                  onClick={() => {
                    navigate({
                      to: "/",
                      search: (prev) => ({
                        ...prev,
                        genres: undefined,
                      }),
                    });
                  }}
                  className="text-[10px] text-[#64748B] hover:text-cyan-400 font-bold uppercase transition"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES_LIST.map((g) => {
                const selectedList = genres ? genres.split(",") : [];
                const isSelected = selectedList.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => handleToggleGenre(g)}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition text-left cursor-pointer select-none flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#06B6D4]/20 border-[#06B6D4] text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                        : "bg-[#111827]/50 border-[rgba(14,165,233,0.15)] text-[#64748B] hover:text-[#F1F5F9] hover:bg-cyan-950/10"
                    }`}
                  >
                    <span>{g}</span>
                    {isSelected && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(6,182,212,1)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Release Year Selection */}
          <div className="space-y-3 pt-4 border-t border-cyan-500/10">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">Release Year</label>
              {years && (
                <button
                  onClick={() => {
                    navigate({
                      to: "/",
                      search: (prev) => ({
                        ...prev,
                        years: undefined,
                      }),
                    });
                  }}
                  className="text-[10px] text-[#64748B] hover:text-cyan-400 font-bold uppercase transition"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {YEARS_LIST.map((y) => {
                const selectedList = years ? years.split(",") : [];
                const isSelected = selectedList.includes(String(y));
                return (
                  <button
                    key={y}
                    onClick={() => handleToggleYear(String(y))}
                    className={`py-1.5 rounded-lg border text-[11px] font-semibold text-center transition cursor-pointer select-none ${
                      isSelected
                        ? "bg-[#06B6D4]/20 border-[#06B6D4] text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                        : "bg-[#111827]/50 border-[rgba(14,165,233,0.15)] text-[#64748B] hover:text-[#F1F5F9]"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Clear All Drawer Footer */}
        {(genres || years || search || category || platform || type) && (
          <button
            onClick={() => {
              handleResetAll();
              setIsFilterOpen(false);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-cyan-400/20 border border-cyan-500/30 text-cyan-400 hover:text-white hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition duration-200 text-xs font-bold uppercase tracking-wider text-center mt-6 cursor-pointer"
          >
            Reset All Filters
          </button>
        )}
      </div>

    </SiteShell>
  );
}


/* ---------------- Continue Watching (localStorage-backed) ---------------- */
function ContinueWatchingRow({ entries, onRemove }: { entries: CWEntry[]; onRemove: (e: CWEntry) => void }) {
  return (
    <section className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <h2 className="text-xl md:text-2xl font-bold mb-4 text-[#F1F5F9]">▶ Continue Watching</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {entries.map((e) => {
          const pct = e.duration > 0 ? Math.min(100, Math.max(0, (e.position / e.duration) * 100)) : 0;
          return (
            <div key={`${e.id}:${e.ep ?? ""}`} className="relative shrink-0 w-[150px] sm:w-[180px] group">
              <a href={continueWatchingUrl(e)} className="block">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-[rgba(14,165,233,0.2)] bg-[#111827]">
                  <img
                    src={e.poster || titlePosterDataUrl(e.title)}
                    alt={e.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                    <span className="w-11 h-11 rounded-full bg-[#06B6D4]/90 flex items-center justify-center text-white">
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/20">
                    <div className="h-full bg-[#06B6D4]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#F1F5F9] line-clamp-2">
                  {e.title}
                  {e.ep != null ? ` · Episode ${e.ep}` : ""}
                </p>
              </a>
              <button
                type="button"
                aria-label="Remove from Continue Watching"
                title="Remove"
                onClick={() => onRemove(e)}
                className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/25 text-white hidden group-hover:flex items-center justify-center hover:bg-black/90"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
