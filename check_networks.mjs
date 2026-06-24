import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count, error } = await supabase
    .from('movies')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total rows in database: ${count}`);
}

main();
