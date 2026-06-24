import { createClient } from "@supabase/supabase-js";

const client = createClient(
  "https://aisnmcgnblumuniotfcj.supabase.co",
  "sb_publishable_PMYK5d-_oI1VAWWCZ0Ccsw_g9Viso3u"
);

async function main() {
  const { data: movies, error } = await client
    .from("movies")
    .select("id, title, year, imdb_rating, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(movies, null, 2));
  }
}

main();
