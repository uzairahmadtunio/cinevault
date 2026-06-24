import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { publicClient } from "@/lib/supabase";
import { getConfiguredAdminEmail, signOutAdmin } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await publicClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        await checkAdminAccess({ data: { accessToken: token } });
        nav({ to: "/admin/dashboard" });
      } catch {
        await signOutAdmin();
      }
    })();
  }, [nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    
    // Rate limiting: max 5 attempts per 15 minutes
    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil - now) / 60000);
      setErr(`Too many attempts. Try again in ${minutesLeft} minute(s).`);
      setBusy(false);
      return;
    }
    
    if (attempts >= 5) {
      setLockoutUntil(Date.now() + 15 * 60 * 1000);  // 15 minute lockout
      setErr("Too many failed attempts. Account locked for 15 minutes.");
      setBusy(false);
      return;
    }
    
    const adminEmail = getConfiguredAdminEmail();

    if (!adminEmail) {
      setErr("Admin login is not configured. Set VITE_SUPABASE_ADMIN_EMAIL in environment.");
      setBusy(false);
      return;
    }

    const { data, error } = await publicClient.auth.signInWithPassword({
      email: adminEmail,
      password: pw,
    });

    if (error || !data.session?.access_token) {
      setAttempts(attempts + 1);
      setErr(error?.message ?? "Login failed.");
      setBusy(false);
      return;
    }

    try {
      await checkAdminAccess({ data: { accessToken: data.session.access_token } });
      setAttempts(0);  // Reset on success
      nav({ to: "/admin/dashboard" });
    } catch (authError) {
      await signOutAdmin();
      setAttempts(attempts + 1);
      setErr("Unauthorized admin user.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080C14] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#0D1321] border border-[rgba(14,165,233,0.3)] rounded-xl p-7"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#06B6D4]/15 mx-auto mb-4">
          <Lock className="text-[#06B6D4]" />
        </div>
        <h1 className="text-center text-xl font-bold mb-1 text-[#F1F5F9]">CineVault Admin</h1>
        <p className="text-center text-xs text-[#64748B] mb-5">Enter the admin password</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(""); }}
          placeholder="Password"
          className="w-full bg-[#080C14] border border-[rgba(14,165,233,0.3)] rounded px-3 py-2 text-sm outline-none focus:border-[#06B6D4]"
        />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full mt-4 bg-[#06B6D4] text-white font-semibold py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
