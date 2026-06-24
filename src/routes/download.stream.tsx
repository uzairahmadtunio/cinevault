import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Download, ShieldCheck, Copy, AlertCircle, Home, Play, Info, Check, RefreshCw, Settings, Captions } from "lucide-react";
import { SiteShell, showToast } from "@/components/cinevault";
import { decodeUrl, clientSideExtract } from "@/utils/linkBypasser";
import { extractDirectLink } from "@/lib/api/server.movies";

export const Route = createFileRoute("/download/stream")({
  validateSearch: (search: Record<string, any>) => ({
    target: search.target as string | undefined,
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

function DownloadStreamPage() {
  const { target } = Route.useSearch();
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
        try {
          // 1. Try server-side bypass extraction first
          const res = await extractDirectLink({ data: { url: decodedUrl } });
          
          if (res.success && res.streams && res.streams.length > 0 && !res.isFallback) {
            setIsExtracting(false);
            setStreams(res.streams);
            setActiveStream(res.streams[0]); // default to highest quality parsed
            if (res.subtitles && res.subtitles.length > 0) {
              setSubtitles(res.subtitles);
            }
            setStatusMessage("Stream assets successfully extracted!");
            showToast(`HTML extracted!`);
          } else {
            // 2. Server-side failed or returned fallback. Fallback to client-side extraction.
            console.log("[CineVault Player] Server-side bypass failed or returned fallback. Trying client-side fallback...");
            setStatusMessage("Serverless restriction detected. Launching client-side fallback bypasser...");
            
            const clientRes = await clientSideExtract(decodedUrl);
            setIsExtracting(false);
            
            if (clientRes.success && clientRes.streams && clientRes.streams.length > 0) {
              setStreams(clientRes.streams);
              setActiveStream(clientRes.streams[0]);
              if (clientRes.subtitles && clientRes.subtitles.length > 0) {
                setSubtitles(clientRes.subtitles);
              }
              setStatusMessage("Client-side bypass successful!");
              showToast(`Extracted ${clientRes.streams.length} stream qualities via client-side bypass!`);
            } else {
              // 3. Both failed: fallback to playing original URL as "Source"
              const fallbackStreams = res.streams || [{ quality: "Source", url: decodedUrl }];
              setStreams(fallbackStreams);
              setActiveStream(fallbackStreams[0]);
              setIsFallbackMode(true);
              setExtractionError(res.error || clientRes.error || "Failed to bypass stream. Using fallback direct source.");
              setStatusMessage("Using original source fallback link.");
              showToast("Bypasser failed. Defaulting to original link.");
            }
          }
        } catch (err: any) {
          console.warn("[CineVault Player] Serverless extraction threw error. Trying client-side fallback...", err);
          setStatusMessage("Serverless error. Launching client-side fallback bypasser...");
          
          try {
            const clientRes = await clientSideExtract(decodedUrl);
            setIsExtracting(false);
            
            if (clientRes.success && clientRes.streams && clientRes.streams.length > 0) {
              setStreams(clientRes.streams);
              setActiveStream(clientRes.streams[0]);
              if (clientRes.subtitles && clientRes.subtitles.length > 0) {
                setSubtitles(clientRes.subtitles);
              }
              setStatusMessage("Client-side bypass successful!");
              showToast(`Extracted ${clientRes.streams.length} stream qualities via client-side bypass!`);
            } else {
              const fallbackStreams = [{ quality: "Source", url: decodedUrl }];
              setStreams(fallbackStreams);
              setActiveStream(fallbackStreams[0]);
              setIsFallbackMode(true);
              setExtractionError(err?.message || "Failed to bypass stream. Using fallback direct source.");
              setStatusMessage("Using original source fallback link.");
              showToast("Bypasser failed. Defaulting to original link.");
            }
          } catch (clientErr) {
            setIsExtracting(false);
            const fallbackStreams = [{ quality: "Source", url: decodedUrl }];
            setStreams(fallbackStreams);
            setActiveStream(fallbackStreams[0]);
            setIsFallbackMode(true);
            setExtractionError("Bypasser failed completely.");
            setStatusMessage("Using original source fallback link.");
            showToast("Bypasser failed. Defaulting to original link.");
          }
        }
      })();
    }
  }, [secondsLeft, decodedUrl, streams.length, isExtracting, extractionError]);

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

  // Fluid quality switcher
  const handleQualityChange = (stream: StreamQuality) => {
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
        <div className="w-full max-w-4xl">
          
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
                    {secondsLeft > 0 ? "Securing connection" : isExtracting ? "Bypassing intermediate gateways" : "Bypass Engine Active"}
                  </div>
                  {activeStream && (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md">
                      {activeStream.quality.toUpperCase()} Quality
                    </div>
                  )}
                </div>

                {/* Settings Overlay Button */}
                {activeStream && (
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
                  {secondsLeft > 0 || isExtracting ? (
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
              </div>

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
