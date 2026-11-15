import { toJSONAsync } from 'seroval';

const BASE = 'https://3movie-cinevault.vercel.app';
const FN = {
  paginated: 'aef90e1a10d47e05927b40d4ee2d406217f28d62c1a82ef5ccd5c719c6a6980d',
  byId: '0768672f04c56c4687bfd00e74b4c43d8e6b6e6ffb8e189338472a7a624c7e95',
};

async function call(id, data) {
  const body = JSON.stringify(await toJSONAsync({ data }));
  const res = await fetch(`${BASE}/_serverFn/${id}`, {
    method: 'POST',
    headers: { 'x-tsr-serverFn': 'true', 'content-type': 'application/json', accept: 'application/json' },
    body,
  });
  return JSON.parse(await res.text());
}

// seroval cross-JSON: primitives are {t, s}; objects {t:10, p:{k:[], v:[]}}; arrays {t:?, p:[...]}
function dec(node, refs = new Map()) {
  if (node == null || typeof node !== 'object') return node;
  const { t, i, p, s } = node;
  if (t === 10) {
    const obj = {};
    if (i != null) refs.set(i, obj);
    p.k.forEach((k, idx) => { obj[k] = dec(p.v[idx], refs); });
    return obj;
  }
  if (t === 9) return (node.a ?? []).map((v) => dec(v, refs));
  if (Array.isArray(p)) return p.map((v) => dec(v, refs));
  if (p && typeof p === 'object' && Array.isArray(p.v) && !p.k) return p.v.map((v) => dec(v, refs));
  if ('s' in node) return s;
  if (i != null && refs.has(i)) return refs.get(i);
  return node;
}

async function main() {
  const page = dec(JSON.parse(JSON.stringify(await call(FN.paginated, { mode: 'all', page: 1, limit: 20, sort: 'latest' }))));
  const result = page.result ?? page;
  console.log('TOTAL:', result.total);
  console.log('--- SAMPLE 20 (latest) ---');
  for (const m of result.movies ?? []) {
    console.log(`id=${m.id} type=${m.type} year=${m.year} tmdb_id=${m.tmdb_id} imdb_id=${m.imdb_id} title=${String(m.title).slice(0, 70)}`);
  }
  const mon = dec(await call(FN.byId, { id: '6210' }));
  const mv = (mon.result ?? mon).movie;
  console.log('--- MONARCH 6210 keys ---');
  console.log(Object.keys(mv).join(','));
  console.log('title:', mv.title, '| type:', mv.type, '| year:', mv.year, '| season:', mv.season, '| season_number:', mv.season_number);
}

main().catch((e) => console.error('FATAL', e));
