import { toJSONAsync } from 'seroval';
const body = JSON.stringify(await toJSONAsync({ data: { mode: 'all', page: 1, limit: 2, sort: 'latest' } }));
const res = await fetch('https://3movie-cinevault.vercel.app/_serverFn/aef90e1a10d47e05927b40d4ee2d406217f28d62c1a82ef5ccd5c719c6a6980d', { method: 'POST', headers: { 'x-tsr-serverFn': 'true', 'content-type': 'application/json', accept: 'application/json' }, body });
const j = JSON.parse(await res.text());
const result = j.p.v[0];
console.log('result keys:', result.p.k);
const moviesNode = result.p.v[result.p.k.indexOf('movies')];
console.log('movies node:', JSON.stringify(moviesNode).slice(0, 400));
