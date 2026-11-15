import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Download, ShieldCheck, Copy, AlertCircle, Home, Play, Info, Check, RefreshCw, Settings, Captions, SkipForward, ListVideo, X, ArrowLeft } from "lucide-react";
import { QualityBadge, SiteShell, showToast, cleanTitle, titlePosterDataUrl, type Movie } from "@/components/cinevault";
import { buildStreamUrl, decodeUrl, clientSideExtract, isValidStreamTarget } from "@/utils/linkBypasser";
import { extractDirectLink, fetchMovieById, fetchMoviesPaginated, fetchTrendingOrTopRated } from "@/lib/api/server.movies";
import { alternateStreamCandidates, cleanFileSize, episodeBestLink, episodeDisplayTitle, episodeNumber, metaGenres, parseEpisodes, pickCardStream, runtimeLabel, validQualities, validRating, type RawEpisode } from "@/lib/mediaHelpers";
import { useSiteMode } from "@/lib/siteMode";
import { MyListButton } from "@/components/stream/MyListButton";
import { GlanceChips } from "@/components/stream/GlanceChips";
import { Top10Ribbon } from "@/components/stream/Top10Context";
import { PROVIDERS, availableProviders, providerDef, type ProviderContext, type ProviderId } from "@/lib/providers";
import { findContinueWatching, removeContinueWatching, upsertContinueWatching } from "@/lib/continueWatching";

export const Route = createFileRoute("/download/stream")({
  validateSearch: (search: Record<string, any>) => ({
    target: search.target as string | undefined,
    // Optional metadata used for Continue Watching + Next Episode.
    mid: search.mid != null && search.mid !== "" ? String(search.mid) : undefined,
    title: search.title as string | undefined,
    poster: search.poster as string | undefined,
    ep: search.ep != null && search.ep !== "" && !Number.isNaN(Number(search.ep)) ? Number(search.ep) : undefined,
    t: search.t != null && search.t !== "" && !Number.isNaN(Number(search.t)) ? Number(search.t) : undefined,
  }),
  component: DownloadStreamPage,
});

type StreamQuality = {
  quality: string;
  url: string;
};

type SubtitleTrack = {
  label: string;
  src: string;
};

/* More Like This card for the watch page: in Stream Mode it plays the
 * title (best playable source); in Download Mode it opens the detail page. */
