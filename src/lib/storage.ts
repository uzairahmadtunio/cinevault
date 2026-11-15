/* ------------------------------------------------------------------
 * localStorage persistence with quota self-defense.
 *
 * The catalog search index cache (cv_search_index_v1/v2) is ~2M
 * characters on its own. In a long-lived browser profile it can push
 * the origin close to its localStorage quota, at which point writes
 * for SMALL but precious user data (My List, Continue Watching)
 * start throwing QuotaExceededError. Previously those throws were
 * swallowed silently — the UI claimed "Added to My List" while
 * nothing was actually stored, and the entry was gone on next load.
 *
 * persistLocal() therefore: tries the write; on failure it evicts
 * the (purely cached, re-fetchable) search index and retries once;
 * and it REPORTS whether the value is actually stored, so callers
 * can be honest in the UI instead of faking success.
 * ------------------------------------------------------------------ */

const EVICTABLE_KEYS = ["cv_search_index_v1", "cv_search_index_v2"];

export function persistLocal(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    /* fall through to eviction + retry */
  }
  for (const k of EVICTABLE_KEYS) {
    if (k === key) continue;
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
