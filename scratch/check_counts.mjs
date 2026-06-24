import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://your-supabase-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key",
  { auth: { persistSession: false } }
);

async function main() {
  // Use head: true with count to get accurate counts via the API
  const queries = {
    total: supabase.from("movies").select("*", { count: "exact", head: true }),
    "4k": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("quality", "4k"),
    "FHD": supabase.from("movies").select("*", { count: "exact", head: true }).eq("quality", "FHD"),
    "HD": supabase.from("movies").select("*", { count: "exact", head: true }).eq("quality", "HD"),
    "Netflix (exact)": supabase.from("movies").select("*", { count: "exact", head: true }).eq("platform", "Netflix"),
    "Netflix (ilike)": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%netflix%"),
    "Amazon (exact)": supabase.from("movies").select("*", { count: "exact", head: true }).eq("platform", "Amazon"),
    "Amazon (ilike)": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%amazon%"),
    "Amazon Prime Video": supabase.from("movies").select("*", { count: "exact", head: true }).eq("platform", "Amazon Prime Video"),
    "Disney": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%disney%"),
    "Jio HotStar": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%hotstar%"),
    "HBO Max": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%hbo%"),
    "Apple TV": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("platform", "%apple%"),
    "Bollywood": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "Bollywood"),
    "Hollywood": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "Hollywood"),
    "South Indian": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "South Indian"),
    "Korean": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "Korean"),
    "Bengali": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "Bengali"),
    "Anime": supabase.from("movies").select("*", { count: "exact", head: true }).eq("category", "Anime"),
    "type=movie": supabase.from("movies").select("*", { count: "exact", head: true }).eq("type", "movie"),
    "type=series": supabase.from("movies").select("*", { count: "exact", head: true }).eq("type", "series"),
    "null_category": supabase.from("movies").select("*", { count: "exact", head: true }).is("category", null),
    "null_platform": supabase.from("movies").select("*", { count: "exact", head: true }).is("platform", null),
    "null_type": supabase.from("movies").select("*", { count: "exact", head: true }).is("type", null),
    "adult (ilike)": supabase.from("movies").select("*", { count: "exact", head: true }).ilike("category", "%adult%"),
  };

  console.log("\n=== ACCURATE COUNTS (using head:true) ===\n");
  for (const [label, promise] of Object.entries(queries)) {
    const { count, error } = await promise;
    console.log(`  ${label}: ${count ?? "ERROR: " + error?.message}`);
  }

  // Also check distinct platform values
  const { data: platformSamples } = await supabase
    .from("movies")
    .select("platform")
    .not("platform", "is", null)
    .limit(20);
  
  const uniquePlatforms = [...new Set((platformSamples || []).map(r => r.platform))];
  console.log("\n=== SAMPLE DISTINCT PLATFORMS ===");
  console.log(uniquePlatforms);

  // Check distinct category values from a broader range
  const { data: catSamples } = await supabase
    .from("movies")
    .select("category")
    .not("category", "is", null)
    .limit(20);
  
  const uniqueCats = [...new Set((catSamples || []).map(r => r.category))];
  console.log("\n=== SAMPLE DISTINCT CATEGORIES ===");
  console.log(uniqueCats);
}

main().catch(console.error);
