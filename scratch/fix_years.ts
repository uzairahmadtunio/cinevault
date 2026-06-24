import { createClient } from "@supabase/supabase-js";

const client = createClient(
  process.env.SUPABASE_URL || "https://your-supabase-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key"
);

async function main() {
  console.log("Fetching all movies to check years...");
  const { data: movies, error } = await client
    .from("movies")
    .select("id, title, year");

  if (error) {
    console.error("Error fetching movies:", error);
    return;
  }

  console.log(`Found ${movies.length} movies.`);
  let fixed = 0;
  for (const movie of movies) {
    const title = movie.title || "";
    const yearMatch = title.match(/\((19\d{2}|20\d{2})\)/);
    if (yearMatch) {
      const titleYear = parseInt(yearMatch[1]);
      if (movie.year !== titleYear) {
        console.log(`Fixing '${title.substring(0, 60)}...' year: ${movie.year} → ${titleYear}`);
        const { error: updateError } = await client
          .from("movies")
          .update({ year: titleYear })
          .eq("id", movie.id);
        if (updateError) {
          console.error(`Error updating:`, updateError);
        } else {
          fixed++;
        }
      }
    }
  }
  console.log(`Done. Fixed ${fixed} movies.`);
}

main();
