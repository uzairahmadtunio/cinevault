import { toJSONAsync, fromCrossJSON } from 'seroval';

const BASE = 'https://3movie-cinevault.vercel.app';
const FN = {
  fetchMovieById: '0768672f04c56c4687bfd00e74b4c43d8e6b6e6ffb8e189338472a7a624c7e95',
  fetchMoviesPaginated: 'aef90e1a10d47e05927b40d4ee2d406217f28d62c1a82ef5ccd5c719c6a6980d',
  fetchSearchIndex: '6470d4fdc982498646ebbe8f921d7f4583894258251071545771612523e72c11',
};

async function call(id, data) {
  const body = JSON.stringify(await toJSONAsync({ data }));
  const res = await fetch(`${BASE}/_serverFn/${id}`, {
    method: 'POST',
    headers: {
      'x-tsr-serverFn': 'true',
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) return { httpError: res.status, text: text.slice(0, 300) };
  try {
    return fromCrossJSON(JSON.parse(text));
  } catch (e) {
    return { parseError: String(e), text: text.slice(0, 500) };
  }
}

async function main() {
  for (const mid of ['7014', '6210', '29']) {
    const r = await call(FN.fetchMovieById, { id: mid });
    const mv = r?.movie;
    if (!mv) {
      console.log(`ID ${mid}: NO MOVIE`, JSON.stringify(r).slice(0, 300));
      continue;
    }
    console.log(`ID ${mid}: title=${JSON.stringify(mv.title)} year=${mv.year} type=${mv.type}`);
    console.log(`   tmdb_id=${JSON.stringify(mv.tmdb_id)} imdb_id=${JSON.stringify(mv.imdb_id)}`);
    console.log(`   keys: ${Object.keys(mv).join(',')}`);
  }
}

main().catch((e) => console.error('FATAL', e));
