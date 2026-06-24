import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://your-supabase-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key",
  { auth: { persistSession: false } }
);

async function main() {
  // Get total count
  const { count: total } = await supabase.from("movies").select("*", { count: "exact", head: true });
  console.log(`\nTotal movies: ${total}`);

  // Get distinct categories
  const { data: cats } = await supabase.from("movies").select("category").limit(5000);
  const catCounts = {};
  (cats || []).forEach(r => {
    const c = r.category || "(null)";
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  console.log("\n--- CATEGORIES ---");
  Object.entries(catCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Get distinct platforms
  const { data: plats } = await supabase.from("movies").select("platform").limit(5000);
  const platCounts = {};
  (plats || []).forEach(r => {
    const p = r.platform || "(null)";
    platCounts[p] = (platCounts[p] || 0) + 1;
  });
  console.log("\n--- PLATFORMS ---");
  Object.entries(platCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Get distinct types
  const { data: types } = await supabase.from("movies").select("type").limit(5000);
  const typeCounts = {};
  (types || []).forEach(r => {
    const t = r.type || "(null)";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  console.log("\n--- TYPES ---");
  Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Get distinct qualities
  const { data: quals } = await supabase.from("movies").select("quality").limit(5000);
  const qualCounts = {};
  (quals || []).forEach(r => {
    const q = r.quality || "(null)";
    qualCounts[q] = (qualCounts[q] || 0) + 1;
  });
  console.log("\n--- QUALITIES ---");
  Object.entries(qualCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Check for genre / tags columns
  const { data: sample } = await supabase.from("movies").select("*").limit(1);
  if (sample && sample[0]) {
    console.log("\n--- SAMPLE ROW KEYS ---");
    console.log(Object.keys(sample[0]).join(", "));
  }
}

main().catch(console.error);
