import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, AlertCircle } from "lucide-react";
import { SiteShell, cleanTitle, titlePosterDataUrl, showToast, type Movie } from "@/components/cinevault";
import { fetchMovieById } from "@/lib/api/server.movies";
import { getBypassedUrl } from "@/utils/linkBypasser";

export const Route = createFileRoute("/download/$movieId/$quality")({
  component: DownloadPage,
});

const SIZE_EST: Record<string, string> = {
  "480p": "~400-700 MB",
  "720p": "~1-1.5 GB",
  "1080p": "~2-4 GB",
  "4k": "~6-15 GB",
  "4K": "~6-15 GB",
};

function DownloadPage() {
  const { movieId, quality } = Route.useParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMovieById({ data: { id: movieId } });
        setMovie(res?.movie || null);
      } catch (err) {
        console.error("Failed to fetch movie", err);
        setMovie(null);
      }
      setLoading(false);
    })();
  }, [movieId]);

  const getDownloadLink = (): string | null => {
    if (!movie) return null;
    const qualityMap: Record<string, keyof Movie> = {
      "480p": "link_480p",
      "720p": "link_720p",
      "1080p": "link_1080p",
      "4k": "link_4k",
      "4K": "link_4k",
    };
    const linkKey = qualityMap[quality];
    return linkKey && movie[linkKey] ? (movie[linkKey] as string) : null;
  };

  const getQualityBadgeColor = (q: string): string => {
    switch (q.toUpperCase()) {
      case "480P":
        return "bg-gray-600";
      case "720P":
        return "bg-blue-600";
      case "1080P":
        return "bg-green-600";
      case "4K":
        return "bg-cyan-500";
      default:
        return "bg-gray-600";
    }
  };

  const handleGenerateLink = () => {
    const link = getDownloadLink();
    if (link) {
      setDownloading(true);
      setTimeout(() => {
        const bypassed = getBypassedUrl(link);
        window.open(bypassed, "_blank", "noopener");
        setDownloading(false);
        showToast(`Download started for ${quality} quality!`);
      }, 300);
    } else {
      showToast(`No download link available for ${quality}`);
    }
  };

  // Sanitize title for filename
  const sanitizeFilename = (title: string): string => {
    return title
      .replace(/\s+/g, ".")
      .replace(/[^\w.-]/g, "")
      .slice(0, 100);
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p className="text-[#64748B]">Loading movie details...</p>
          </div>
        </div>
      </SiteShell>
    );
  }

  if (!movie) {
    return (
      <SiteShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#F1F5F9] mb-2">Movie Not Found</h1>
            <p className="text-[#64748B] mb-6">The movie you're looking for doesn't exist.</p>
            <Link to="/" search={{}} className="inline-flex items-center gap-2 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition">
              ← Back to Home
            </Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  const downloadLink = getDownloadLink();

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#0b0f19] py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {/* BACK NAVIGATION */}
          <div className="mb-8">
            <Link to="/movie/$id" params={{ id: movieId }} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition">
              ← Back to movie
            </Link>
          </div>

          {/* HEADER INFO CARD */}
          <div className="mb-8 p-6 rounded-lg border border-gray-600 bg-[#0D1321]">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Poster */}
              <div className="flex-shrink-0 w-full md:w-48">
                <img
                  src={movie.thumbnail || titlePosterDataUrl(movie.title)}
                  alt={cleanTitle(movie.title)}
                  className="w-full h-auto rounded-lg border border-cyan-500/30 object-cover aspect-[2/3]"
                />
              </div>

              {/* Movie Info */}
              <div className="flex-1 flex flex-col justify-center">
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#F1F5F9] mb-1">
                  {cleanTitle(movie.title)}
                </h1>
                <p className="text-[#CBD5E1] text-sm md:text-base mb-4">
                  {movie.year}
                </p>

                {/* Badge Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-md font-bold text-white text-sm ${getQualityBadgeColor(quality)}`}>
                    {quality.toUpperCase()}
                  </span>
                  {movie.format && (
                    <span className="px-3 py-1.5 rounded-md font-semibold text-[#F1F5F9] bg-gray-700 text-sm">
                      {movie.format}
                    </span>
                  )}
                  {movie.language && (
                    <span className="px-3 py-1.5 rounded-md font-semibold text-[#F1F5F9] bg-gray-700 text-sm">
                      {movie.language}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FILE INFORMATION CARD */}
          <div className="mb-10 p-6 rounded-lg border border-cyan-500 bg-[#131926]" style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.1)" }}>
            <h2 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
              <span className="text-xl">◆</span> FILE INFORMATION
            </h2>

            {/* Table Rows */}
            <div className="space-y-4">
              {/* Filename Row */}
              <div className="flex justify-between items-start py-3 border-b border-cyan-500/20">
                <span className="text-[#64748B] font-medium">Filename</span>
                <span className="text-[#F1F5F9] font-bold text-right break-all max-w-xs md:max-w-md">
                  {sanitizeFilename(movie.title)}.{quality}.WEB-DL.mkv
                </span>
              </div>

              {/* Quality Row */}
              <div className="flex justify-between items-center py-3 border-b border-cyan-500/20">
                <span className="text-[#64748B] font-medium">Quality</span>
                <span className="text-[#F1F5F9] font-bold">{quality.toUpperCase()}</span>
              </div>

              {/* Format Row */}
              <div className="flex justify-between items-center py-3 border-b border-cyan-500/20">
                <span className="text-[#64748B] font-medium">Format</span>
                <span className="text-[#F1F5F9] font-bold">MKV</span>
              </div>

              {/* Language Row */}
              <div className="flex justify-between items-center py-3 border-b border-cyan-500/20">
                <span className="text-[#64748B] font-medium">Language</span>
                <span className="text-[#F1F5F9] font-bold">{movie.language || "Not specified"}</span>
              </div>

              {/* Size Row */}
              <div className="flex justify-between items-center py-3">
                <span className="text-[#64748B] font-medium">Size</span>
                <span className="text-[#F1F5F9] font-bold">
                  {movie.file_size || SIZE_EST[quality] || "~1-2 GB"}
                </span>
              </div>
            </div>
          </div>

          {/* DOWNLOAD ACTION SECTION */}
          <div className="text-center">
            <button
              onClick={handleGenerateLink}
              disabled={!downloadLink || downloading}
              className={`
                inline-flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-lg text-white
                transition-all duration-300 transform hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${
                  downloadLink
                    ? "bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 shadow-lg"
                    : "bg-gray-600 cursor-not-allowed"
                }
              `}
              style={
                downloadLink
                  ? { boxShadow: "0 0 30px rgba(6, 182, 212, 0.4)" }
                  : undefined
              }
            >
              <Download size={24} />
              {downloading ? "Generating Link..." : "Generate Download Link"}
            </button>

            {/* Helper Text */}
            <p className="text-[#64748B] text-sm mt-4">
              Note: Use Chrome / IDM / ADM for better download experience
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

