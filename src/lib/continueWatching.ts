export type CWEntry = {
  id: string; // movie/series id (matches the movies table id, as a string)
  title: string;
  poster?: string;
  target: string; // the stream page's encoded `target` param, for rebuilding the player URL
  ep?: number; // episode number for series entries
  position: number; // seconds
  duration: number; // seconds
  updatedAt: number;
};

const STORAGE_KEY = "cv_continue_watching";
const MAX_ENTRIES = 12;

export function cwKey(id: string, ep?: number | null): string {
  return ep != null ? `${id}:ep${ep}` : String(id);
}

export function loadContinueWatching(): CWEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CWEntry[]) : [];
  } catch {
    return [];
  }
}

function store(list: CWEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full/unavailable — Continue Watching is best-effort */
  }
}

export function upsertContinueWatching(entry: CWEntry) {
  const key = cwKey(entry.id, entry.ep);
  const list = loadContinueWatching().filter((e) => cwKey(e.id, e.ep) !== key);
  list.unshift(entry);
  store(list);
}

export function removeContinueWatching(id: string, ep?: number | null) {
  const key = cwKey(id, ep);
  store(loadContinueWatching().filter((e) => cwKey(e.id, e.ep) !== key));
}

export function findContinueWatching(id: string, ep?: number | null): CWEntry | null {
  const key = cwKey(id, ep);
  return loadContinueWatching().find((e) => cwKey(e.id, e.ep) === key) || null;
}

/** Rebuild the player URL for a Continue Watching entry, resuming at t. */
export function continueWatchingUrl(e: CWEntry): string {
  const params = new URLSearchParams();
  params.set("target", e.target);
  params.set("mid", e.id);
  if (e.title) params.set("title", e.title);
  if (e.poster) params.set("poster", e.poster);
  if (e.ep != null) params.set("ep", String(e.ep));
  if (e.position > 0) params.set("t", String(Math.floor(e.position)));
  return `/download/stream?${params.toString()}`;
}
