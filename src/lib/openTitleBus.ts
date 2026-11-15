/* ------------------------------------------------------------------
 * Open-title bus (F2): the Search Overlay lives in SiteShell, outside
 * the Home component that owns the Stream Mode detail modal. When a
 * search result is clicked in Stream Mode, the overlay asks this bus
 * to open the modal: if Home is mounted it handles the request
 * immediately; otherwise the id stays pending and Home consumes it
 * on mount (the overlay navigates home in that case).
 * ------------------------------------------------------------------ */

let handler: ((id: string) => void) | null = null;
let pending: string | null = null;

/** Returns true when a mounted handler consumed the request. */
export function requestOpenTitle(id: string): boolean {
  if (handler) {
    handler(id);
    return true;
  }
  pending = id;
  return false;
}

export function registerOpenTitleHandler(fn: (id: string) => void): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function consumePendingOpenTitle(): string | null {
  const p = pending;
  pending = null;
  return p;
}
