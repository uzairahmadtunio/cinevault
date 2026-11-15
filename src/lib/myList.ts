/* ------------------------------------------------------------------
 * My List — Netflix-style personal list, stored entirely client-side
 * in localStorage (no accounts). Snapshots keep just enough to render
 * a card offline (poster/backdrop/title/year); full rows are hydrated
 * on demand through fetchMoviesByIds.
 * ------------------------------------------------------------------ */

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

function save(list: MyListItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full/blocked — list becomes session-only */
  }
  try {
    window.dispatchEvent(new Event(MY_LIST_EVENT));
  } catch {
    /* noop */
  }
}

/** Toggle a title in My List. Returns true when it is in the list afterwards. */
export function toggleMyList(item: {
  id: string | number;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  year?: number | null;
}): boolean {
  const list = loadMyList();
  const sid = String(item.id);
  const idx = list.findIndex((x) => String(x.id) === sid);
  if (idx >= 0) {
    list.splice(idx, 1);
    save(list);
    return false;
  }
  list.unshift({
    id: sid,
    title: item.title,
    poster: item.poster ?? null,
    backdrop: item.backdrop ?? null,
    year: item.year ?? null,
    addedAt: Date.now(),
  });
  save(list.slice(0, 200));
  return true;
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
