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

/* ---------------- Playability-first host ranking ----------------
 * The catalog mixes source hosts. The bypass engine reliably extracts
 * mdrive-family pages (verified live), while direct hubcloud pages
 * frequently block extraction behind Cloudflare — so source selection
 * ranks PLAYABLE hosts first and quality second: a title with any
 * mdrive link plays from mdrive even at a lower quality, instead of
 * dead-ending on a blocked hubcloud link at a higher one. */
export function linkHostTier(url?: string | null): number {
  if (!url) return 0;
  let host = "";
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return 0;
  }
  if (host.includes("mdrive")) return 3; // verified playable today
  if (host.includes("hubcloud") || host.includes("hubcdn")) return 1; // known blocker
  return 2; // other hosts: generic extraction may work
}

const QUALITY_PREF = ["720p", "1080p", "480p", "4K"];

/** Sort quality links playable-host first, then by quality preference
 *  (720p → 1080p → 480p → 4K, the site's long-standing order). */
export function rankQualityLinks(links: QualityLink[]): QualityLink[] {
  return [...links].sort((a, b) => {
    const tierDiff = linkHostTier(b.url) - linkHostTier(a.url);
    if (tierDiff !== 0) return tierDiff;
    return QUALITY_PREF.indexOf(a.label) - QUALITY_PREF.indexOf(b.label);
  });
}

/** Best playable link for Watch Now: playable host first, then quality
 *  (720p preferred, then 1080p, 480p, 4K). */
export function pickBestQualityLink(movie?: Partial<Movie> | null): QualityLink | null {
  const ranked = rankQualityLinks(validQualities(movie));
  return ranked.length ? ranked[0] : null;
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

/** Best valid link for one episode: playable host first, then quality
 *  (720p preferred), or null. */
export function episodeBestLink(ep: RawEpisode): string | null {
  const links = episodeQualityLinks(ep);
  return links.length ? links[0].url : null;
}

/** The stream a catalog card should open in Stream Mode: the title's best
 *  top-level quality link; for series whose links live only inside episodes,
 *  the first episode with a playable link (with its episode number). */
export function pickCardStream(
  movie?: Partial<Movie> | null,
): { url: string; ep: number | null } | null {
  const top = pickBestQualityLink(movie);
  if (top) return { url: top.url, ep: null };
  const episodes = parseEpisodes(movie);
  for (let i = 0; i < episodes.length; i++) {
    const url = episodeBestLink(episodes[i]);
    if (url) return { url, ep: episodeNumber(episodes[i], i) };
  }
  return null;
}

/** The valid per-quality links of one episode, ranked playable-host
 *  first, then by quality preference. */
export function episodeQualityLinks(ep: RawEpisode): QualityLink[] {
  return rankQualityLinks(
    QUALITY_FIELDS.filter((q) => isValidStreamTarget(ep?.[q.field])).map((q) => ({
      label: q.label,
      url: ep[q.field] as string,
    })),
  );
}

/** Alternate source candidates for the player's fallback chain: every
 *  other valid link for the same title (and episode, for series),
 *  ranked playable-host first, excluding the URL already tried. */
export function alternateStreamCandidates(
  movie: Partial<Movie> | null | undefined,
  ep: number | null | undefined,
  excludeUrl: string,
  max = 4,
): string[] {
  if (!movie) return [];
  const seen = new Set<string>([excludeUrl]);
  const out: string[] = [];
  const push = (url?: string | null) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  if (ep != null) {
    const episodes = parseEpisodes(movie);
    const idx = episodes.findIndex((e, i) => episodeNumber(e, i) === ep);
    if (idx >= 0) {
      for (const q of episodeQualityLinks(episodes[idx])) push(q.url);
    }
  }
  for (const q of rankQualityLinks(validQualities(movie))) push(q.url);
  return out.slice(0, max);
}
