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
 */
export function TrailerHero({ movie, image, className = "", delayMs = 2000, children }: Props) {
  const [trailerKey, setTrailerKey] = useState<string | null | undefined>(undefined);
  const [showVideo, setShowVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrailerKey(undefined);
    setShowVideo(false);
    setMuted(true);
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
