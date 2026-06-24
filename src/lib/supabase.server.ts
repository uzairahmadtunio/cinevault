import { createClient } from "@supabase/supabase-js";
import { getServerConfig } from "./config.server";

const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing server-side Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export async function getUserFromToken(accessToken: string) {
  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error("Invalid or expired session token.");
  }
  return data.user;
}

export async function requireAdminUser(accessToken: string) {
  const user = await getUserFromToken(accessToken);
  const { data, error } = await adminClient
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new Error("Unauthorized admin access.");
  }

  return user;
}
