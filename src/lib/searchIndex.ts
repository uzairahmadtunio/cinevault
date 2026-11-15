import { fetchSearchIndex } from "@/lib/api/server.movies";
import { cleanTitle } from "@/lib/supabase";

/* ------------------------------------------------------------------
 * Lightweight, typo-tolerant search over the catalog.
 * The full title index is fetched ONCE (a single server call), cached in
 * memory + localStorage for 24h, and all matching happens locally —
 * no per-keystroke network calls and no external dependencies.
 * ------------------------------------------------------------------ */

export type SearchIndexItem = {
  id: string;
  title: string; // raw stored title
  display: string; // cleaned title shown to users
  thumbnail: string | null;
  year: number | null;
  tmdbId: number | null;
  /** Duplicate-grouping key: one search entry per real-world title.
   *  TMDb id when the row has one (post-backfill), otherwise the
   *  normalized display title — scraped season/pack variants of one
   *  show ("MobLand (Season 1)", "MobLand (Season 1 – 2) …") all
   *  clean to the same display and so share a group. */
  group: string;
  norm: string; // normalized title for matching
  tokens: string[];
};

const CACHE_KEY = "cv_search_index_v2";
const TTL_MS = 24 * 3600 * 1000;

let memoryCache: SearchIndexItem[] | null = null;
let inflight: Promise<SearchIndexItem[]> | null = null;

export function normalizeForSearch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type RawIndexRow = {
  id: string;
  title: string;
  thumbnail: string | null;
  year: number | null;
  tmdbId?: number | null;
};

function prepare(rows: RawIndexRow[]): SearchIndexItem[] {
  return rows
    .filter((r) => r && r.title)
    .map((r) => {
      const cleaned = cleanTitle(r.title) || r.title;
      // Some stored titles carry leading junk glyphs (e.g. a mis-decoded
      // "" at the start) that cleanTitle leaves in place — strip leading
      // non-alphanumeric characters from the DISPLAY title so suggestion
      // rows never show the stray glyph. Matching is unaffected (the
      // normalizer drops those characters anyway).
      const display = cleaned.replace(/^[^\p{L}\p{N}]+/u, "").trim() || cleaned;
      const norm = normalizeForSearch(display);
      const tmdbId = r.tmdbId != null && Number(r.tmdbId) > 0 ? Number(r.tmdbId) : null;
      return {
        id: String(r.id),
        title: r.title,
        display,
        thumbnail: r.thumbnail ?? null,
        year: r.year ?? null,
        tmdbId,
        group: tmdbId ? `t:${tmdbId}` : `n:${norm}`,
        norm,
        tokens: norm ? norm.split(" ") : [],
      };
    });
}

