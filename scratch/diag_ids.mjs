import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://aisnmcgnblumuniotfcj.supabase.co';
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_PMYK5d-_oI1VAWWCZ0Ccsw_g9Viso3u';

const supabase = createClient(SUPABASE_URL, KEY);

async function countWhere(filterFn) {
  let q = supabase.from('movies').select('id', { count: 'exact', head: true });
  if (filterFn) q = filterFn(q);
  const { count, error } = await q;
  if (error) return { error: error.message };
  return count;
}

async function main() {
  // 1. Column existence probe: select tmdb_id / imdb_id explicitly.
  for (const col of ['tmdb_id', 'imdb_id', 'tmdbId', 'imdbId', 'imdb']) {
    const { data, error } = await supabase.from('movies').select(`id, ${col}`).limit(1);
    if (error) {
      console.log(`COLUMN ${col}: ERROR -> ${error.code} ${error.message}`);
    } else {
      console.log(`COLUMN ${col}: EXISTS, sample value = ${JSON.stringify(data?.[0]?.[col])}`);
    }
  }

  // 2. Coverage counts
  const total = await countWhere(null);
  console.log('TOTAL ROWS:', total);
  const withTmdb = await countWhere((q) => q.not('tmdb_id', 'is', null));
  console.log('ROWS tmdb_id NOT NULL:', withTmdb);
  const withImdb = await countWhere((q) => q.not('imdb_id', 'is', null));
  console.log('ROWS imdb_id NOT NULL:', withImdb);
  const withEither = await countWhere((q) => q.or('tmdb_id.not.is.null,imdb_id.not.is.null'));
  console.log('ROWS either NOT NULL:', withEither);

  // 3. All column names from one full row
  const { data: one, error: e1 } = await supabase.from('movies').select('*').limit(1);
  if (e1) console.log('SELECT * ERROR:', e1.message);
  else console.log('ALL COLUMNS:', Object.keys(one[0]).join(', '));

  // 4. Sample 20 rows
  const { data: sample, error: e2 } = await supabase
    .from('movies')
    .select('id, title, year, type, tmdb_id, imdb_id')
    .order('id', { ascending: true })
    .limit(20);
  if (e2) console.log('SAMPLE ERROR:', e2.message);
  else {
    console.log('--- SAMPLE 20 (by id asc) ---');
    for (const r of sample) console.log(JSON.stringify(r));
  }

  // 5. Sample rows WITH tmdb_id if any exist
  const { data: withRows } = await supabase
    .from('movies')
    .select('id, title, year, type, tmdb_id, imdb_id')
    .not('tmdb_id', 'is', null)
    .limit(10);
  console.log('--- SAMPLE WITH tmdb_id ---');
  console.log(JSON.stringify(withRows, null, 1));

  // 6. Specific gate titles: MobLand rows + Monarch 6210
  const { data: mob } = await supabase
    .from('movies')
    .select('id, title, year, type, tmdb_id, imdb_id')
    .ilike('title', '%MobLand%');
  console.log('--- MobLand rows ---');
  console.log(JSON.stringify(mob, null, 1));
  const { data: mon } = await supabase
    .from('movies')
    .select('id, title, year, type, tmdb_id, imdb_id')
    .eq('id', 6210);
  console.log('--- Monarch 6210 ---');
  console.log(JSON.stringify(mon, null, 1));
}

main().catch((e) => console.error('FATAL', e));
