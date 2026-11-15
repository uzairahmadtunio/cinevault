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

/* ---------------- Duplicate rows / playable-variant ranking (F3) ----
 * The catalog contains duplicate rows for the same title (e.g. a junk
 * "Links coming soon" row next to a fully-linked one). Journeys should
 * prefer the variant that can actually play. */

const SEASON_MARKER = /^(season|seasons|episode|episodes)$/;
const SEASON_CODE = /^s\d{1,2}$/;
const EP_CODE = /^ep\d+$/;
const ARTICLES = new Set(["the", "a", "an"]);

/** Grouping key for duplicate rows of the same title. Beyond plain
 *  normalization, the token stream is truncated at the first
 *  season/episode-pack marker ("season", "s02", "ep09", "episode"):
 *  scraped variants of one show differ exactly in those suffixes —
 *  "MobLand (Season 1)", "MobLand (Season 1 – 2) … (S02 EP09 Added)",
 *  "MobLand (Season 2)" — and must land on ONE key ("mobland") so
 *  dedupe/variant resolution can group them. Guards: a marker in
 *  first position never truncates ("Season of the Witch"), and at
 *  least one non-article token must survive the cut. */
export function titleKey(raw?: string | null): string {
  if (!raw) return "";
  const norm = String(raw)
    .toLowerCase()
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!norm) return "";
  const tokens = norm.split(" ");
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (SEASON_MARKER.test(t) || SEASON_CODE.test(t) || EP_CODE.test(t)) {
      const head = tokens.slice(0, i);
      if (head.some((h) => !ARTICLES.has(h))) return head.join(" ");
    }
  }
  return norm;
}

/** How much of this row can actually play: valid top-level quality links
 *  plus episodes that carry at least one valid link. Junk "coming soon"
 *  episode shells score 0. */
export function playableLinkCount(movie?: Partial<Movie> | null): number {
  if (!movie) return 0;
  let n = validQualities(movie).length;
  for (const ep of parseEpisodes(movie)) {
    if (episodeBestLink(ep)) n += 1;
  }
  return n;
}

/** The best same-title variant: most playable links wins; ties keep the
 *  earliest row (stable). */
export function bestVariant<T extends Partial<Movie>>(rows: T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const r of rows) {
    const s = playableLinkCount(r);
    if (s > bestScore) {
      best = r;
      bestScore = s;
    }
  }
  return best;
}

/** Collapse same-title duplicates in a list, keeping the most playable
 *  variant at the position of its first occurrence. */
export function dedupeByTitle<T extends Partial<Movie>>(rows: T[]): T[] {
  const order: string[] = [];
  const byKey = new Map<string, T>();
  for (const r of rows) {
    const key = titleKey(r.title) || String(r.id);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, r);
      order.push(key);
    } else if (playableLinkCount(r) > playableLinkCount(existing)) {
      byKey.set(key, r);
    }
  }
  return order.map((k) => byKey.get(k)!);
}

/* ---------------- Standardised metadata line ------------------------
 * Netflix's confirmed order (delta report, implication #9):
 * Genre · Year · Runtime/Seasons · Rating · Quality.              */

export function metaGenres(movie?: Partial<Movie> | null): string[] {
  if (!movie?.genre) return [];
  return movie.genre
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The runtime slot of the metadata line: a movie's duration, or for a
 *  series its episode count / season label when no duration is stored. */
export function runtimeLabel(movie?: Partial<Movie> | null): string | null {
  if (!movie) return null;
  if (movie.type === "series") {
    if (movie.total_episodes && movie.total_episodes > 0) {
      return `${movie.total_episodes} Episode${movie.total_episodes === 1 ? "" : "s"}`;
    }
    if (movie.season_number) return `Season ${movie.season_number}`;
  }
  return movie.duration || null;
}

/* ---------------- "At a Glance" chips -------------------------------
 * Netflix's icon-chip cluster (delta report NEW #1 / implication #3),
 * restricted to facts our own data can back: recency from created_at,
 * a new-season entry, and today's Top 10 rank. No awards, no leaving
 * dates — we have no data for those, so those chips never appear. */

export type GlanceChip = { key: string; label: string };

export function isRecentlyAdded(movie?: Partial<Movie> | null, days = 14): boolean {
  const raw = movie?.created_at;
  if (!raw) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= days * 24 * 3600 * 1000 && t <= Date.now() + 3600 * 1000;
}

export function glanceChips(
  movie?: Partial<Movie> | null,
  top10Rank?: number | null,
): GlanceChip[] {
  if (!movie) return [];
  const chips: GlanceChip[] = [];
  if (top10Rank != null && top10Rank >= 1 && top10Rank <= 10) {
    chips.push({ key: "top10", label: `#${top10Rank} in Top 10 Today` });
  }
  if (movie.type === "series" && (movie.season_number ?? 0) >= 2 && isRecentlyAdded(movie, 45)) {
    chips.push({ key: "new-season", label: "New Season" });
  }
  if (isRecentlyAdded(movie, 14)) {
    chips.push({ key: "recent", label: "Recently Added" });
  }
  return chips;
}