export async function getSearchIndex(): Promise<SearchIndexItem[]> {
  if (memoryCache) return memoryCache;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length && Date.now() - Number(parsed.at || 0) < TTL_MS) {
        memoryCache = prepare(parsed.items);
        return memoryCache;
      }
    }
  } catch {
    /* fall through to a fresh fetch */
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetchSearchIndex({ data: {} });
        const items = (res?.items as RawIndexRow[]) || [];
        if (items.length) {
          memoryCache = prepare(items);
          try {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
          } catch {
            /* cache is best-effort */
          }
          return memoryCache;
        }
        return [];
      } catch {
        return [];
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/* Bounded Levenshtein distance: returns maxDist + 1 as soon as the distance
 * provably exceeds maxDist, so typo checks stay cheap. */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export type FuzzyHit = { item: SearchIndexItem; score: number };

/** Score one query token against one title token.
 *  Round-1 scoring let 1-letter title tokens ("m" from "I'm", "a", "s") match
 *  ANY query token by prefix for 6 points — more than a genuine 1-typo match
 *  (5) — so junk titles crowded real typo matches (e.g. "Moblnd") out of the
 *  results entirely. Rules now: prefix games need tokens of length >= 3, and
 *  a 1-edit typo of a real token is the strongest fuzzy signal. */
function tokenScore(qt: string, tt: string): number {
  if (tt === qt) return 12;
  if (qt.length >= 3 && tt.length >= 3) {
    if (tt.startsWith(qt)) return 8; // user is still typing the word
    if (tt.includes(qt)) return 5;
  }
  if (qt.length >= 4 && tt.length >= 4 && qt.startsWith(tt)) return 5;
  const maxD = qt.length >= 5 ? 2 : 1;
  if (Math.abs(tt.length - qt.length) <= maxD) {
    const d = levenshtein(qt, tt, maxD);
    if (d === 1) return 9; // single typo — e.g. "moblnd" vs "mobland"
    if (d === 2) return 5;
  }
  return 0;
}

/** How complete a scraped pack looks from its raw title alone. The
 *  search index carries no link data, so when several duplicate rows
 *  tie on match score this picks the representative most likely to be
 *  the full, playable variant ("Season 1 – 2" pack > single-season
 *  row; a row still receiving episode updates > a stale shell). The
 *  detail modal re-resolves to the truly most playable variant from
 *  full row data when opened, so this only picks the face of the
 *  group in result lists. */
function packScore(item: SearchIndexItem): number {
  const t = item.title.toLowerCase();
  let s = 0;
  if (/season\s*1\s*[–—-]\s*\d/.test(t)) s += 4; // "Season 1 – 2" style pack
  if (/\bcomplete\b/.test(t)) s += 2;
  const ep = t.match(/ep\s*(\d+)\s*added/);
  if (ep) s += Math.min(3, parseInt(ep[1], 10) / 25);
  return s;
}

/** Typo-tolerant matching: exact/prefix/substring token matches score high;
 *  tokens within Levenshtein distance 1–2 still match, so "Moblnd" finds
 *  "MobLand" and "Avengrs" finds "Avengers".
 *
 *  Results are collapsed to ONE hit per duplicate group (same TMDb id,
 *  or same cleaned display title): the catalog holds several scraped
 *  rows for one show and showing five identical "MobLand" cards —
 *  most of them junk shells — helps no one. */
export function fuzzyFind(index: SearchIndexItem[], query: string, limit = 8): FuzzyHit[] {
  const q = normalizeForSearch(query);
  if (!q || !index.length) return [];
  const qTokens = q.split(" ");
  const hits: FuzzyHit[] = [];

  for (const item of index) {
    if (!item.norm) continue;
    let score = 0;
    if (item.norm === q) score += 100;
    else if (item.norm.startsWith(q)) score += 60;
    else if (item.norm.includes(q)) score += 40;

    let allTokensMatched = true;
    for (const qt of qTokens) {
      let best = 0;
      for (const tt of item.tokens) {
        const s = tokenScore(qt, tt);
        if (s > best) best = s;
        if (best === 12) break;
      }
      if (best === 0) {
        allTokensMatched = false;
        break;
      }
      score += best;
    }
    if (!allTokensMatched && score < 40) continue;
    if (score > 0) hits.push({ item, score });
  }

  // Collapse duplicate groups: keep each group's best representative
  // (match score, then pack completeness, then newest row id).
  const groups = new Map<string, FuzzyHit>();
  for (const hit of hits) {
    const key = hit.item.group || `n:${hit.item.norm}`;
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, hit);
      continue;
    }
    const better =
      hit.score > cur.score ||
      (hit.score === cur.score &&
        (packScore(hit.item) > packScore(cur.item) ||
          (packScore(hit.item) === packScore(cur.item) &&
            Number(hit.item.id) > Number(cur.item.id))));
    if (better) groups.set(key, hit);
  }
  const deduped = [...groups.values()];
  deduped.sort((a, b) => b.score - a.score || (b.item.year || 0) - (a.item.year || 0));
  return deduped.slice(0, limit);
}
