import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    "Missing Supabase public environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

export const publicClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

export const ADMIN_EMAIL =
  import.meta.env.VITE_SUPABASE_ADMIN_EMAIL ?? import.meta.env.SUPABASE_ADMIN_EMAIL ?? "";

export type Movie = {
  id: string;
  title: string;
  year: number | null;
  language: string | null;
  quality: string | null;
  format: string | null;
  imdb_rating: number | null;
  description: string | null;
  thumbnail: string | null;
  banner: string | null;
  category: string | null;
  platform: string | null;
  link_480p: string | null;
  link_720p: string | null;
  link_1080p: string | null;
  link_4k: string | null;
  is_trending: boolean | null;
  is_featured: boolean | null;
  created_at: string | null;
  screenshot_1?: string | null;
  screenshot_2?: string | null;
  screenshot_3?: string | null;
  screenshot_4?: string | null;
  screenshot_5?: string | null;
  screenshot_6?: string | null;
  screenshot_7?: string | null;
  screenshot_8?: string | null;
  screenshot_9?: string | null;
  screenshot_10?: string | null;
  screenshots?: string[] | null;
  type?: string | null; // "movie" | "series"
  season_number?: number | null;
  total_episodes?: number | null;
  episode_links?: EpisodeLink[] | null;
  genre?: string | null;
  duration?: string | null;
  file_size?: string | null;
  director?: string | null;
  cast_names?: string | null;
};

export type EpisodeLink = {
  episode: number;
  title?: string;
  link_480p?: string;
  link_720p?: string;
  link_1080p?: string;
};

/** Clean a noisy release-name title: drop everything after the first `[` or `(`,
 *  but preserve a 4-digit year in parentheses like "Title (2026)". */
export function cleanTitle(raw?: string | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  const yearMatch = s.match(/\((19|20)\d{2}\)/);
  const cutAt = s.search(/[\[(]/);
  const base = (cutAt === -1 ? s : s.slice(0, cutAt)).trim().replace(/[-–—:|]+$/, "").trim();
  return yearMatch ? `${base} ${yearMatch[0]}` : base;
}

export const FALLBACK_MOVIES: Partial<Movie>[] = [
  { id: "1", title: "FROM Season 4", year: 2026, quality: "4K", format: "WEB-DL", language: "Dual Audio", imdb_rating: 7.8, category: "Hollywood", thumbnail: "https://picsum.photos/seed/cv1/200/300" },
  { id: "2", title: "Governor", year: 2026, quality: "CAM", format: "HDTC", language: "Hindi", imdb_rating: 6.2, category: "Bollywood", thumbnail: "https://picsum.photos/seed/cv2/200/300" },
  { id: "3", title: "Bharat Bhhagya Viddhaata", year: 2026, quality: "CAM", format: "HDTC", language: "Hindi", imdb_rating: 5.9, category: "Bollywood", thumbnail: "https://picsum.photos/seed/cv3/200/300" },
  { id: "4", title: "Peddi", year: 2026, quality: "CAM", format: "HDTC", language: "Multi Audio", imdb_rating: 7.1, category: "South Indian", thumbnail: "https://picsum.photos/seed/cv4/200/300" },
  { id: "5", title: "Obsession", year: 2026, quality: "CAM", format: "HDTC", language: "English", imdb_rating: 6.5, category: "Hollywood", thumbnail: "https://picsum.photos/seed/cv5/200/300" },
  { id: "6", title: "Bluff Master", year: 2018, quality: "FHD", format: "WEB-DL", language: "Hindi+Telugu", imdb_rating: 7.3, category: "South Indian", thumbnail: "https://picsum.photos/seed/cv6/200/300" },
  { id: "7", title: "Boat", year: 2024, quality: "HD", format: "WEB-DL", language: "Hindi+Tamil", imdb_rating: 6.8, category: "South Indian", thumbnail: "https://picsum.photos/seed/cv7/200/300" },
  { id: "8", title: "Click Ceremony", year: 2026, quality: "FHD", format: "WEB-DL", language: "Hindi", imdb_rating: 7.0, category: "Bollywood", thumbnail: "https://picsum.photos/seed/cv8/200/300" },
  { id: "9", title: "Viral Hit S1", year: 2026, quality: "FHD", format: "WEB-DL", language: "Hindi-Japanese", imdb_rating: 8.1, platform: "Netflix", thumbnail: "https://picsum.photos/seed/cv9/200/300" },
  { id: "10", title: "Bhooth Bangla", year: 2026, quality: "4K", format: "WEB-DL", language: "Hindi", imdb_rating: 7.6, platform: "Netflix", thumbnail: "https://picsum.photos/seed/cv10/200/300" },
  { id: "11", title: "Haunted 3D", year: 2011, quality: "BluRay", format: "BluRay", language: "Hindi", imdb_rating: 5.5, category: "Bollywood", thumbnail: "https://picsum.photos/seed/cv11/200/300" },
  { id: "12", title: "Pongala", year: 2025, quality: "FHD", format: "WEB-DL", language: "Malayalam", imdb_rating: 7.2, category: "South Indian", thumbnail: "https://picsum.photos/seed/cv12/200/300" },
];

export const FEATURED_FALLBACK: Partial<Movie>[] = [
  { id: "101", title: "Dhurandhar", year: 2026, language: "Hindi", quality: "HDTC", format: "HDTC", description: "As rival gangs close in, Hamza's mission spirals into a bloody war.", banner: "https://picsum.photos/seed/hero1/1200/500" },
  { id: "102", title: "Bhooth Bangla", year: 2026, language: "Hindi", quality: "4K", format: "WEB-DL", description: "A supernatural comedy in a haunted mansion.", banner: "https://picsum.photos/seed/hero2/1200/500" },
  { id: "103", title: "FROM Season 4", year: 2026, language: "Dual Audio", quality: "4K", format: "WEB-DL", description: "Residents of Fromville uncover terrifying new mysteries.", banner: "https://picsum.photos/seed/hero3/1200/500" },
  { id: "104", title: "Obsession", year: 2026, language: "English", quality: "HDTC", format: "HDTC", description: "Some desires come at a sinister price.", banner: "https://picsum.photos/seed/hero4/1200/500" },
  { id: "105", title: "Peddi", year: 2026, language: "Multi Audio", quality: "HDTC", format: "HDTC", description: "A villager unites his community through sports.", banner: "https://picsum.photos/seed/hero5/1200/500" },
];

export function qualityColor(q?: string | null) {
  switch ((q || "").toUpperCase()) {
    case "4K": return "#0EA5E9";
    case "FHD": return "#059669";
    case "HD": return "#2563EB";
    case "CAM": return "#DC2626";
    case "BLURAY": return "#0891B2";
    case "WEB-DL": return "#0EA5E9";
    default: return "#0EA5E9";
  }
}
