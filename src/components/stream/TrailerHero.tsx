import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { getTrailerKey } from "@/lib/trailer";

type Props = {
  movie: {
    id: string | number;
    title: string;
    year?: number | null;
    type?: string;
    tmdb_id?: number | null;
  };
  image: string | null;
  className?: string;
  /** ms to wait before the trailer fades in over the backdrop. */
  delayMs?: number;
  children?: React.ReactNode;
};

/**
 * Netflix-style hero media: backdrop still first, then (when the title has
 * an official YouTube trailer) a muted autoplay embed crossfades in with a
 * mute/unmute toggle. Without a trailer the backdrop gets a slow Ken Burns
 * zoom instead. The YouTube iframe keeps pointer-events off so overlay
 * content stays clickable; the mute button talks to it via the IFrame API.
 *
 * F4: a trailer key can exist yet be unplayable (region-blocked embeds
 * render YouTube's own "Video unavailable" page inside the hero). The
 * component listens to the IFrame API: an onError event — or 7s without
 * a "playing" state — drops the embed and reverts to backdrop + Ken
 * Burns, so the hero never displays YouTube's error page.
 */
export function TrailerHero({ movie, image, className = "", delayMs = 2000, children }: Props) {
  const [trailerKey, setTrailerKey] = useState<string | null | undefined>(undefined);
  const [showVideo, setShowVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setTrailerKey(undefined);
    setShowVideo(false);
    setMuted(true);
    playingRef.current = false;
    getTrailerKey(movie).then((k) => {
      if (!cancelled) setTrailerKey(k);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.id]);

  useEffect(() => {
    if (!trailerKey) return;
    const t = setTimeout(() => setShowVideo(true), delayMs);
    return () => clearTimeout(t);
  }, [trailerKey, delayMs]);

  const dropEmbed = () => {
    // Revert to the backdrop: trailerKey null unmounts the iframe and
    // switches the still to the Ken Burns treatment.
    playingRef.current = false;
    setShowVideo(false);
    setTrailerKey(null);
  };

  // IFrame API: handshake + onError / playing-state detection.
  useEffect(() => {
    if (!trailerKey) return;
    const onMessage = (e: MessageEvent) => {
      if (!String(e.origin || "").includes("youtube.com")) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: any = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (data.event === "onError") {
        dropEmbed();
      } else if (data.event === "infoDelivery" && data.info && data.info.playerState === 1) {
        playingRef.current = true;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailerKey]);

  // Watchdog: embed visible but never reached "playing" → it is most
  // likely an error screen (region block renders no state changes).
  useEffect(() => {
    if (!showVideo || !trailerKey) return;
    const t = setTimeout(() => {
      if (!playingRef.current) dropEmbed();
    }, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo, trailerKey]);

  const startListening = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: "listening", id: `cv-trailer-${movie.id}`, channel: "widget" }),
        "*",
      );
    } catch {
      /* handshake is best-effort; the watchdog still guards */
    }
  };

  const toggleMute = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        JSON.stringify({ event: "command", func: muted ? "unMute" : "mute", args: [] }),
        "*",
      );
    }
    setMuted((m) => !m);
  };

  const hasVideo = Boolean(trailerKey && showVideo);

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {image && (
        <img
          src={image}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover object-top ${
            hasVideo ? "opacity-0" : "opacity-100"
          } ${trailerKey === null ? "animate-kenburns" : ""} transition-opacity duration-1000`}
          loading="eager"
        />
      )}
      {trailerKey && (
        <iframe
          ref={iframeRef}
          title="Official trailer"
          onLoad={startListening}
          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&loop=1&playlist=${trailerKey}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`}
          allow="autoplay; encrypted-media"
          className={`pointer-events-none absolute left-0 top-[5%] aspect-video w-full transition-opacity duration-1000 md:top-0 md:h-full md:aspect-auto ${
            showVideo ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {children}
      {hasVideo && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
          className="absolute bottom-[22%] right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/40 text-white backdrop-blur transition-colors hover:border-white md:right-12"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}
    </div>
  );
}
