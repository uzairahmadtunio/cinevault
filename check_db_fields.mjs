import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://aisnmcgnblumuniotfcj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_PMYK5d-_oI1VAWWCZ0Ccsw_g9Viso3u';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: movies, error } = await supabase
    .from('movies')
    .select('*')
    .limit(5);

  if (error) {
    console.error('Supabase movies query failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      status: error.status,
      stack: error.stack,
    });
    return;
  }

  console.log(JSON.stringify(movies, null, 2));
}

main();
