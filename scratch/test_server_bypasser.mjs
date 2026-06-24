async function extractDirectLink(url) {
  try {
    console.log(`extractDirectLink: starting secure chained bypass for ${url}`);

    const USER_AGENTS = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ];

    const fetchPage = async (pageUrl, referer) => {
      const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const fetchHeaders = {
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
          console.log(`Fetching page: ${pageUrl} (attempt ${attempt + 1})`);
          const response = await fetch(pageUrl, {
            headers: fetchHeaders,
            redirect: "follow",
            signal: AbortSignal.timeout(4000),
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
        } catch (err) {
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
    } catch (chainErr) {
      console.warn("extractDirectLink: chain resolution interrupted:", chainErr);
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

    const streamsMap = new Map();
    const subtitlesList = [];

    const cleanUrl = (linkStr) => {
      return linkStr.replace(/\\/g, "").trim();
    };

    const detectQuality = (urlStr, context) => {
      const fullText = `${urlStr} ${context || ""}`.toLowerCase();
      if (fullText.includes("4k") || fullText.includes("2160p") || fullText.includes("2160") || fullText.includes("uhd")) return "4K";
      if (fullText.includes("1080p") || fullText.includes("1080") || fullText.includes("fhd") || fullText.includes("1920x1080")) return "1080p";
      if (fullText.includes("720p") || fullText.includes("720") || fullText.includes("hd") || fullText.includes("1280x720")) return "720p";
      if (fullText.includes("480p") || fullText.includes("480") || fullText.includes("sd") || fullText.includes("854x480")) return "480p";
      return "Source";
    };

    // 1. Scan for Anchors and check for download buttons
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

    const streams = Array.from(streamsMap.entries()).map(([quality, url]) => ({
      quality,
      url,
    }));

    console.log("Extracted Streams:", streams);
    return streams;

  } catch (error) {
    console.error("extractDirectLink execution error:", error);
  }
}

extractDirectLink('https://mdrive.lol/archive/8701/');
