import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, title, year')
    .ilike('title', '%Good Luck Chuck%');
  
  if (error) {
    console.error(error);
    return;
  }

  movies.forEach(m => {
    const match = m.title.match(/\(((?:19|20)\d{2})\)/);
    console.log(`Title: "${m.title}", Year: ${m.year}, Match: ${match ? match[1] : 'null'}`);
  });
}

main();
