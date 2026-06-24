async function testMore() {
  const url = 'https://mdrive.lol/archive/8701/';
  const targets = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
    `https://cors-anywhere.herokuapp.com/${url}`
  ];

  for (const t of targets) {
    console.log('Testing proxy:', t);
    try {
      const res = await fetch(t, { signal: AbortSignal.timeout(6000) });
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Length:', text.length);
      console.log('Snippet:', text.slice(0, 200));
    } catch (err) {
      console.log('Error:', err.message);
    }
    console.log('------------------------------------');
  }
}

testMore();
