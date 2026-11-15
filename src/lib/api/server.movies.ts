import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminClient } from "@/lib/supabase.server";

// Paginated fetch with filtering, sorting, search, genres, and years
export const fetchMoviesPaginated = createServerFn({ method: "POST" })
  .validator(z.object({
    mode: z.enum(["all", "trending", "featured", "search"]).optional().default("all"),
    page: z.number().int().positive().optional().default(1),
    filter: z.string().optional(),
    search: z.string().optional(),
    sort: z.enum(["latest", "oldest", "top-rated", "a-z"]).optional().default("latest"),
    limit: z.number().int().positive().optional().default(20),
    genres: z.string().optional(),
    years: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const page = data.page || 1;
      const mode = data.mode || "all";
      const filter = data.filter || "";
      const search = data.search || "";
      const sort = data.sort || "latest";
      const limit = data.limit || 20;
      const offset = (page - 1) * limit;

      let query = adminClient.from("movies").select("*", { count: "exact" });

      if (mode === "trending") {
        query = query.eq("is_trending", true);
      } else if (mode === "featured") {
        query = query.eq("is_featured", true);
      }

      // Default catalog view should not impose strict table-level filters that can empty the result set.
      const hasDefaultView = !filter && !search.trim() && !data.genres && !data.years && mode === "all";

      // Apply filter categories (quality / platform / category / type)
      if (!hasDefaultView) {
        if (filter.toLowerCase() === "4k" || filter.includes("4K")) {
          query = query.ilike("quality", "4k");
        } else if (filter === "FHD") {
          query = query.eq("quality", "FHD");
        } else if (filter === "Netflix") {
          query = query.eq("platform", "Netflix");
        } else if (filter === "Bollywood") {
          query = query.eq("category", "Bollywood");
        } else if (filter === "Hollywood") {
          query = query.eq("category", "Hollywood");
        } else if (filter === "South") {
          query = query.eq("category", "South Indian");
        } else if (filter === "Korean") {
          query = query.eq("category", "Korean");
        } else if (filter === "Bengali") {
          query = query.eq("category", "Bengali");
        } else if (filter === "Anime") {
          query = query.eq("category", "Anime");
        } else if (filter === "Series") {
          query = query.eq("type", "series");
        }
      }

      // Apply genre filters (OR filtering - match any genre)
      if (data.genres) {
        const genreList = data.genres.split(",").map(g => g.trim()).filter(Boolean);
        if (genreList.length > 0) {
          const orConditions = genreList.map(g => `genre.ilike.%${g}%`).join(",");
          query = query.or(orConditions);
        }
      }

      // Apply release year filters
      if (data.years) {
        const yearList = data.years.split(",").map(y => parseInt(y.trim())).filter(y => !isNaN(y));
        if (yearList.length > 0) {
          query = query.in("year", yearList);
        }
      }

      // Apply search
      if (search.trim()) {
        query = query.ilike("title", `%${search}%`);
      }

      // If search mode is requested, keep the search-only behavior while preserving mode-based filters.
      if (mode === "search" && !search.trim()) {
        // no-op: search mode still falls back to the existing search filter if empty
      }

      // Apply sorting
      if (sort === "oldest") {
        query = query.order("year", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
      } else if (sort === "top-rated") {
        query = query.order("imdb_rating", { ascending: false, nullsFirst: false }).order("year", { ascending: false }).order("created_at", { ascending: false });
      } else if (sort === "a-z") {
        query = query.order("title", { ascending: true }).order("created_at", { ascending: false });
      } else {
        // "latest" (default): newest records first, while keeping the full catalog visible by default.
        query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      }

      // Apply pagination
      const { data: rows, count, error } = await query.range(offset, offset + limit - 1);
      if (error) {
        console.error(
          "Supabase fetchMoviesPaginated query failed:",
          JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        );
        return { movies: [], total: 0, page, limit };
      }

      console.log("Fetched movies count:", rows?.length ?? 0);
      return { movies: rows || [], total: count || 0, page, limit };
    } catch (err) {
      console.error("fetchMoviesPaginated error:", err instanceof Error ? err.stack ?? err.message : err);
      return { movies: [], total: 0, page: 1, limit: 20 };
    }
  });

// Get counts for each filter
export const getFilterCounts = createServerFn({ method: "POST" })
  .validator(z.object({}))
  .handler(async () => {
    try {
      const [allRes, k4Res, fhdRes, netflixRes, bollywoodRes, hollywoodRes, southRes, koreanRes, bengaliRes, animeRes, seriesRes] = await Promise.all([
        adminClient.from("movies").select("*", { count: "exact", head: true }),
        adminClient.from("movies").select("*", { count: "exact", head: true }).ilike("quality", "4k"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("quality", "FHD"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("platform", "Netflix"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "Bollywood"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "Hollywood"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "South Indian"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "Korean"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "Bengali"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("category", "Anime"),
        adminClient.from("movies").select("*", { count: "exact", head: true }).eq("type", "series"),
      ]);

      return {
        all: allRes.count || 0,
        "4k": k4Res.count || 0,
        k4: k4Res.count || 0,
        fhd: fhdRes.count || 0,
        netflix: netflixRes.count || 0,
        bollywood: bollywoodRes.count || 0,
        hollywood: hollywoodRes.count || 0,
        south: southRes.count || 0,
        korean: koreanRes.count || 0,
        bengali: bengaliRes.count || 0,
        anime: animeRes.count || 0,
        series: seriesRes.count || 0,
      };
    } catch (err) {
      console.error("getFilterCounts error", err);
      return {
        all: 0,
        "4k": 0,
        k4: 0,
        fhd: 0,
        netflix: 0,
        bollywood: 0,
        hollywood: 0,
        south: 0,
        korean: 0,
        bengali: 0,
        anime: 0,
        series: 0,
      };
    }
  });

// Legacy fetchMovies for backwards compatibility
const fetchMoviesInput = z.object({
  mode: z.enum(["all", "trending", "featured", "search"]).optional(),
  q: z.string().nullable().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const fetchMovies = createServerFn({ method: "POST" })
  .validator(fetchMoviesInput)
  .handler(async ({ data }) => {
    const mode = data.mode || "all";
    const limit = data.limit || 1000;
    const offset = data.offset || 0;
    try {
      if (mode === "trending") {
        let allRows: any[] = [];
        let currentOffset = offset;
        let remainingLimit = limit;
        let count = 0;
        while (remainingLimit > 0) {
          const batchSize = Math.min(remainingLimit, 1000);
          const { data: batchRows, count: exactCount } = await adminClient
            .from("movies")
            .select("*", { count: "exact" })
            .eq("is_trending", true)
            .order("created_at", { ascending: false })
            .range(currentOffset, currentOffset + batchSize - 1);
          if (exactCount) count = exactCount;
          if (!batchRows || batchRows.length === 0) break;
          allRows = [...allRows, ...batchRows];
          currentOffset += batchRows.length;
          remainingLimit -= batchRows.length;
          if (batchRows.length < batchSize) break;
        }
        return { movies: allRows, count };
      }
      if (mode === "featured") {
        let allRows: any[] = [];
        let currentOffset = offset;
        let remainingLimit = limit;
        let count = 0;
        while (remainingLimit > 0) {
          const batchSize = Math.min(remainingLimit, 1000);
          const { data: batchRows, count: exactCount } = await adminClient
            .from("movies")
            .select("*", { count: "exact" })
            .eq("is_featured", true)
            .order("created_at", { ascending: false })
            .range(currentOffset, currentOffset + batchSize - 1);
          if (exactCount) count = exactCount;
          if (!batchRows || batchRows.length === 0) break;
          allRows = [...allRows, ...batchRows];
          currentOffset += batchRows.length;
          remainingLimit -= batchRows.length;
          if (batchRows.length < batchSize) break;
        }
        return { movies: allRows, count };
      }
      if (mode === "search") {
        const q = data.q || "";
        let allRows: any[] = [];
        let currentOffset = offset;
        let remainingLimit = limit;
        let count = 0;
        while (remainingLimit > 0) {
          const batchSize = Math.min(remainingLimit, 1000);
          const { data: batchRows, count: exactCount } = await adminClient
            .from("movies")
            .select("*", { count: "exact" })
            .ilike("title", `%${q}%`)
            .order("created_at", { ascending: false })
            .range(currentOffset, currentOffset + batchSize - 1);
          if (exactCount) count = exactCount;
          if (!batchRows || batchRows.length === 0) break;
          allRows = [...allRows, ...batchRows];
          currentOffset += batchRows.length;
          remainingLimit -= batchRows.length;
          if (batchRows.length < batchSize) break;
        }
        return { movies: allRows, count };
      }
      // default: all ordered by created_at desc
      let allRows: any[] = [];
      let currentOffset = offset;
      let remainingLimit = limit;
      let count = 0;
      while (remainingLimit > 0) {
        const batchSize = Math.min(remainingLimit, 1000);
        const { data: batchRows, count: exactCount } = await adminClient
          .from("movies")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + batchSize - 1);
        if (exactCount) count = exactCount;
        if (!batchRows || batchRows.length === 0) break;
        allRows = [...allRows, ...batchRows];
        currentOffset += batchRows.length;
        remainingLimit -= batchRows.length;
        if (batchRows.length < batchSize) break;
      }
      return { movies: allRows, count };
    } catch (err) {
      console.error("fetchMovies error", err);
      return { movies: [], count: 0 };
    }
  });

export const fetchMovieById = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      const { data: row } = await adminClient.from("movies").select("*").eq("id", data.id).maybeSingle();
      return { movie: row || null };
    } catch (err) {
      console.error("fetchMovieById error", err);
      return { movie: null };
    }
  });

export const fetchFeaturedOrLatest = createServerFn({ method: "POST" })
  .validator(z.object({ limit: z.number().int().positive().optional() }))
  .handler(async ({ data }) => {
    const limit = data.limit || 8;
    try {
      // First try featured
      const { data: featured } = await adminClient
        .from("movies")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (featured && featured.length > 0) {
        return { movies: featured };
      }
      
      // Fallback to latest
      const { data: latest } = await adminClient
        .from("movies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      
      return { movies: latest || [] };
    } catch (err) {
      console.error("fetchFeaturedOrLatest error", err);
      return { movies: [] };
    }
  });

export const fetchTrendingOrTopRated = createServerFn({ method: "POST" })
  .validator(z.object({ limit: z.number().int().positive().optional() }))
  .handler(async ({ data }) => {
    const limit = data.limit || 8;
    try {
      // First try trending
      const { data: trending } = await adminClient
        .from("movies")
        .select("*")
        .eq("is_trending", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (trending && trending.length > 0) {
        return { movies: trending };
      }
      
      // Fallback to top-rated by IMDb
      const { data: topRated } = await adminClient
        .from("movies")
        .select("*")
        .not("imdb_rating", "is", null)
        .order("imdb_rating", { ascending: false })
        .limit(limit);
      
      return { movies: topRated || [] };
    } catch (err) {
      return {
        all: 0,
        "4k": 0,
        k4: 0,
        fhd: 0,
        netflix: 0,
        bollywood: 0,
        hollywood: 0,
        south: 0,
        korean: 0,
        bengali: 0,
        anime: 0,
        series: 0,
      };
    }
  });

// Lightweight catalog index for the client-side smart search: id/title/poster/year
// for every movie, fetched once by the browser and cached there. No per-keystroke
// queries ever hit the server.
export const fetchSearchIndex = createServerFn({ method: "POST" })
  .validator(z.object({}))
  .handler(async () => {
    try {
      const items: { id: string; title: string; thumbnail: string | null; year: number | null }[] = [];
      const batchSize = 1000;
      let offset = 0;
      while (items.length < 12000) {
        const { data: rows, error } = await adminClient
          .from("movies")
          .select("id, title, thumbnail, year")
          .order("id", { ascending: true })
          .range(offset, offset + batchSize - 1);
        if (error || !rows || rows.length === 0) break;
        for (const r of rows as any[]) {
          items.push({
            id: String(r.id),
            title: r.title || "",
            thumbnail: r.thumbnail ?? null,
            year: r.year ?? null,
          });
        }
        if (rows.length < batchSize) break;
        offset += batchSize;
      }
      return { items };
    } catch (err) {
      console.error("fetchSearchIndex error", err);
      return { items: [] as { id: string; title: string; thumbnail: string | null; year: number | null }[] };
    }
  });

// Extract direct stream or file link from ad-heavy download hosts (supports multi-quality & subtitles)
// Enhanced with HubCloud/MovieDrive specific bypass patterns and resilient fallback mechanisms
export const extractDirectLink = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string() }))
  .handler(async ({ data }) => {
    const { url } = data;
    try {
      console.log(`extractDirectLink: starting secure chained bypass for ${url}`);

      // Rotating User-Agents to avoid serverless IP/UA fingerprint blocks
      const USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ];

      const fetchPage = async (pageUrl: string, referer: string): Promise<{ html: string; finalUrl: string }> => {
        const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const fetchHeaders: any = {
          "User-Agent": randomUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": referer,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
        };

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetch(pageUrl, {
              headers: fetchHeaders,
              redirect: "follow",
              signal: AbortSignal.timeout(4000), // 4s timeout to avoid serverless function execution limits
            });
            
            if (response.ok) {
              const text = await response.text();
              return { html: text, finalUrl: response.url || pageUrl };
            } else if (response.status === 403 || response.status === 429) {
              console.log(`fetchPage: status ${response.status} on ${pageUrl}, retrying...`);
              await new Promise(r => setTimeout(r, 400));
              continue;
            } else {
              throw new Error(`Target page fetch failed with status ${response.status}`);
            }
          } catch (err: any) {
            if (attempt < 1) {
              await new Promise(r => setTimeout(r, 300));
              continue;
            }
            throw err;
          }
        }
        throw new Error(`Failed to fetch page ${pageUrl}`);
      };

      let currentUrl = url;
      let html = "";
      let fetchSuccess = false;

      // ============================================================
      // MULTI-HOP BYPASS ENGINE CHAIN
      // ============================================================
      try {
        // Hop 1: Resolve MDrive to HubCloud
        if (currentUrl.includes("mdrive") || currentUrl.includes("moviedrive")) {
          console.log(`extractDirectLink [Hop 1]: Resolving MDrive target: ${currentUrl}`);
          const res = await fetchPage(currentUrl, currentUrl);
          html = res.html;
          
          const hubcloudRegex = /href=["'](https?:\/\/[^"']*(?:hubcloud|hubcdn|hub\.)[^"']+\/drive\/[^"']+)["']/i;
          const match = html.match(hubcloudRegex);
          if (match) {
            currentUrl = match[1];
            console.log(`extractDirectLink [Hop 1 Success]: Found HubCloud target: ${currentUrl}`);
          } else {
            const hubcloudRegexFallback = /(https?:\/\/[^"'\s]*(?:hubcloud|hubcdn|hub\.)[^"'\s]+\/drive\/[^\s"'\>]+)/i;
            const matchFallback = html.match(hubcloudRegexFallback);
            if (matchFallback) {
              currentUrl = matchFallback[1];
              console.log(`extractDirectLink [Hop 1 Success (fallback)]: Found HubCloud target: ${currentUrl}`);
            }
          }
        }

        // Hop 2: Resolve HubCloud to gamerxyt PHP Redirect
        if (currentUrl.includes("hubcloud") || currentUrl.includes("hubcdn") || currentUrl.includes("hub.")) {
          console.log(`extractDirectLink [Hop 2]: Resolving HubCloud target: ${currentUrl}`);
          const res = await fetchPage(currentUrl, currentUrl);
          html = res.html;

          const phpLinkRegex = /href=["'](https?:\/\/[^"']+\/hubcloud\.php\?[^"']+)["']/i;
          const match = html.match(phpLinkRegex);
          if (match) {
            currentUrl = match[1];
            console.log(`extractDirectLink [Hop 2 Success]: Found PHP download target: ${currentUrl}`);
          } else {
            const phpLinkRegexFallback = /(https?:\/\/[^"'\s]+\/hubcloud\.php\?[^\s"'\>]+)/i;
            const matchFallback = html.match(phpLinkRegexFallback);
            if (matchFallback) {
              currentUrl = matchFallback[1];
              console.log(`extractDirectLink [Hop 2 Success (fallback)]: Found PHP download target: ${currentUrl}`);
            }
          }
        }

        // Hop 3: Fetch final PHP direct file links page
        console.log(`extractDirectLink [Hop 3]: Fetching final PHP page: ${currentUrl}`);
        const res = await fetchPage(currentUrl, currentUrl);
        html = res.html;
        fetchSuccess = true;
      } catch (chainErr: any) {
        console.warn("extractDirectLink: chain resolution interrupted, attempting direct page parse fallback:", chainErr);
        // Fallback to fetch whatever the current URL is if chain was partially traversed
        try {
          const res = await fetchPage(currentUrl, url);
          html = res.html;
          fetchSuccess = true;
        } catch (fetchErr) {
          console.error("extractDirectLink: fallback parse fetch failed:", fetchErr);
        }
      }

      if (!fetchSuccess || !html) {
        throw new Error("Unable to fetch any target contents in the resolution chain");
      }

      const streamsMap = new Map<string, string>(); // Label/Quality -> URL
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

      // 1. Scan for Anchors and check for download buttons in the final resolved HTML page
      const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let anchorMatch;
      while ((anchorMatch = anchorRegex.exec(html)) !== null) {
        const linkUrl = anchorMatch[1];
        const linkText = anchorMatch[2].replace(/<[^>]*>/g, "").trim();
        const lowerText = linkText.toLowerCase();

        if (
          (lowerText.includes("download") || lowerText.includes("direct") || lowerText.includes("server") || lowerText.includes("pixel") || lowerText.includes("buzz") || lowerText.includes("fsl")) &&
          !linkUrl.includes("google.com") && !linkUrl.includes("facebook") && !linkUrl.includes("twitter") && !linkUrl.includes("telegram")
        ) {
          const cleanL = cleanUrl(linkUrl);
          if (cleanL.startsWith("http")) {
            let label = "Source";
            if (lowerText.includes("fsl")) label = "FSL Server";
            else if (lowerText.includes("pixel")) label = "Pixel Server";
            else if (lowerText.includes("buzz")) label = "Buzz Server";
            else if (lowerText.includes("direct")) label = "Direct Link";
            else if (lowerText.includes("1080p") || lowerText.includes("1080")) label = "1080p";
            else if (lowerText.includes("720p") || lowerText.includes("720")) label = "720p";
            else if (lowerText.includes("480p") || lowerText.includes("480")) label = "480p";
            else if (lowerText.includes("4k") || lowerText.includes("2160")) label = "4K";
            
            streamsMap.set(label, cleanL);
          }
        }
      }

      // 2. Scan Javascript script variables or strings for direct links
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

      // Convert streams map to array format
      const streams = Array.from(streamsMap.entries()).map(([quality, url]) => ({
        quality,
        url,
      }));

      // Sort streams: FSL Server first, then Direct Link, then resolutions, then other servers, then Source
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

      // Default fallback if no streams were found at all — return the original URL as "Source"
      let isFallback = false;
      if (streams.length === 0) {
        streams.push({ quality: "Source", url });
        isFallback = true;
      }

      console.log(`extractDirectLink: completed bypass. Found ${streams.length} streams, isFallback=${isFallback}`);
      return {
        success: true,
        streams,
        isFallback,
        subtitles: subtitlesList.length > 0 ? subtitlesList : undefined,
      };
    } catch (error: any) {
      console.error("extractDirectLink execution error:", error);
      return { 
        success: true, 
        streams: [{ quality: "Source", url }], 
        isFallback: true,
        error: `Extraction failed: ${error.message || String(error)}. Defaulted to source.` 
      };
    }
  });