function WatchRelatedCard({ movie, top10Rank }: { movie: Movie; top10Rank?: number | null }) {
  const { mode } = useSiteMode();
  const display = cleanTitle(movie.title) || movie.title;
  const stream = pickCardStream(movie);
  const rating = validRating(movie.imdb_rating);
  const open = () => {
    if (mode === "stream" && stream) {
      window.location.assign(
        buildStreamUrl(stream.url, {
          id: movie.id,
          title: display,
          poster: movie.thumbnail,
          ep: stream.ep,
        }),
      );
    } else {
      window.location.assign(`/movie/${movie.id}`);
    }
  };
  return (
    <div className="w-[210px] flex-none cursor-pointer sm:w-[240px]" onClick={open}>
      <div className="relative overflow-hidden rounded-md bg-[#181818]">
        <img
          src={movie.banner || movie.thumbnail || titlePosterDataUrl(display)}
          alt={display}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
        {movie.quality && (
          <div className="absolute left-1.5 top-1.5">
            <QualityBadge quality={movie.quality} size="sm" />
          </div>
        )}
        {top10Rank != null && <Top10Ribbon rank={top10Rank} />}
        {stream && (
          <span className="absolute bottom-1.5 left-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#06B6D4] text-white shadow-lg shadow-cyan-500/40">
            <Play size={14} fill="currentColor" />
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-2 pb-1.5 pt-6">
          <div className="line-clamp-1 text-[13px] font-semibold text-white drop-shadow">
            {display}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 px-0.5 text-xs text-slate-400">
        {movie.year != null && <span>{movie.year}</span>}
        {rating != null && <span className="font-bold text-amber-400">★ {rating.toFixed(1)}</span>}
        {movie.type === "series" && <span>Web Series</span>}
      </div>
    </div>
  );
}

function DownloadStreamPage() {
  const { target, mid, title, poster, ep, t } = Route.useSearch();
  const [decodedUrl, setDecodedUrl] = useState<string | null>(null);
  
  // Multi-quality & subtitle states
  const [streams, setStreams] = useState<StreamQuality[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [activeStream, setActiveStream] = useState<StreamQuality | null>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<string>("off"); // "off" or subtitle label
  
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [statusMessage, setStatusMessage] = useState("Initializing secure bypasser...");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  
  // The source URL that actually extracted (differs from the requested
  // target when the fallback chain rescued a blocked primary source).
  const [workingUrl, setWorkingUrl] = useState<string | null>(null);

  // Settings Panel Overlay state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedStream, setCopiedStream] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Decode target url on mount
  useEffect(() => {
    if (target) {
      try {
        const decoded = decodeUrl(target);
        setDecodedUrl(decoded);
      } catch (err) {
        console.error("Failed to decode target URL:", err);
        setExtractionError("Invalid or corrupted link target.");
      }
    } else {
      setDecodedUrl(null);
    }
  }, [target]);

  // Countdown and extraction pipeline
  useEffect(() => {
    if (!decodedUrl) return;
    // A stored link that is not an absolute file-host URL (e.g. a category
    // path) can never resolve to a stream — the error card handles it, and we
    // must not enter the bypass flow or build any gateway URL from it.
    if (!isValidStreamTarget(decodedUrl)) return;

    // A provider server (VidLink / VidSrc / 2Embed) is on screen — the
    // bypass pipeline stays idle until the viewer picks the CineVault
    // server, then this effect re-runs and extraction proceeds.
    if (providerActiveRef.current) return;

    if (secondsLeft > 0) {
      const messages = [
        "Preparing secure intercept layout...",
        "Securing peer-to-peer sandbox connection...",
        "Bypassing ad-heavy gateway gateways...",
      ];
      setStatusMessage(messages[3 - secondsLeft] || "Preparing bypasser...");
      
      const timer = setTimeout(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (secondsLeft === 0 && streams.length === 0 && !isExtracting && !extractionError) {
      setIsExtracting(true);
      setStatusMessage("Extracting direct multi-quality streams...");

      (async () => {
        // Try one candidate URL: server extraction first, then (for the
        // primary target only) the client-side bypasser.
        const tryCandidate = async (u: string, allowClient: boolean) => {
          try {
            const res = await extractDirectLink({ data: { url: u } });
            if (res.success && res.streams && res.streams.length > 0 && !res.isFallback) {
              return { ok: true as const, streams: res.streams, subtitles: res.subtitles };
            }
            if (allowClient) {
              const clientRes = await clientSideExtract(u).catch(() => null);
              if (clientRes && clientRes.success && clientRes.streams && clientRes.streams.length > 0) {
                return { ok: true as const, streams: clientRes.streams, subtitles: clientRes.subtitles };
              }
            }
            return {
              ok: false as const,
              fallbackStreams: res.streams,
              error: res.error,
            };
          } catch (err: any) {
            if (allowClient) {
              const clientRes = await clientSideExtract(u).catch(() => null);
              if (clientRes && clientRes.success && clientRes.streams && clientRes.streams.length > 0) {
                return { ok: true as const, streams: clientRes.streams, subtitles: clientRes.subtitles };
              }
            }
            return { ok: false as const, error: err?.message || String(err) };
          }
        };

        const applyStreams = (
          newStreams: StreamQuality[],
          newSubtitles?: { label: string; src: string }[],
          toast?: string,
        ) => {
          setStreams(newStreams);
          setActiveStream(newStreams[0]);
          if (newSubtitles && newSubtitles.length > 0) {
            setSubtitles(newSubtitles);
          }
          setStatusMessage("Stream assets successfully extracted!");
          if (toast && !providerActiveRef.current) showToast(toast);
        };

        try {
          // 1) Primary target — full chain (server + client-side).
          const primary = await tryCandidate(decodedUrl, true);
          if (primary.ok) {
            setWorkingUrl(decodedUrl);
            applyStreams(primary.streams, primary.subtitles, "HTML extracted!");
            setIsExtracting(false);
            return;
          }

          // 2) FALLBACK CHAIN — this title's OTHER sources, playable-host
          // first. A blocked hubcloud target falls through to the title's
          // mdrive link instead of dead-ending on the restricted screen.
          let lastFallbackStreams = primary.fallbackStreams;
          let lastError = primary.error;
          if (mid) {
            let alts: string[] = [];
            try {
              const res = await fetchMovieById({ data: { id: mid } });
              const mv = res?.movie as Movie | null;
              if (mv) alts = alternateStreamCandidates(mv, ep ?? null, decodedUrl, 4);
            } catch {
              /* alternate candidates are best-effort */
            }
            for (let i = 0; i < alts.length; i++) {
              setStatusMessage(
                `Source blocked. Trying alternate source ${i + 1} of ${alts.length}...`,
              );
              const altAttempt = await tryCandidate(alts[i], false);
              if (altAttempt.ok) {
                setWorkingUrl(alts[i]);
                applyStreams(
                  altAttempt.streams,
                  altAttempt.subtitles,
                  "Alternate source found — playing now!",
                );
                setIsExtracting(false);
                return;
              }
              if (altAttempt.fallbackStreams) lastFallbackStreams = altAttempt.fallbackStreams;
              if (altAttempt.error) lastError = altAttempt.error;
            }
          }

          // 3) Every candidate failed — the restricted/fallback screen on
          // the original target, exactly as before.
          const fallbackStreams =
            lastFallbackStreams && lastFallbackStreams.length > 0
              ? lastFallbackStreams
              : [{ quality: "Source", url: decodedUrl }];
          setWorkingUrl(decodedUrl);
          setStreams(fallbackStreams);
          setActiveStream(fallbackStreams[0]);
          setIsFallbackMode(true);
          setExtractionError(
            lastError || "Failed to bypass stream. Using fallback direct source.",
          );
          setStatusMessage("Using original source fallback link.");
          showToast("Bypasser failed. Defaulting to original link.");
          setIsExtracting(false);
        } catch (err: any) {
          const fallbackStreams = [{ quality: "Source", url: decodedUrl }];
          setWorkingUrl(decodedUrl);
          setStreams(fallbackStreams);
          setActiveStream(fallbackStreams[0]);
          setIsFallbackMode(true);
          setExtractionError(err?.message || "Bypasser failed completely.");
          setStatusMessage("Using original source fallback link.");
          showToast("Bypasser failed. Defaulting to original link.");
          setIsExtracting(false);
        }
      })();
    }
  }, [secondsLeft, decodedUrl, streams.length, isExtracting, extractionError, mid, ep]);

  // Subtitle track toggling effect
  useEffect(() => {
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (activeSubtitle === "off") {
          track.mode = "disabled";
        } else if (track.label === activeSubtitle) {
          track.mode = "showing";
        } else {
          track.mode = "disabled";
        }
      }
    }
  }, [activeSubtitle, activeStream]); // re-apply when subtitle or stream source changes

  /* F1 — playback watchdog: extraction can "succeed" yet the media be
   * unplayable (dead CDN URL, blocked segments). If the video makes no
   * progress and has no data ~8s after a stream is set, fail over to
   * the title's remaining candidates instead of sitting on a frozen
   * "Unable to play media" frame. */
  useEffect(() => {
    if (!activeStream || isFallbackMode || isExtracting) return;
    const startedAt = Date.now();
    const iv = window.setInterval(() => {
      if (providerActiveRef.current || fallbackRef.current) {
        window.clearInterval(iv);
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      if (v.currentTime > 0.05 || v.readyState >= 2) {
        window.clearInterval(iv); // healthy — data or progress observed
        return;
      }
      if (Date.now() - startedAt >= 8000) {
        window.clearInterval(iv);
        runFailoverRef.current();
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [activeStream, isFallbackMode, isExtracting]);

  /* ---------------- Continue Watching (localStorage) ---------------- */
  const lastSaveRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const [nextEp, setNextEp] = useState<{ num: number; url: string } | null>(null);

  /* -------- Stream Mode player touches: series data, Up Next, ------- */
  /* -------- Episodes panel, paused overlay                          ------- */
  const [playerMovie, setPlayerMovie] = useState<Movie | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<RawEpisode[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [upNextVisible, setUpNextVisible] = useState(false);
  const [upNextCount, setUpNextCount] = useState(10);
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  /* -------- Watch page body (P0-B): storyline toggle + related ------ */
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [related, setRelated] = useState<Movie[]>([]);

  /* ---- Permanent provider player (see src/lib/providers.ts) ---- */
  const { mode } = useSiteMode();
  const [serverChoice, setServerChoice] = useState<ProviderId | null>(null);
  const cwEntryForResume = mid ? findContinueWatching(mid, ep) : null;
  const cwStartAt =
    t && t > 0
      ? t
      : cwEntryForResume &&
          cwEntryForResume.position > 5 &&
          (!cwEntryForResume.duration || cwEntryForResume.position < cwEntryForResume.duration - 15)
        ? cwEntryForResume.position
        : null;
  const providerCtx: ProviderContext = {
    tmdbId: playerMovie?.tmdb_id ?? null,
    imdbId: playerMovie?.imdb_id ?? null,
    isSeries: playerMovie?.type === "series",
    season: playerMovie?.season_number ?? 1,
    episode: ep ?? 1,
    startAt: cwStartAt,
  };
  const availProviders = playerMovie ? availableProviders(providerCtx) : [];
  const defaultServer: ProviderId =
    mode === "stream" && availProviders.some((p) => p.id === "vidlink") ? "vidlink" : "cinevault";
  const activeServer: ProviderId =
    serverChoice && (serverChoice === "cinevault" || availProviders.some((p) => p.id === serverChoice))
      ? serverChoice
      : defaultServer;
  const providerEmbedUrl =
    activeServer !== "cinevault" ? providerDef(activeServer).embedUrl(providerCtx) : null;
  const showProvider = Boolean(providerEmbedUrl);
  const providerActiveRef = useRef(false);
  providerActiveRef.current = showProvider;

  /* ---- F1: playback-level failover ---- */
  const [failoverStatus, setFailoverStatus] = useState<string | null>(null);
  const failoverTriedRef = useRef<Set<string>>(new Set());
  const failoverBusyRef = useRef(false);
  const runFailoverRef = useRef<() => void>(() => {});
  const activeStreamRef = useRef<StreamQuality | null>(null);
  const streamsRef = useRef<StreamQuality[]>([]);
  const fallbackRef = useRef(false);
  const playerMovieRef = useRef<Movie | null>(null);
  const workingUrlRef = useRef<string | null>(null);
  const decodedUrlRef = useRef<string | null>(null);

  // Keep the refs the failover/watchdog read from in sync every render.
  useEffect(() => {
    activeStreamRef.current = activeStream;
    streamsRef.current = streams;
    fallbackRef.current = isFallbackMode;
    playerMovieRef.current = playerMovie;
    workingUrlRef.current = workingUrl;
    decodedUrlRef.current = decodedUrl;
  });

  // A new target starts a fresh failover budget.
  useEffect(() => {
    failoverTriedRef.current = new Set();
    failoverBusyRef.current = false;
    setFailoverStatus(null);
  }, [target]);

  /* Top 10 ranks (ribbons + At a Glance chips on this page). */
  const [top10Map, setTop10Map] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r: any = await fetchTrendingOrTopRated({ data: { limit: 10 } });
        if (cancelled) return;
        const map = new Map<string, number>();
        ((r?.movies || []) as Movie[]).forEach((m, i) => map.set(String(m.id), i + 1));
        setTop10Map(map);
      } catch {
        /* ribbons are decorative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const myTop10Rank = mid ? (top10Map.get(String(mid)) ?? null) : null;

  /* Provider servers are cross-origin iframes: no progress events are
   * documented for them, so a provider play records the CW entry
   * (title/episode) WITHOUT inventing a position — any position the
   * bypass player already measured is preserved untouched. */
  const providerCwKeyRef = useRef("");
  useEffect(() => {
    if (!showProvider || !mid || !target) return;
    const key = `${mid}:${ep ?? "m"}:${activeServer}`;
    if (providerCwKeyRef.current === key) return;
    providerCwKeyRef.current = key;
    const existing = findContinueWatching(mid, ep);
    upsertContinueWatching({
      id: mid,
      title: title || existing?.title || "Unknown title",
      poster: poster || existing?.poster,
      target,
      ep: ep ?? undefined,
      position: existing?.position ?? 0,
      duration: existing?.duration ?? 0,
      updatedAt: Date.now(),
    });
  }, [showProvider, mid, ep, activeServer, target, title, poster]);

  // A fresh stream starts a fresh resume decision.
  useEffect(() => {
    resumeAppliedRef.current = false;
  }, [activeStream]);

  const saveProgress = () => {
    const v = videoRef.current;
    if (!v || !mid || !target) return;
    const pos = v.currentTime;
    const dur = v.duration;
    if (!dur || !Number.isFinite(dur) || pos < 3) return;
    if (pos >= dur - 15) {
      // (Nearly) finished — drop it from Continue Watching.
      removeContinueWatching(mid, ep);
      return;
    }
    upsertContinueWatching({
      id: mid,
      title: title || "Unknown title",
      poster: poster || undefined,
      // Resume from the source that actually played, not a blocked one.
      target: workingUrl || target,
      ep: ep ?? undefined,
      position: pos,
      duration: dur,
      updatedAt: Date.now(),
    });
  };
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

  // Save on tab close / navigation away.
  useEffect(() => {
    const onUnload = () => saveProgressRef.current();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || resumeAppliedRef.current) return;
    resumeAppliedRef.current = true;
    let startAt = t && t > 0 ? t : 0;
    if (!startAt && mid) {
      const entry = findContinueWatching(mid, ep);
      if (entry && entry.position > 5 && (!entry.duration || entry.position < entry.duration - 15)) {
        startAt = entry.position;
      }
    }
    if (startAt > 0) {
      try {
        v.currentTime = startAt;
      } catch {
        /* seeking can race metadata; ignore */
      }
    }
  };

  const handleTimeUpdate = () => {
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      saveProgress();
    }
    // Up Next: surface the card in the last ~20 seconds of an episode.
    const v = videoRef.current;
    if (v && nextEp && !upNextDismissed && v.duration && Number.isFinite(v.duration)) {
      const remaining = v.duration - v.currentTime;
      if (remaining <= 20 && remaining > 0.25) {
        if (!upNextVisible) {
          setUpNextVisible(true);
          setUpNextCount(10);
        }
      } else if (remaining > 25 && upNextVisible) {
        setUpNextVisible(false);
      }
    }
  };

  const goNextEpisode = () => {
    if (!nextEp) return;
    window.location.assign(
      buildStreamUrl(nextEp.url, { id: mid, title, poster, ep: nextEp.num }),
    );
  };

  // Up Next countdown → autoplay the next episode at zero.
  useEffect(() => {
    if (!upNextVisible || !nextEp) return;
    if (upNextCount <= 0) {
      goNextEpisode();
      return;
    }
    const id = window.setTimeout(() => setUpNextCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextVisible, upNextCount, nextEp]);

  // More Like This for the watch page: same-genre titles first,
  // topped up with trending when the genre shelf is thin.
  useEffect(() => {
    if (!playerMovie) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let rel: Movie[] = [];
      const g = (playerMovie.genre || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (g) {
        try {
          const r: any = await fetchMoviesPaginated({
            data: { page: 1, limit: 10, genres: g, sort: "latest" },
          });
          rel = ((r?.movies || []) as Movie[]).filter(
            (x) => String(x.id) !== String(playerMovie.id),
          );
        } catch {
          /* fall through to trending top-up */
        }
      }
      if (rel.length < 4) {
        try {
          const t: any = await fetchTrendingOrTopRated({ data: { limit: 10 } });
          const extra = ((t?.movies || []) as Movie[]).filter(
            (x) =>
              String(x.id) !== String(playerMovie.id) &&
              !rel.some((y) => String(y.id) === String(x.id)),
          );
          rel = [...rel, ...extra];
        } catch {
          /* related simply stays shorter */
        }
      }
      if (!cancelled) setRelated(rel.slice(0, 10));
    })();
    return () => {
      cancelled = true;
    };
  }, [playerMovie]);

  // Paused-overlay display values.
  const currentEpObj =
    ep != null ? allEpisodes.find((e, i) => episodeNumber(e, i) === ep) : undefined;
  const currentEpExtra = currentEpObj ? episodeDisplayTitle(currentEpObj) : "";
  const overlayTitle =
    (title ? cleanTitle(title) : "") ||
    title ||
    (playerMovie ? cleanTitle(playerMovie.title) : "") ||
    "Now Playing";

  /* ------------- Series data for this title (any stream) ------------- */
  /* Fetches the full row once: powers Next Episode, the Up Next card,  */
  /* the in-player Episodes panel and the paused overlay's storyline.  */
  useEffect(() => {
    setNextEp(null);
    setPlayerMovie(null);
    setAllEpisodes([]);
    setUpNextVisible(false);
    setUpNextDismissed(false);
    setUpNextCount(10);
    setIsPaused(false);
    setHasStarted(false);
    setEpisodesOpen(false);
    setStoryExpanded(false);
    if (!mid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMovieById({ data: { id: mid } });
        const mv = res?.movie as Movie | null;
        if (!mv || cancelled) return;
        setPlayerMovie(mv);
        const eps = parseEpisodes(mv);
        setAllEpisodes(eps);
        if (ep != null) {
          const idx = eps.findIndex((e, i) => episodeNumber(e, i) === ep);
          if (idx >= 0 && idx < eps.length - 1) {
            const nxt = eps[idx + 1];
            const link = episodeBestLink(nxt);
            if (link && !cancelled) setNextEp({ num: episodeNumber(nxt, idx + 1), url: link });
          }
        }
      } catch {
        /* Series extras are a nicety — never break the player for them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mid, ep]);

  // Fluid quality switcher
  const handleQualityChange = (stream: StreamQuality) => {
    // A manual pick gets a fresh failover budget.
    failoverTriedRef.current = new Set();
    if (activeStream?.quality === stream.quality) {
      setSettingsOpen(false);
      return;
    }

    if (videoRef.current) {
      const video = videoRef.current;
      const wasPlaying = !video.paused;
      const currentTime = video.currentTime;
      
      setActiveStream(stream);
      
      // Delay slightly to let React update the source element
      setTimeout(() => {
        try {
          video.load();
          video.currentTime = currentTime;
          if (wasPlaying) {
            video.play().catch((e) => console.log("Auto-play blocked after quality switch:", e));
          }
        } catch (err) {
          console.error("Failed to restore playback time:", err);
        }
      }, 50);
    } else {
      setActiveStream(stream);
    }
    
    setSettingsOpen(false);
    showToast(`Switched to ${stream.quality}`);
  };

  const handleDownload = () => {
    const downloadTarget = activeStream?.url || decodedUrl;
    if (downloadTarget) {
      if (isFallbackMode) {
        window.open(downloadTarget, "_blank", "noopener,noreferrer");
        showToast("Opening gateway page...");
        return;
      }
      const link = document.createElement("a");
      link.href = downloadTarget;
      link.setAttribute("download", "");
      link.setAttribute("target", "_self");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Triggered direct download for quality: ${activeStream?.quality || "Source"}`);
    }
  };

  const handleCopyStream = () => {
    const link = activeStream?.url || decodedUrl;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedStream(true);
      showToast("Clean stream link copied!");
      setTimeout(() => setCopiedStream(false), 2000);
    }
  };

  const handleCopyOriginal = () => {
    if (decodedUrl) {
      navigator.clipboard.writeText(decodedUrl);
      setCopiedOriginal(true);
      showToast("Original link copied!");
      setTimeout(() => setCopiedOriginal(false), 2000);
    }
  };

  /* F1 — playback failover: the extracted stream errored or stalled.
   * Walk (1) the other extracted qualities of the same source, then
   * (2) the title's other source links via fresh extraction, and only
   * (3) when everything has failed land on the restricted screen. */
  const runFailover = async () => {
    if (failoverBusyRef.current || fallbackRef.current || providerActiveRef.current) return;
    const current = activeStreamRef.current;
    if (!current) return;
    failoverBusyRef.current = true;
    failoverTriedRef.current.add(current.url);
    const replay = () => {
      setTimeout(() => {
        const v = videoRef.current;
        if (v) {
          try {
            v.load();
            v.play().catch(() => {});
          } catch {
            /* autoplay policies vary; the element state still updates */
          }
        }
      }, 60);
    };
    try {
      setFailoverStatus("Trying alternate source…");
      // 1) Another extracted quality from the same source.
      const sibling = streamsRef.current.find(
        (s) => s.url !== current.url && !failoverTriedRef.current.has(s.url),
      );
      if (sibling) {
        setActiveStream(sibling);
        replay();
        return;
      }
      // 2) The title's other source links, playable hosts first.
      if (mid) {
        let mv = playerMovieRef.current;
        if (!mv) {
          try {
            const res = await fetchMovieById({ data: { id: mid } });
            mv = res?.movie as Movie | null;
          } catch {
            /* candidates are best-effort */
          }
        }
        const base = workingUrlRef.current || decodedUrlRef.current || "";
        const alts = mv
          ? alternateStreamCandidates(mv, ep ?? null, base, 6).filter(
              (u) => !failoverTriedRef.current.has(u),
            )
          : [];
        for (const alt of alts) {
          failoverTriedRef.current.add(alt);
          try {
            const res = await extractDirectLink({ data: { url: alt } });
            if (res.success && res.streams && res.streams.length > 0 && !res.isFallback) {
              setWorkingUrl(alt);
              setStreams(res.streams);
              setActiveStream(res.streams[0]);
              if (res.subtitles && res.subtitles.length > 0) setSubtitles(res.subtitles);
              showToast("Alternate source found — playing now!");
              replay();
              return;
            }
          } catch {
            /* try the next candidate */
          }
        }
      }
      // 3) Exhausted — restricted/fallback screen on the original target.
      const orig = decodedUrlRef.current;
      if (orig) {
        const fb = [{ quality: "Source", url: orig }];
        setWorkingUrl(orig);
        setStreams(fb);
        setActiveStream(fb[0]);
        setIsFallbackMode(true);
        setExtractionError("All sources failed to play. Using fallback direct source.");
        setStatusMessage("Using original source fallback link.");
      }
    } finally {
      failoverBusyRef.current = false;
      setFailoverStatus(null);
    }
  };
  runFailoverRef.current = runFailover;

  const getDomain = (urlStr: string | null) => {
    if (!urlStr) return "Unknown Host";
    try {
      return new URL(urlStr).hostname;
    } catch {
      return "Direct Server";
    }
  };

  const getFileExtension = (urlStr: string | null) => {
    if (!urlStr) return "UNKNOWN";
    try {
      const path = new URL(urlStr).pathname;
      const ext = path.split(".").pop();
      if (ext && ext.length < 5 && /^[a-z0-9]+$/i.test(ext)) {
        return ext.toUpperCase();
      }
      return "MKV/MP4";
    } catch {
      return "MKV/MP4";
    }
  };

  const activeFileExtension = getFileExtension(activeStream?.url || decodedUrl);
  const isMkv = activeFileExtension === "MKV";

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#080C14] py-8 md:py-16 flex items-center justify-center px-4">
        <div className="w-full max-w-6xl">
          
          {/* HEADER NAVIGATION */}
          <div className="mb-6 flex justify-between items-center">
            <Link
              to="/"
              search={{}}
              className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition flex items-center gap-1.5"
            >
              ← Back to CineVault Home
            </Link>
            {decodedUrl && (
              <span className="text-xs text-[#64748B] font-mono">
                Source: {getDomain(decodedUrl)}
              </span>
            )}
          </div>

          {!target || (!decodedUrl && extractionError) ? (
            /* ERROR CARD */
            <div className="bg-[#0D1321] border border-red-500/30 rounded-xl p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.1)] animate-fade-up max-w-lg mx-auto">
              <AlertCircle size={56} className="text-red-500 mx-auto mb-4 animate-pulse" />
              <h1 className="text-2xl font-bold text-white mb-2">Invalid Download Request</h1>
              <p className="text-[#64748B] mb-8 max-w-sm mx-auto">
                The download target link is missing, expired, or invalid. Please request the download link again.
              </p>
              <Link
                to="/"
                search={{}}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white rounded-lg font-semibold shadow-lg hover:scale-105 transition duration-300"
                style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.25)" }}
              >
                <Home size={18} />
                Return to Home
              </Link>
            </div>
          ) : decodedUrl && !isValidStreamTarget(decodedUrl) ? (
            /* UNPLAYABLE STORED LINK — e.g. a category path was stored as this
               title's link. Show a clear message; never enter the bypass flow
               and never build a gateway URL from it. */
            <div className="bg-[#0D1321] border border-yellow-500/30 rounded-xl p-8 text-center shadow-[0_0_30px_rgba(234,179,8,0.08)] animate-fade-up max-w-lg mx-auto">
              <AlertCircle size={56} className="text-yellow-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">This link can't be played</h1>
              <p className="text-[#64748B] mb-8 max-w-sm mx-auto">
                The stored link for this title points to a listing page instead of a playable file,
                so there is nothing for the player to open. Please go back and pick another quality for this title.
              </p>
              {mid ? (
                <Link
                  to="/movie/$id"
                  params={{ id: mid }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white rounded-lg font-semibold shadow-lg hover:scale-105 transition duration-300"
                  style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.25)" }}
                >
                  ← Back to Title
                </Link>
              ) : (
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white rounded-lg font-semibold shadow-lg hover:scale-105 transition duration-300"
                  style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.25)" }}
                >
                  <Home size={18} />
                  Return to Home
                </a>
              )}
            </div>
          ) : (
            /* SECURE INTERCEPT PLAYER HUB */
            <div className="space-y-6">
              
              {/* VIDEO PLAYER CARD */}
              <div 
                className="bg-[#0D1321] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.08)] relative"
                style={activeStream ? { border: "1px solid rgba(6, 182, 212, 0.35)", boxShadow: "0 0 40px rgba(6, 182, 212, 0.15)" } : undefined}
              >
                {/* Custom Overlay badges */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                    <ShieldCheck size={12} className={isExtracting || secondsLeft > 0 ? "animate-spin" : ""} />
                    {showProvider
                      ? `Server ${providerDef(activeServer).serverNo} · ${providerDef(activeServer).name}`
                      : secondsLeft > 0
                        ? "Securing connection"
                        : isExtracting
                          ? "Bypassing intermediate gateways"
                          : "Bypass Engine Active"}
                  </div>
                  {activeStream && !showProvider && (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md">
                      {activeStream.quality.toUpperCase()} Quality
                    </div>
                  )}
                </div>

                {/* Episodes Panel Button (series with 2+ episodes) */}
                {(activeStream || showProvider) && allEpisodes.length > 1 && (
                  <button
                    onClick={() => setEpisodesOpen((o) => !o)}
                    className="absolute top-4 right-16 z-20 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/80 border border-cyan-500/30 text-cyan-400 hover:text-white transition duration-200 backdrop-blur-md text-[11px] font-bold"
                    title="Episodes"
                  >
                    <ListVideo size={15} /> Episodes
                  </button>
                )}

                {/* Settings Overlay Button (CineVault bypass server only) */}
                {activeStream && !showProvider && (
                  <div className="absolute top-4 right-4 z-20" ref={settingsRef}>
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className="p-2 rounded-full bg-black/80 border border-cyan-500/30 text-cyan-400 hover:text-white hover:scale-105 transition duration-200 backdrop-blur-md relative"
                      title="Player Settings"
                    >
                      <Settings size={18} className={settingsOpen ? "rotate-90 transition-transform duration-300" : "transition-transform"} />
                    </button>

                    {/* Settings Dropdown Panel */}
                    {settingsOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-[#0D1321]/95 border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-lg animate-fade-up z-50 text-sm">
                        
                        {/* Quality Section */}
                        {streams.length > 1 && (
                          <div className="mb-4">
                            <h4 className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              Quality Source
                            </h4>
                            <div className="space-y-1">
                              {streams.map((s) => (
                                <button
                                  key={s.quality}
                                  onClick={() => handleQualityChange(s)}
                                  className="w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-cyan-950/30 text-xs font-semibold transition"
                                >
                                  <span className={activeStream.quality === s.quality ? "text-cyan-400 font-bold" : "text-[#CBD5E1]"}>
                                    {s.quality.toUpperCase()}
                                  </span>
                                  {activeStream.quality === s.quality && (
                                    <Check size={14} className="text-cyan-400" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Subtitles Section */}
                        <div>
                          <h4 className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Captions size={12} /> Captions
                          </h4>
                          <div className="space-y-1">
                            <button
                              onClick={() => {
                                setActiveSubtitle("off");
                                setSettingsOpen(false);
                                showToast("Captions disabled");
                              }}
                              className="w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-cyan-950/30 text-xs font-semibold transition"
                            >
                              <span className={activeSubtitle === "off" ? "text-cyan-400 font-bold" : "text-[#CBD5E1]"}>
                                Off
                              </span>
                              {activeSubtitle === "off" && (
                                <Check size={14} className="text-cyan-400" />
                              )}
                            </button>
                            
                            {subtitles.map((sub) => (
                              <button
                                key={sub.label}
                                onClick={() => {
                                  setActiveSubtitle(sub.label);
                                  setSettingsOpen(false);
                                  showToast(`Enabled ${sub.label} subtitles`);
                                }}
                                className="w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-cyan-950/30 text-xs font-semibold transition"
                              >
                                <span className={activeSubtitle === sub.label ? "text-cyan-400 font-bold" : "text-[#CBD5E1]"}>
                                  {sub.label}
                                </span>
                                {activeSubtitle === sub.label && (
                                  <Check size={14} className="text-cyan-400" />
                                )}
                              </button>
                            ))}
                            {subtitles.length === 0 && (
                              <p className="text-[10px] text-[#64748B] italic px-3 py-1">No captions extracted</p>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* Main Media Panel */}
                <div className="aspect-video bg-[#05080f] flex items-center justify-center relative group">
                  {showProvider ? (
                    /* PROVIDER SERVER — third-party embed (VidLink / VidSrc / 2Embed) */
                    <iframe
                      key={providerEmbedUrl}
                      src={providerEmbedUrl!}
                      title={`${overlayTitle} — ${providerDef(activeServer).name}`}
                      className="absolute inset-0 h-full w-full"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                      sandbox={providerDef(activeServer).sandbox ?? undefined}
                      referrerPolicy="origin"
                    />
                  ) : secondsLeft > 0 || isExtracting ? (
                    /* LOADING STATE */
                    <div className="text-center p-6 space-y-4">
                      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 animate-spin"></div>
                        <Play size={24} className="text-cyan-500/60 animate-pulse ml-0.5" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[#CBD5E1] text-sm font-semibold">{statusMessage}</p>
                        <p className="text-[#64748B] text-xs font-mono">Bypassing intermediate ad gateways...</p>
                      </div>
                    </div>
                  ) : isFallbackMode ? (
                    /* FALLBACK MODE: SECURE GATEWAY REQUIRED */
                    <div className="text-center p-6 md:p-8 space-y-4 max-w-lg animate-fade-up">
                      <div className="w-12 h-12 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                        <AlertCircle size={24} className="animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white tracking-wide">Direct Streaming Restricted</h2>
                        <p className="text-[#94A3B8] text-xs leading-relaxed max-w-md mx-auto">
                          The file host's security firewall blocked direct stream extraction.
                          You can easily access direct downloads, FSL, and Pixel streams by visiting the gateway page below.
                        </p>
                      </div>
                      <div className="bg-[#090D16] border border-cyan-500/10 rounded-lg p-3 text-[11px] text-[#64748B] text-left space-y-1 font-mono">
                        <p className="text-cyan-400 font-bold mb-0.5">💡 Bypasser Instructions:</p>
                        <p>1. Click the "Open Gateway" button below.</p>
                        <p>2. Scroll down and click the green "Generate Direct Download Link" button.</p>
                        <p>3. Select "FSL Server" or "Pixel Server" for direct high-speed play/download.</p>
                      </div>
                      <a
                        href={decodedUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition duration-300"
                        style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.25)" }}
                      >
                        Open Secure Gateway Page
                      </a>
                    </div>
                  ) : activeStream ? (
                    /* VIDEO COMPONENT WITH DYNAMIC TRACK BINDINGS */
                    <div className="w-full h-full relative">
                      <video
                        ref={videoRef}
                        src={activeStream.url}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                        style={{ outline: "none" }}
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onError={() => runFailoverRef.current()}
                        onPlay={() => {
                          setIsPaused(false);
                          setHasStarted(true);
                        }}
                        onPause={() => {
                          saveProgress();
                          setIsPaused(true);
                        }}
                        onEnded={() => {
                          if (mid) removeContinueWatching(mid, ep);
                          if (nextEp && !upNextDismissed) {
                            setUpNextVisible(true);
                            setUpNextCount(10);
                          }
                        }}
                      >
                        {/* Inject subtitles dynamically */}
                        {subtitles.map((sub) => (
                          <track
                            key={sub.label}
                            kind="subtitles"
                            label={sub.label}
                            src={sub.src}
                            srcLang={sub.label.substring(0, 2).toLowerCase()}
                            default={activeSubtitle === sub.label}
                          />
                        ))}
                      </video>

                      {/* PAUSED OVERLAY — title + episode + storyline, Netflix-style */}
                      {isPaused && hasStarted && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/45 px-6 text-center pointer-events-none">
                          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mb-2">
                            You're watching
                          </div>
                          <div className="max-w-lg text-xl md:text-3xl font-black text-white line-clamp-2 drop-shadow">
                            {overlayTitle}
                          </div>
                          {ep != null && (
                            <div className="mt-1.5 text-sm font-bold text-[#06B6D4]">
                              Episode {ep}
                              {currentEpExtra ? ` · ${currentEpExtra}` : ""}
                            </div>
                          )}
                          {playerMovie?.description && (
                            <p className="mt-3 max-w-md text-xs md:text-sm leading-relaxed text-slate-300/90 line-clamp-3">
                              {playerMovie.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* FAILURE / RETRY */
                    <div className="text-center p-8 space-y-4 max-w-md animate-fade-up">
                      <AlertCircle size={48} className="text-yellow-500 mx-auto animate-pulse" />
                      <h2 className="text-lg font-bold text-white">Direct stream extraction failed</h2>
                      <p className="text-[#64748B] text-xs leading-relaxed">
                        CineVault couldn't parse direct stream resolutions from the target host. 
                        You can still click the download button below to fetch the clean asset link directly.
                      </p>
                      <button
                        onClick={() => {
                          setSecondsLeft(3);
                          setExtractionError(null);
                        }}
                        className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 text-xs font-bold transition flex items-center gap-1.5 mx-auto"
                      >
                        <RefreshCw size={12} /> Retry Extraction
                      </button>
                    </div>
                  )}
                </div>

                {/* F1 FAILOVER STATUS — visible while alternates are tried */}
                {failoverStatus && !showProvider && (
                  <div className="absolute bottom-16 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-black/85 border border-cyan-500/40 px-3.5 py-1.5 text-[11px] font-bold text-cyan-300 backdrop-blur">
                    <RefreshCw size={12} className="animate-spin" />
                    {failoverStatus}
                  </div>
                )}

                {/* UP NEXT CARD — last ~20s of an episode + on end */}
                {upNextVisible && nextEp && (
                  <div className="absolute bottom-16 right-3 md:right-5 z-30 w-[280px] max-w-[85%] rounded-xl bg-[#181818]/95 border border-white/15 shadow-2xl p-3.5 backdrop-blur animate-fade-up">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Up Next
                    </div>
                    <div className="text-white font-bold text-sm mt-1 line-clamp-1">
                      {overlayTitle} — Episode {nextEp.num}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Playing in {upNextCount}s
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={goNextEpisode}
                        className="flex-1 bg-white text-black text-xs font-bold py-2 rounded-md hover:bg-white/85 flex items-center justify-center gap-1.5 transition"
                      >
                        <Play size={13} fill="currentColor" /> Play Now
                      </button>
                      <button
                        onClick={() => {
                          setUpNextDismissed(true);
                          setUpNextVisible(false);
                        }}
                        className="px-3 border border-white/25 text-white text-xs font-bold py-2 rounded-md hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* EPISODES PANEL — in-player episode list with direct play */}
                {episodesOpen && allEpisodes.length > 1 && (
                  <div className="absolute inset-y-0 right-0 z-40 w-[320px] max-w-[88%] bg-[#101623]/[0.98] border-l border-white/10 shadow-2xl flex flex-col animate-fade-up">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                      <button
                        onClick={() => setEpisodesOpen(false)}
                        aria-label="Back to video"
                        className="text-slate-300 hover:text-white transition"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div className="text-sm font-bold text-white">
                        Season {playerMovie?.season_number ?? 1}{" "}
                        <span className="text-slate-400 font-medium">
                          · {allEpisodes.length} Episodes
                        </span>
                      </div>
                      <button
                        onClick={() => setEpisodesOpen(false)}
                        aria-label="Close episodes"
                        className="ml-auto text-slate-400 hover:text-white transition"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {allEpisodes.map((e, i) => {
                        const num = episodeNumber(e, i);
                        const link = episodeBestLink(e);
                        const extra = episodeDisplayTitle(e);
                        const epCw = mid ? findContinueWatching(mid, num) : undefined;
                        const pct =
                          epCw && epCw.duration > 0
                            ? Math.min(100, (epCw.position / epCw.duration) * 100)
                            : 0;
                        const isCurrent = ep != null && num === ep;
                        return (
                          <button
                            key={num}
                            disabled={!link}
                            onClick={() => {
                              if (!link) return;
                              window.location.assign(
                                buildStreamUrl(link, { id: mid, title, poster, ep: num }),
                              );
                            }}
                            className={`flex w-full items-center gap-3 px-4 text-left transition ${
                              isCurrent
                                ? "bg-[#06B6D4]/10 py-3.5"
                                : link
                                  ? "py-2.5 hover:bg-white/5"
                                  : "py-2.5 opacity-45 cursor-not-allowed"
                            }`}
                          >
                            <span
                              className={`w-7 flex-none text-center text-base font-bold ${
                                isCurrent ? "text-[#06B6D4]" : "text-slate-300"
                              }`}
                            >
                              {num}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-[13px] font-semibold text-white ${
                                  isCurrent ? "line-clamp-2" : "truncate"
                                }`}
                              >
                                {extra || `Episode ${num}`}
                              </span>
                              {pct > 0 && (
                                <span className="mt-1 block h-[3px] w-32 max-w-full rounded bg-[#404040]">
                                  <span
                                    className="block h-full rounded bg-[#06B6D4]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </span>
                              )}
                            </span>
                            {isCurrent ? (
                              <span className="flex-none text-[10px] font-bold uppercase tracking-wider text-[#06B6D4]">
                                Playing
                              </span>
                            ) : (
                              <Play size={14} className="flex-none text-slate-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SERVER SWITCHER — permanent provider player */}
              {playerMovie && (
                <div className="flex flex-wrap items-center gap-2 animate-fade-up">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Server
                  </span>
                  {PROVIDERS.map((def) => {
                    if (
                      def.id !== "cinevault" &&
                      !availProviders.some((p) => p.id === def.id)
                    )
                      return null;
                    const isActive = activeServer === def.id;
                    return (
                      <button
                        key={def.id}
                        onClick={() => setServerChoice(def.id)}
                        title={def.notes}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                          isActive
                            ? "bg-[#06B6D4] text-white"
                            : "border border-white/20 text-slate-300 hover:border-[#06B6D4] hover:text-white"
                        }`}
                      >
                        Server {def.serverNo} · {def.name}
                      </button>
                    );
                  })}
                  {availProviders.length === 0 && (
                    <span className="text-[11px] text-slate-500">
                      Provider servers unavailable for this title (no TMDb/IMDb ID) — CineVault
                      server only.
                    </span>
                  )}
                </div>
              )}

              {/* WATCH DETAILS — title, meta, storyline, download options */}
              {playerMovie && (
                <section className="animate-fade-up">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className="max-w-2xl text-2xl font-black leading-tight text-white md:text-4xl">
                      {overlayTitle}
                    </h1>
                    <MyListButton movie={playerMovie} variant="full" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    {metaGenres(playerMovie).length > 0 && (
                      <span className="text-slate-300">
                        {metaGenres(playerMovie).slice(0, 3).join(" · ")}
                      </span>
                    )}
                    {playerMovie.year != null && (
                      <span className="text-slate-200">{playerMovie.year}</span>
                    )}
                    {runtimeLabel(playerMovie) && (
                      <span className="text-slate-400">{runtimeLabel(playerMovie)}</span>
                    )}
                    {validRating(playerMovie.imdb_rating) != null && (
                      <span className="font-bold text-amber-400">
                        ★ {validRating(playerMovie.imdb_rating)!.toFixed(1)}
                      </span>
                    )}
                    {playerMovie.quality && (
                      <QualityBadge quality={playerMovie.quality} size="sm" />
                    )}
                    {playerMovie.language && (
                      <span className="text-slate-400">{playerMovie.language}</span>
                    )}
                    {cleanFileSize(playerMovie.file_size) && (
                      <span className="text-slate-400">
                        {cleanFileSize(playerMovie.file_size)}
                      </span>
                    )}
                    <span className="text-slate-500">
                      {playerMovie.type === "series" ? "Web Series" : "Movie"}
                    </span>
                  </div>
                  <GlanceChips movie={playerMovie} rank={myTop10Rank} className="mt-3" />
                  {ep != null && (
                    <div className="mt-2 text-sm font-bold text-[#06B6D4]">
                      Episode {ep}
                      {currentEpExtra ? ` · ${currentEpExtra}` : ""}
                    </div>
                  )}

                  {playerMovie.description && (
                    <div className="mt-4 max-w-3xl">
                      <p
                        className={`text-sm leading-relaxed text-slate-300 md:text-[15px] ${
                          storyExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {playerMovie.description}
                      </p>
                      <button
                        onClick={() => setStoryExpanded((s) => !s)}
                        className="mt-1.5 text-[13px] font-semibold text-[#06B6D4] transition hover:text-cyan-300"
                      >
                        {storyExpanded ? "See Less" : "See More"}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 space-y-1.5 text-[13px] leading-relaxed">
                    {playerMovie.cast_names && (
                      <p>
                        <span className="text-slate-500">Cast: </span>
                        <span className="text-slate-200">{playerMovie.cast_names}</span>
                      </p>
                    )}
                    {playerMovie.director && (
                      <p>
                        <span className="text-slate-500">
                          {playerMovie.type === "series" ? "Creator: " : "Director: "}
                        </span>
                        <span className="text-slate-200">{playerMovie.director}</span>
                      </p>
                    )}
                    {playerMovie.platform && (
                      <p>
                        <span className="text-slate-500">Platform: </span>
                        <span className="text-slate-200">{playerMovie.platform}</span>
                      </p>
                    )}
                  </div>

                  {validQualities(playerMovie).length > 0 && (
                    <div className="mt-6">
                      <h2 className="mb-2.5 text-base font-bold text-white">
                        Download Options
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {validQualities(playerMovie).map((q) => (
                          <button
                            key={q.label}
                            onClick={() =>
                              window.location.assign(
                                buildStreamUrl(q.url, {
                                  id: mid,
                                  title: overlayTitle,
                                  poster,
                                  ep,
                                }),
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#111827] px-3.5 py-2 text-[13px] font-semibold text-slate-200 transition hover:border-[#06B6D4] hover:text-[#06B6D4]"
                          >
                            <Download size={14} /> {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* EPISODES — watch page list (series) */}
              {playerMovie && allEpisodes.length > 0 && (
                <section className="animate-fade-up">
                  <h2 className="text-lg font-bold text-white">
                    {playerMovie.season_number ? `Season ${playerMovie.season_number}` : "Episodes"}{" "}
                    <span className="text-sm font-medium text-slate-400">
                      · {allEpisodes.length} Episodes
                    </span>
                  </h2>
                  <div className="mt-2">
                    {allEpisodes.map((e, i) => {
                      const num = episodeNumber(e, i);
                      const link = episodeBestLink(e);
                      const extra = episodeDisplayTitle(e);
                      const epCw = mid ? findContinueWatching(mid, num) : undefined;
                      const pct =
                        epCw && epCw.duration > 0
                          ? Math.min(100, (epCw.position / epCw.duration) * 100)
                          : 0;
                      const isCurrent = ep != null && num === ep;
                      return (
                        <div
                          key={num}
                          onClick={() => {
                            if (link) {
                              window.location.assign(
                                buildStreamUrl(link, {
                                  id: mid,
                                  title: overlayTitle,
                                  poster,
                                  ep: num,
                                }),
                              );
                            }
                          }}
                          className={`flex items-center gap-4 border-t border-white/10 px-2 py-3.5 ${
                            link ? "cursor-pointer transition hover:bg-white/5" : "opacity-50"
                          } ${isCurrent ? "bg-[#06B6D4]/5" : ""}`}
                        >
                          <span
                            className={`w-8 flex-none text-center text-xl ${
                              isCurrent ? "font-bold text-[#06B6D4]" : "text-slate-200"
                            }`}
                          >
                            {num}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {extra || `Episode ${num}`}
                            </div>
                            {pct > 0 && (
                              <div className="mt-1.5 h-[3px] w-44 max-w-full rounded bg-[#404040]">
                                <div
                                  className="h-full rounded bg-[#06B6D4]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {isCurrent ? (
                            <span className="flex-none text-[10px] font-bold uppercase tracking-wider text-[#06B6D4]">
                              Now Playing
                            </span>
                          ) : (
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/30 text-white">
                              <Play size={14} fill="currentColor" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* MORE LIKE THIS — bottom row */}
              {related.length > 0 && (
                <section className="animate-fade-up">
                  <h2 className="mb-3 text-lg font-bold text-white">More Like This</h2>
                  <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
                    {related.map((m) => (
                      <WatchRelatedCard
                        key={String(m.id)}
                        movie={m}
                        top10Rank={top10Map.get(String(m.id)) ?? null}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* NEXT EPISODE */}
              {nextEp && (
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      window.location.assign(
                        buildStreamUrl(nextEp.url, { id: mid, title, poster, ep: nextEp.num }),
                      )
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.25)] transition cursor-pointer"
                  >
                    Next Episode {nextEp.num} <SkipForward size={16} />
                  </button>
                </div>
              )}

              {/* FORMAT COMPATIBILITY BLOCK */}
              {activeStream && isMkv && (
                <div 
                  className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-950/10 flex gap-3 animate-fade-up"
                  style={{ backdropFilter: "blur(8px)" }}
                >
                  <Info size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-[#CBD5E1] leading-relaxed">
                    <span className="font-semibold text-yellow-500">MKV Container Alert:</span> MKV is a container format that has limited native decoding in web browsers. If you experience no video, audio-only playback, or seeking failure, please click the <strong className="text-cyan-400">Download File</strong> button to retrieve the ad-free file and play it in software players like VLC.
                  </div>
                </div>
              )}

              {/* CONTROL & DIAGNOSTICS CONTROL PANEL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Diagnostics */}
                <div className="md:col-span-2 bg-[#0D1321] border border-cyan-500/10 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                      <Info size={16} /> Player Engine Diagnostics
                    </h3>
                    <div className="space-y-3 text-xs font-mono">
                      <div className="flex justify-between py-1.5 border-b border-cyan-500/5">
                        <span className="text-[#64748B]">Bypassed Host</span>
                        <span className="text-white font-medium">{getDomain(decodedUrl)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-cyan-500/5">
                        <span className="text-[#64748B]">Available Streams</span>
                        <span className="text-cyan-400 font-bold">{streams.length || "0"} qualities detected</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-cyan-500/5">
                        <span className="text-[#64748B]">Loaded Captions</span>
                        <span className="text-white font-medium">{subtitles.length || "No"} subtitles loaded</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-cyan-500/5">
                        <span className="text-[#64748B]">Stream Engine</span>
                        <span className="text-emerald-400 font-medium">Multi-Quality Intercept v2</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-cyan-500/5 flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyStream}
                      disabled={secondsLeft > 0 || isExtracting}
                      className="px-3 py-1.5 rounded bg-[#111827] border border-cyan-500/10 text-xs text-[#CBD5E1] font-semibold hover:bg-cyan-950/20 hover:text-cyan-400 flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy size={12} />
                      {copiedStream ? "Copied!" : `Copy ${activeStream?.quality || "Clean"} Link`}
                    </button>
                    <button
                      onClick={handleCopyOriginal}
                      className="px-3 py-1.5 rounded bg-[#111827] border border-cyan-500/10 text-xs text-[#CBD5E1] font-semibold hover:bg-cyan-950/20 hover:text-cyan-400 flex items-center gap-1.5 transition"
                    >
                      <Copy size={12} />
                      {copiedOriginal ? "Copied!" : "Copy Source URL"}
                    </button>
                  </div>
                </div>

                {/* Downloader block */}
                <div className="bg-[#0D1321] border border-cyan-500/10 rounded-xl p-6 flex flex-col justify-center text-center">
                  <div className="mb-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2 text-cyan-400">
                      <Download size={20} />
                    </div>
                    <h4 className="text-white font-bold text-sm">
                      {isFallbackMode ? "Open secure gateway" : "Download selected quality"}
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-1">
                      {isFallbackMode ? "Access hosting page to download movie." : "Direct download from secure parsed assets."}
                    </p>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={secondsLeft > 0 || isExtracting}
                    className={`
                      w-full py-3 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2
                      transition-all duration-300 transform active:scale-95
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${
                        secondsLeft > 0 || isExtracting
                          ? "bg-[#141b2b] text-gray-500 border border-gray-800"
                          : "bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:scale-[1.02]"
                      }
                    `}
                  >
                    <Download size={16} />
                    {secondsLeft > 0 || isExtracting ? "Securing Link..." : isFallbackMode ? "Open Gateway Page" : `Download ${activeStream?.quality || "File"}`}
                  </button>
                  
                  <span className="text-[9px] text-[#64748B] mt-3">
                    Selected stream: {activeStream?.quality || "Original"} ({activeFileExtension})
                  </span>
                </div>

              </div>

              {/* Safeguard footer */}
              <div className="text-center py-4 text-[10px] text-[#64748B]">
                CineVault multi-quality secure link bypass engine extracts and sanitizes source tracks automatically.
              </div>

            </div>
          )}

        </div>
      </div>
    </SiteShell>
  );
}
