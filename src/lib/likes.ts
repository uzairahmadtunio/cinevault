/* ------------------------------------------------------------------
 * Likes — the hover card's thumbs button (delta report implication
 * #4: the confirmed Netflix anatomy is ▶ · +/✓ · thumbs · ⌄). A
 * purely local, per-device store like My List — it records only the
 * viewer's own rating, never a fabricated score.
 * ------------------------------------------------------------------ */

const KEY = "cv_likes";
export const LIKES_EVENT = "cv-likes-changed";

export function loadLikes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

export function isLiked(id: string | number): boolean {
  return loadLikes().has(String(id));
}

export function toggleLike(id: string | number): boolean {
  const set = loadLikes();
  const sid = String(id);
  const now = !set.has(sid);
  if (now) set.add(sid);
  else set.delete(sid);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* storage blocked — like becomes session-only */
  }
  try {
    window.dispatchEvent(new Event(LIKES_EVENT));
  } catch {
    /* noop */
  }
  return now;
}

export function subscribeLikes(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LIKES_EVENT, fn);
  return () => window.removeEventListener(LIKES_EVENT, fn);
}
