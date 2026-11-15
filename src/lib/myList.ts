/* ------------------------------------------------------------------
 * My List — Netflix-style personal list, stored entirely client-side
 * in localStorage (no accounts). Snapshots keep just enough to render
 * a card offline (poster/backdrop/title/year); full rows are hydrated
 * on demand through fetchMoviesByIds.
 * ------------------------------------------------------------------ */

import { persistLocal } from "./storage";

export type MyListItem = {
  id: string;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: number | null;
  addedAt: number;
};

const KEY = "cv_my_list";
export const MY_LIST_EVENT = "cv-my-list-changed";

export function loadMyList(): MyListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && x.id != null && x.title);
  } catch {
    return [];
  }
}

export function isInMyList(id: string | number): boolean {
  const sid = String(id);
  return loadMyList().some((x) => String(x.id) === sid);
}

/** Persist the list. Returns whether the value is actually stored —
 *  on quota pressure persistLocal evicts the search-index cache and
 *  retries, but a full/blocked store can still fail, and callers must
 *  not claim success in that case. */
function save(list: MyListItem[]): boolean {
  const ok = persistLocal(KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new Event(MY_LIST_EVENT));
  } catch {
    /* noop */
  }
  return ok;
}

/** Toggle a title in My List.
 *  `inList` is the state afterwards AS STORED: when persistence fails
 *  (storage full/blocked even after cache eviction) an add reports
 *  { inList: false, persisted: false } so the UI never shows a ✓ for
 *  an entry that will not survive the next page load. */
export function toggleMyList(item: {
  id: string | number;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  year?: number | null;
}): { inList: boolean; persisted: boolean } {
  const list = loadMyList();
  const sid = String(item.id);
  const idx = list.findIndex((x) => String(x.id) === sid);
  if (idx >= 0) {
    list.splice(idx, 1);
    const persisted = save(list);
    return { inList: false, persisted };
  }
  list.unshift({
    id: sid,
    title: item.title,
    poster: item.poster ?? null,
    backdrop: item.backdrop ?? null,
    year: item.year ?? null,
    addedAt: Date.now(),
  });
  const persisted = save(list.slice(0, 200));
  return { inList: persisted, persisted };
}

export function removeFromMyList(id: string | number) {
  const sid = String(id);
  save(loadMyList().filter((x) => String(x.id) !== sid));
}

/** Subscribe to list changes (same-tab events + cross-tab storage events). */
export function subscribeMyList(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener(MY_LIST_EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MY_LIST_EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}
