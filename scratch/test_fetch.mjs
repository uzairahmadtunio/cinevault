async function bypassChain(url) {
  console.log(`Starting bypass chain for: ${url}`);
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': url
    };

    let targetUrl = url;

    // Step 1: If it's an mdrive link, fetch and look for hubcloud links
    if (targetUrl.includes('mdrive') || targetUrl.includes('moviedrive')) {
      console.log('Step 1: Fetching MDrive page...');
      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      
      // Find hubcloud drive link
      const hubcloudRegex = /href=["'](https?:\/\/[^"']*(?:hubcloud|hubcdn|hub\.)[^"']+\/drive\/[^"']+)["']/i;
      const match = html.match(hubcloudRegex);
      if (match) {
        targetUrl = match[1];
        console.log(`Step 1 Success: Found HubCloud URL: ${targetUrl}`);
      } else {
        console.log('Step 1: No HubCloud URL found in MDrive page.');
        // Maybe check generic links
      }
    }

    // Step 2: If we have a HubCloud link, fetch it and look for the gamerxyt or hubcloud.php link
    if (targetUrl.includes('hubcloud') || targetUrl.includes('hubcdn') || targetUrl.includes('hub.')) {
      console.log(`Step 2: Fetching HubCloud page: ${targetUrl}`);
      const res = await fetch(targetUrl, { headers });
      const html = await res.text();

      // Find gamerxyt or similar link
      const phpLinkRegex = /href=["'](https?:\/\/[^"']+\/hubcloud\.php\?[^"']+)["']/i;
      const match = html.match(phpLinkRegex);
      if (match) {
        targetUrl = match[1];
        console.log(`Step 2 Success: Found PHP Download page: ${targetUrl}`);
      } else {
        console.log('Step 2: No php redirect found in HubCloud page.');
      }
    }

    // Step 3: Fetch the final PHP page and extract direct download links
    if (targetUrl.includes('hubcloud.php')) {
      console.log(`Step 3: Fetching final PHP page: ${targetUrl}`);
      const res = await fetch(targetUrl, { headers });
      const html = await res.text();

      const streams = [];

      // Find FSL Server (whistle.lat / etc)
      const fslRegex = /href=["'](https?:\/\/[^"']*(?:whistle|hubcloud|dl)[^"']+)["'][^>]*>Download\s*\[FSL/i;
      const fslMatch = html.match(fslRegex);
      if (fslMatch) {
        streams.push({ quality: 'FSL Server', url: fslMatch[1] });
      }

      // Let's also search for all links that look like download buttons
      const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let m;
      while ((m = anchorRegex.exec(html)) !== null) {
        const linkUrl = m[1];
        const linkText = m[2].replace(/<[^>]*>/g, '').trim();
        if (linkText.toLowerCase().includes('download') && !linkUrl.includes('google.com') && !linkUrl.includes('facebook') && !linkUrl.includes('twitter')) {
          streams.push({ quality: linkText, url: linkUrl });
        }
      }

      console.log('Step 3 Success: Extracted streams:', streams);
      return streams;
    }

    console.log('Could not resolve through the standard chain.');
    return [];

  } catch (err) {
    console.error('Bypass chain error:', err);
    return [];
  }
}

async function run() {
  await bypassChain('https://mdrive.lol/archive/8701/');
}

run();
