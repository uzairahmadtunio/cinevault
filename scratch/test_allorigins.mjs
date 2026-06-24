async function testAllOrigins() {
  const url = 'https://mdrive.lol/archive/8701/';
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  console.log('Testing api.allorigins.win/get with 10s timeout...');
  try {
    const res = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(10000)
    });
    console.log('Status:', res.status);
    const data = await res.json();
    const html = data.contents;
    console.log('HTML Length:', html ? html.length : 0);
    console.log('HTML Snippet:', html ? html.slice(0, 300) : 'null');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testAllOrigins();
