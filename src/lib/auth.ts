import { publicClient, ADMIN_EMAIL } from "./supabase";

export async function getAdminAccessToken(): Promise<string | null> {
  const { data } = await publicClient.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOutAdmin() {
  await publicClient.auth.signOut();
}

export function getConfiguredAdminEmail() {
  if (!ADMIN_EMAIL) {
    throw new Error(
      "Admin email not configured. Set VITE_SUPABASE_ADMIN_EMAIL environment variable."
    );
  }
  return ADMIN_EMAIL;
}
