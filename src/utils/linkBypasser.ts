/**
 * Link Bypasser Utility
 * CineVault helper functions to base64 encode and decode target external links
 * to map them to internal secure routes, preventing direct ad-heavy site access.
 */

/**
 * Safely encodes a string (like a URL) to base64.
 */
export function encodeUrl(url: string): string {
  try {
    // standard base64 encoding
    return btoa(url);
  } catch (e) {
    // fallback for Unicode/non-ASCII characters
    try {
      return btoa(encodeURIComponent(url).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch {
      return btoa(url);
    }
  }
}

/**
 * Safely decodes a base64 encoded string back to the original text.
 */
export function decodeUrl(encoded: string): string {
  try {
    return atob(encoded);
  } catch (e) {
    try {
      // Decode handling percent-encoded UTF-8 sequences
      return decodeURIComponent(
        Array.prototype.map.call(atob(encoded), (c: string) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join("")
      );
    } catch {
      return atob(encoded);
    }
  }
}

/**
 * Encodes an external download URL and maps it to the internal route format:
 * `/download/stream?target=${encodedUrl}`
 */
export function getBypassedUrl(externalUrl: string): string {
  if (!externalUrl) return "";
  const encoded = encodeUrl(externalUrl);
  return `/download/stream?target=${encodeURIComponent(encoded)}`;
}

/**
 * A stored link is only a plausible stream/download target when it is an
 * absolute http(s) URL on a real host. Scraped data sometimes stores junk in
 * link fields — e.g. a relative category path like "/category/2160p-4k/" as a
 * title's 4K "link" — which used to send users into a dead-end bypass flow
 * and an on-domain 404. Anything failing this check must be treated as
 * "no link available" by the UI.
 */
export function isValidStreamTarget(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const parsed = new URL(u);
    if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
    // A URL whose path is an app-style listing route is a web page, not a file.
    if (/^\/(category|tag|movies?|series|download|watch|page|genre)\b/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the internal player URL for a source link, carrying the metadata the
 * player needs for Continue Watching / Next Episode (all optional).
 */
export function buildStreamUrl(
  externalUrl: string,
  opts?: { id?: string | number | null; title?: string | null; poster?: string | null; ep?: number | null },
): string {
  const base = getBypassedUrl(externalUrl);
  if (!opts) return base;
  const extra = new URLSearchParams();
  if (opts.id != null && opts.id !== "") extra.set("mid", String(opts.id));
  if (opts.title) extra.set("title", opts.title);
  if (opts.poster) extra.set("poster", opts.poster);
  if (opts.ep != null) extra.set("ep", String(opts.ep));
  const qs = extra.toString();
  return qs ? `${base}&${qs}` : base;
}

/**
 * Client-Side Direct Stream Bypasser and Extractor
 * Attempts to bypass ad gateways directly in the client browser using public CORS proxies.
 * Sequentially resolves: MDrive ➔ HubCloud ➔ PHP Redirect ➔ Direct Whistle/PixelDrain streaming assets.
 */
export async function clientSideExtract(url: string): Promise<{
  success: boolean;
  streams?: { quality: string; url: string }[];
  subtitles?: { label: string; src: string }[];
  error?: string;
}> {
  try {
    console.log(`[CineVault Client Bypasser] Resolving client fallback chain for ${url}`);
    
    // Resilient list of public free CORS proxies
    const proxies = [
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`
    ];

    const fetchViaProxy = async (targetUrl: string): Promise<string> => {
      let lastErr: any = null;
      for (const getProxyUrl of proxies) {
        try {
          const proxyUrl = getProxyUrl(targetUrl);
          const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(5000), // 5 seconds per proxy try
          });
          if (res.ok) {
            const text = await res.text();
            if (text && text.length > 200) {
              return text;
            }
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[CineVault Client Bypasser] Proxy attempt failed for ${targetUrl}:`, err);
        }
      }
      throw lastErr || new Error(`Failed to fetch ${targetUrl} via all CORS proxies`);
    };

    let currentUrl = url;
    let html = "";
    let fetchSuccess = false;

    // Step 1: Resolve MDrive to HubCloud
    if (currentUrl.includes("mdrive") || currentUrl.includes("moviedrive")) {
      try {
        console.log(`[CineVault Client Bypasser] Hop 1: Fetching MDrive: ${currentUrl}`);
        html = await fetchViaProxy(currentUrl);
        
        const hubcloudRegex = /href=["'](https?:\/\/[^"']*(?:hubcloud|hubcdn|hub\.)[^"']+\/drive\/[^"']+)["']/i;
        const match = html.match(hubcloudRegex);
        if (match) {
          currentUrl = match[1];
          console.log(`[CineVault Client Bypasser] Hop 1 Success: Found HubCloud: ${currentUrl}`);
        } else {
          const hubcloudRegexFallback = /(https?:\/\/[^"'\s]*(?:hubcloud|hubcdn|hub\.)[^"'\s]+\/drive\/[^\s"'\>]+)/i;
          const matchFallback = html.match(hubcloudRegexFallback);
          if (matchFallback) {
            currentUrl = matchFallback[1];
            console.log(`[CineVault Client Bypasser] Hop 1 Success (fallback): Found HubCloud: ${currentUrl}`);
          }
        }
      } catch (err) {
        console.warn(`[CineVault Client Bypasser] Hop 1 Failed to fetch MDrive page:`, err);
      }
    }

    // Step 2: Resolve HubCloud to gamerxyt PHP Redirect
    if (currentUrl.includes("hubcloud") || currentUrl.includes("hubcdn") || currentUrl.includes("hub.")) {
      try {
        console.log(`[CineVault Client Bypasser] Hop 2: Fetching HubCloud: ${currentUrl}`);
        html = await fetchViaProxy(currentUrl);

        const phpLinkRegex = /href=["'](https?:\/\/[^"']+\/hubcloud\.php\?[^"']+)["']/i;
        const match = html.match(phpLinkRegex);
        if (match) {
          currentUrl = match[1];
          console.log(`[CineVault Client Bypasser] Hop 2 Success: Found PHP download target: ${currentUrl}`);
        } else {
          const phpLinkRegexFallback = /(https?:\/\/[^"'\s]+\/hubcloud\.php\?[^\s"'\>]+)/i;
          const matchFallback = html.match(phpLinkRegexFallback);
          if (matchFallback) {
            currentUrl = matchFallback[1];
            console.log(`[CineVault Client Bypasser] Hop 2 Success (fallback): Found PHP download target: ${currentUrl}`);
          }
        }
      } catch (err) {
        console.warn(`[CineVault Client Bypasser] Hop 2 Failed to fetch HubCloud page:`, err);
      }
    }

    // Step 3: Fetch final PHP page to extract links
    try {
      console.log(`[CineVault Client Bypasser] Hop 3: Fetching final page: ${currentUrl}`);
      html = await fetchViaProxy(currentUrl);
      fetchSuccess = true;
    } catch (err) {
      console.warn(`[CineVault Client Bypasser] Hop 3 Failed, falling back to parsing last loaded HTML:`, err);
      if (html && html.length > 200) {
        fetchSuccess = true;
      }
    }

    if (!fetchSuccess || !html) {
      return { success: false, error: "Client-side scraping failed to retrieve chain pages." };
    }

    const streamsMap = new Map<string, string>();
    const subtitlesList: { label: string; src: string }[] = [];

    const cleanUrl = (linkStr: string): string => {
      return linkStr.replace(/\\/g, "").trim();
    };

    const detectQuality = (urlStr: string, context?: string): string => {
      const fullText = `${urlStr} ${context || ""}`.toLowerCase();
      if (fullText.includes("4k") || fullText.includes("2160p") || fullText.includes("2160") || fullText.includes("uhd")) return "4K";
      if (fullText.includes("1080p") || fullText.includes("1080") || fullText.includes("fhd") || fullText.includes("1920x1080")) return "1080p";
      if (fullText.includes("720p") || fullText.includes("720") || fullText.includes("hd") || fullText.includes("1280x720")) return "720p";
      if (fullText.includes("480p") || fullText.includes("480") || fullText.includes("sd") || fullText.includes("854x480")) return "480p";
      return "Source";
    };

    // 1. Scan anchors for download buttons and qualities (handling empty button text with href patterns)
    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let anchorMatch;
    while ((anchorMatch = anchorRegex.exec(html)) !== null) {
      const linkUrl = anchorMatch[1];
      const linkText = anchorMatch[2].replace(/<[^>]*>/g, "").trim();
      const lowerText = linkText.toLowerCase();

      if (
        (lowerText.includes("download") || lowerText.includes("direct") || lowerText.includes("server") || lowerText.includes("pixel") || lowerText.includes("buzz") || lowerText.includes("fsl") || /whistle|pixeldrain|bzzhr/i.test(linkUrl)) &&
        !linkUrl.includes("google.com") && !linkUrl.includes("facebook.com") && !linkUrl.includes("twitter.com") && !linkUrl.includes("telegram")
      ) {
        const cleanL = cleanUrl(linkUrl);
        if (cleanL.startsWith("http")) {
          let label = "Source";
          if (lowerText.includes("fsl") || cleanL.includes("whistle")) label = "FSL Server";
          else if (lowerText.includes("pixel") || cleanL.includes("pixeldrain")) label = "Pixel Server";
          else if (lowerText.includes("buzz") || cleanL.includes("bzzhr")) label = "Buzz Server";
          else if (lowerText.includes("direct")) label = "Direct Link";
          else if (lowerText.includes("1080p") || lowerText.includes("1080")) label = "1080p";
          else if (lowerText.includes("720p") || lowerText.includes("720")) label = "720p";
          else if (lowerText.includes("480p") || lowerText.includes("480")) label = "480p";
          else if (lowerText.includes("4k") || lowerText.includes("2160")) label = "4K";
          
          streamsMap.set(label, cleanL);
        }
      }
    }

    // 2. Scan Javascript structures or script blocks for video links and qualities
    const jsPatterns = [
      /(?:link|dlink|url|file|src)_(480p|720p|1080p|4k|2160p)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi,
      /['"]?(480p|720p|1080p|4k|2160p)['"]?\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi,
      /(?:file|fileUrl|downloadUrl|src|videoUrl|streamUrl)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi
    ];

    for (const pattern of jsPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(html)) !== null) {
        if (match.length >= 3) {
          const qualityLabel = match[1].toUpperCase() === "4K" ? "4K" : match[1].toLowerCase();
          const rawUrl = cleanUrl(match[2]);
          if (rawUrl.startsWith("http")) {
            streamsMap.set(qualityLabel, rawUrl);
          }
        } else if (match.length === 2) {
          const rawUrl = cleanUrl(match[1]);
          if (rawUrl.startsWith("http") && /\.(?:mp4|mkv|avi|webm|mov)(?:\?|$)/i.test(rawUrl)) {
            const quality = detectQuality(rawUrl);
            if (!streamsMap.has(quality)) {
              streamsMap.set(quality, rawUrl);
            }
          }
        }
      }
    }

    // 3. Scan all absolute video URLs in source HTML
    const directVideoRegex = /(https?:\/\/[^\s'"]+\.(?:mp4|mkv|avi|webm|mov)(?:\?[^\s'"]*)?)/gi;
    let videoMatch;
    while ((videoMatch = directVideoRegex.exec(html)) !== null) {
      const rawUrl = cleanUrl(videoMatch[1]);
      const quality = detectQuality(rawUrl);
      if (!streamsMap.has(quality)) {
        streamsMap.set(quality, rawUrl);
      }
    }

    // 4. Subtitle extraction (.vtt / .srt)
    const trackRegex = /<track\s+[^>]*src=["'](https?:\/\/[^"']+\.(?:vtt|srt)(?:\?[^"']*)?)['"]/gi;
    let trackMatch;
    while ((trackMatch = trackRegex.exec(html)) !== null) {
      const subUrl = cleanUrl(trackMatch[1]);
      const labelMatch = trackMatch[0].match(/label=["']([^"']+)["']/i);
      const subLabel = labelMatch ? labelMatch[1] : `Subtitles ${subtitlesList.length + 1}`;
      subtitlesList.push({ label: subLabel, src: subUrl });
    }

    const subUrlRegex = /(https?:\/\/[^\s'"]+\.(?:vtt|srt)(?:\?[^\s'"]*)?)/gi;
    let subUrlMatch;
    while ((subUrlMatch = subUrlRegex.exec(html)) !== null) {
      const subUrl = cleanUrl(subUrlMatch[1]);
      if (!subtitlesList.some(s => s.src === subUrl)) {
        let label = "English";
        const subPath = subUrl.toLowerCase();
        if (subPath.includes("/es") || subPath.includes("spanish")) label = "Spanish";
        else if (subPath.includes("/fr") || subPath.includes("french")) label = "French";
        else if (subPath.includes("/hi") || subPath.includes("hindi")) label = "Hindi";
        else if (subPath.includes("/ar") || subPath.includes("arabic")) label = "Arabic";
        else if (subPath.includes("/pt") || subPath.includes("portuguese")) label = "Portuguese";
        else label = `Subtitles ${subtitlesList.length + 1}`;
        subtitlesList.push({ label, src: subUrl });
      }
    }

    const streams = Array.from(streamsMap.entries()).map(([quality, url]) => ({
      quality,
      url,
    }));

    const qualityOrder: Record<string, number> = {
      "FSL Server": 1,
      "Direct Link": 2,
      "4K": 3,
      "1080p": 4,
      "720p": 5,
      "480p": 6,
      "Pixel Server": 7,
      "Buzz Server": 8,
      "Source": 9
    };
    
    streams.sort((a, b) => {
      const orderA = qualityOrder[a.quality] || 15;
      const orderB = qualityOrder[b.quality] || 15;
      return orderA - orderB;
    });

    return {
      success: streams.length > 0,
      streams: streams.length > 0 ? streams : undefined,
      subtitles: subtitlesList.length > 0 ? subtitlesList : undefined,
    };
  } catch (error: any) {
    console.error("[CineVault Client Bypasser] Error during client scraping:", error);
    return { success: false, error: error.message || String(error) };
  }
}
