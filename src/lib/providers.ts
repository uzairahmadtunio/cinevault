/* ------------------------------------------------------------------
 * Permanent provider player — third-party embed servers, defined in
 * ONE place so a future domain swap is a one-line edit per provider.
 * Landscape verified live 2026-11-16 (see
 * ~/workspace/research_notes/embed-providers-20261116/PROVIDERS.md):
 *
 *   Server 1 · VidLink  — TMDb-native, documented params incl.
 *              startAt (resume) + nextbutton. Cleanest embed; no
 *              sandbox (its docs specify plain iframe embedding).
 *   Server 2 · VidSrc   — vidsrc.to wrapper (playback on vidsrc.sh).
 *              The wrapper injects popunder scripts, BUT VidSrc's
 *              player refuses sandboxed embedding entirely ("This
 *              content can't be embedded in a sandboxed frame",
 *              verified live 2026-11-16) → embedded WITHOUT sandbox.
 *   Server 3 · 2Embed   — IMDb-canonical (TV path needs the IMDb id;
 *              bare TMDb numbers are also accepted per their docs).
 *              Ad scripts present → sandboxed.
 *   Server 4 · CineVault — our own bypass player (not an embed;
 *              handled by the watch page itself, never built here).
 *
 * None of these providers documents a progress/postMessage event API
 * in the checked report, so Continue Watching positions are only
 * ever READ (VidLink startAt) for provider servers, never written
 * from them — positions are recorded by the bypass player only.
 * ------------------------------------------------------------------ */

export type ProviderId = "vidlink" | "vidsrc" | "2embed" | "cinevault";

export type ProviderContext = {
  tmdbId?: number | null;
  imdbId?: string | null;
  isSeries: boolean;
  season: number;
  episode: number;
  /** Resume position in seconds (VidLink startAt only). */
  startAt?: number | null;
};

export type ProviderDef = {
  id: ProviderId;
  /** Canonical server number in the switcher (chain order). */
  serverNo: number;
  name: string;
  notes: string;
  /** Sandbox attribute for the iframe; null = no sandbox. */
  sandbox: string | null;
  /** Whether this provider can serve the given title at all. */
  available: (ctx: ProviderContext) => boolean;
  /** Embed URL, or null when unavailable for the title. */
  embedUrl: (ctx: ProviderContext) => string | null;
};

const SANDBOX_TOKENS = "allow-scripts allow-same-origin allow-forms allow-presentation";

const hasTmdb = (ctx: ProviderContext) => ctx.tmdbId != null && Number(ctx.tmdbId) > 0;
const hasImdb = (ctx: ProviderContext) => Boolean(ctx.imdbId && /^tt\d+$/.test(ctx.imdbId));

export const PROVIDERS: ProviderDef[] = [
  {
    id: "vidlink",
    serverNo: 1,
    name: "VidLink",
    notes: "TMDb-native; startAt resume + in-player next episode; plain iframe per its docs.",
    sandbox: null,
    available: (ctx) => hasTmdb(ctx),
    embedUrl: (ctx) => {
      if (!hasTmdb(ctx)) return null;
      if (ctx.isSeries) {
        const q = new URLSearchParams({
          autoplay: "true",
          nextbutton: "true",
          primaryColor: "06B6D4",
        });
        if (ctx.startAt && ctx.startAt > 0) q.set("startAt", String(Math.floor(ctx.startAt)));
        return `https://vidlink.pro/tv/${ctx.tmdbId}/${ctx.season}/${ctx.episode}?${q.toString()}`;
      }
      const q = new URLSearchParams({ autoplay: "true", primaryColor: "06B6D4" });
      if (ctx.startAt && ctx.startAt > 0) q.set("startAt", String(Math.floor(ctx.startAt)));
      return `https://vidlink.pro/movie/${ctx.tmdbId}?${q.toString()}`;
    },
  },
  {
    id: "vidsrc",
    serverNo: 2,
    name: "VidSrc",
    notes: "Deep catalog; .to wrapper carries popunder scripts, but the player rejects sandboxed frames outright — no sandbox (verified live 2026-11-16).",
    sandbox: null,
    available: (ctx) => hasTmdb(ctx) || hasImdb(ctx),
    embedUrl: (ctx) => {
      const id = hasTmdb(ctx) ? ctx.tmdbId : hasImdb(ctx) ? ctx.imdbId : null;
      if (id == null) return null;
      return ctx.isSeries
        ? `https://vidsrc.to/embed/tv/${id}/${ctx.season}/${ctx.episode}`
        : `https://vidsrc.to/embed/movie/${id}`;
    },
  },
  {
    id: "2embed",
    serverNo: 3,
    name: "2Embed",
    notes: "Multi-server aggregator; IMDb-canonical TV path, bare TMDb numbers accepted per docs — sandboxed.",
    sandbox: SANDBOX_TOKENS,
    available: (ctx) => hasImdb(ctx) || hasTmdb(ctx),
    embedUrl: (ctx) => {
      const id = hasImdb(ctx) ? ctx.imdbId : hasTmdb(ctx) ? ctx.tmdbId : null;
      if (id == null) return null;
      return ctx.isSeries
        ? `https://www.2embed.cc/embedtv/${id}&s=${ctx.season}&e=${ctx.episode}`
        : `https://www.2embed.cc/embed/${id}`;
    },
  },
  {
    id: "cinevault",
    serverNo: 4,
    name: "CineVault",
    notes: "Our own bypass player — full Continue Watching precision and the F1 fallback chain.",
    sandbox: null,
    available: () => true,
    embedUrl: () => null, // not an iframe provider; the watch page renders it natively
  },
];

export function providerDef(id: ProviderId): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
}

/** Provider servers (excluding CineVault) that can serve this title. */
export function availableProviders(ctx: ProviderContext): ProviderDef[] {
  return PROVIDERS.filter((p) => p.id !== "cinevault" && p.available(ctx));
}
