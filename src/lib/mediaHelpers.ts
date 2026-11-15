import type { Movie } from "@/lib/supabase";
import { isValidStreamTarget } from "@/utils/linkBypasser";

/* ---------------- File size display ---------------- */

/** Clean a stored file_size for display: strips stray brackets the scraper
 *  captured with the value (e.g. "308.78 MB]" -> "308.78 MB"). */
export function cleanFileSize(raw?: string | null): string {
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/^[\[\s]+/, "")
    .replace(/[\]\[\s]+$/g, "")
    .trim();
}

/* ---------------- Ratings ---------------- */

/** Returns the rating to display, or null when there is no usable rating
 *  (missing, 0, or out of range) so the UI can hide the badge instead of
 *  showing a meaningless value. */
export function validRating(r?: number | null): number | null {
  if (r == null) return null;
  const n = Number(r);
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : null;
}

/* ---------------- Quality links ---------------- */

export const QUALITY_FIELDS = [
  { label: "480p", field: "link_480p" },
  { label: "720p", field: "link_720p" },
  { label: "1080p", field: "link_1080p" },
  { label: "4K", field: "link_4k" },
] as const;

export type QualityLink = { label: string; url: string };

/** Only the qualities whose stored link is a plausible file-host URL.
 *  Qualities with missing or junk links (e.g. a category path stored as the
 *  4K "link") are excluded so the UI never offers a dead end. */
export function validQualities(movie?: Partial<Movie> | null): QualityLink[] {
  if (!movie) return [];
  return QUALITY_FIELDS.filter((q) =>
    isValidStreamTarget((movie as Record<string, unknown>)[q.field] as string),
  ).map((q) => ({ label: q.label, url: (movie as Record<string, unknown>)[q.field] as string }));
}

/** Best playable quality for Watch Now: 720p preferred, then 1080p, 480p, 4K. */
export function pickBestQualityLink(movie?: Partial<Movie> | null): QualityLink | null {
  const vq = validQualities(movie);
  for (const pref of ["720p", "1080p", "480p", "4K"]) {
    const hit = vq.find((q) => q.label === pref);
    if (hit) return hit;
  }
  return null;
}

/* ---------------- Episodes ----------------
 * Scraped episode_links rows do not always use the same field names, and the
 * episode number field is often absent — which used to render literally as
 * "Episode undefined". These helpers read the data defensively. */

export type RawEpisode = Record<string, any>;

export function parseEpisodes(movie?: Partial<Movie> | null): RawEpisode[] {
  if (!movie) return [];
  const raw: unknown = (movie as Record<string, unknown>).episode_links;
  if (Array.isArray(raw)) return raw as RawEpisode[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RawEpisode[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function episodeNumber(ep: RawEpisode, index: number): number {
  const raw = ep?.episode ?? ep?.episode_number ?? ep?.ep_number ?? ep?.number ?? ep?.ep ?? null;
  const n = raw != null ? parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  // Last resort: pull the number out of a title like "Episode 3".
  const t = String(ep?.title ?? ep?.name ?? "");
  const m = t.match(/episode\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return index + 1;
}

/** Extra title text for an episode, or "" when the stored title is just
 *  "Episode N" (redundant next to the number we already render). */
export function episodeDisplayTitle(ep: RawEpisode): string {
  const t = String(ep?.title ?? ep?.name ?? "").trim();
  if (!t) return "";
  if (/^episode\s*\d+\s*$/i.test(t)) return "";
  return t;
}

/** Best valid link for one episode (720p preferred), or null. */
export function episodeBestLink(ep: RawEpisode): string | null {
  for (const f of ["link_720p", "link_1080p", "link_480p", "link_4k"]) {
    const u = ep?.[f];
    if (isValidStreamTarget(u)) return u as string;
  }
  return null;
}

/** The valid per-quality links of one episode, in display order. */
export function episodeQualityLinks(ep: RawEpisode): QualityLink[] {
  return QUALITY_FIELDS.filter((q) => isValidStreamTarget(ep?.[q.field])).map((q) => ({
    label: q.label,
    url: ep[q.field] as string,
  }));
}
