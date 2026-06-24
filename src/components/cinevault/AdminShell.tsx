import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, PlusCircle, Film, Flame, Sparkles, LogOut } from "lucide-react";
import { ToastHost } from "@/components/cinevault";
import { publicClient } from "@/lib/supabase";
import { signOutAdmin } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/api/admin.functions";
import { PwaInstallButton } from "@/components/cinevault/PwaInstallButton";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const validateAdminAccess = async () => {
    const { data } = await publicClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      nav({ to: "/admin" });
      return;
    }

    try {
      await checkAdminAccess({ data: { accessToken: token } });
      setOk(true);
    } catch {
      await signOutAdmin();
      nav({ to: "/admin" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    validateAdminAccess();
  }, [nav]);

  // Re-validate on tab focus (security check for session expiry)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateAdminAccess();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [nav]);

  if (loading) return null;
  if (!ok) return null;

  const items = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/add", label: "Add Movie", icon: PlusCircle },
    { to: "/admin/movies", label: "Manage Movies", icon: Film },
    { to: "/admin/trending", label: "Trending", icon: Flame },
    { to: "/admin/featured", label: "Featured", icon: Sparkles },
  ] as const;

  return (
    <div className="min-h-screen bg-[#080C14] text-[#F1F5F9]">
      {/* Mobile header */}
      <header className="w-full md:hidden flex items-center justify-between px-4 py-3 bg-[#0D1321] border-b border-[rgba(14,165,233,0.08)]">
        <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="p-2 rounded bg-transparent text-[#06B6D4]">
          ☰
        </button>
        <Link to="/" className="font-extrabold text-lg">
          <span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-[#64748B]">admin</span>
        </Link>
        <div className="w-8" />
      </header>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-52px)]">
        {/* Desktop sidebar */}
        <aside className="w-60 shrink-0 bg-[#0D1321] border-r border-[rgba(14,165,233,0.2)] p-5 hidden md:flex flex-col">
          <Link to="/" className="font-extrabold text-lg mb-8">
            <span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span>
            <span className="ml-2 text-[10px] uppercase tracking-wider text-[#64748B]">admin</span>
          </Link>
          <nav className="space-y-1 text-sm flex-1">
            {items.map((it) => {
              const active = path === it.to;
              const Icon = it.icon;
              return (
                <Link key={it.to} to={it.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded transition ${active ? "bg-[#06B6D4] text-white" : "text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.1)]"}`}>
                  <Icon size={16} /> {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-3">
            <button
              onClick={async () => { await signOutAdmin(); nav({ to: "/admin" }); }}
              className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#F1F5F9] mt-4"
            ><LogOut size={14} /> Logout</button>
            <div className="mt-4">
              <PwaInstallButton label="Install Admin App" />
            </div>
          </div>
        </aside>

        <main className="flex-1 p-5 md:p-8 overflow-y-auto min-h-[calc(100vh-52px)]">
          {children}
        </main>
      </div>

      {/* Mobile slide-over drawer */}
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} items={items} path={path} />
      <ToastHost />
    </div>
  );
}

export { Outlet };

function MobileSidebar({ open, onClose, items, path }: { open: boolean; onClose: () => void; items: readonly { to: string; label: string; icon: any }[]; path: string }) {
  return (
    <div className={`fixed inset-0 z-50 md:hidden transition-transform ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 ${open ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
      <div className={`absolute left-0 top-0 bottom-0 w-64 bg-[#0D1321] border-r border-[rgba(14,165,233,0.2)] p-5 transform ${open ? 'translate-x-0' : '-translate-x-full'} transition-transform`}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="font-extrabold text-lg">
            <span className="text-white">Cine</span><span className="text-[#06B6D4]">Vault</span>
            <span className="ml-2 text-[10px] uppercase tracking-wider text-[#64748B]">admin</span>
          </Link>
          <button onClick={onClose} className="text-[#64748B]">✕</button>
        </div>
        <nav className="space-y-1 text-sm">
          {items.map((it) => {
            const active = path === it.to;
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} onClick={onClose}
                className={`flex items-center gap-2 px-3 py-2 rounded transition ${active ? "bg-[#06B6D4] text-white" : "text-[#F1F5F9] hover:bg-[rgba(14,165,233,0.1)]"}`}>
                <Icon size={16} /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <button onClick={async () => { await signOutAdmin(); window.location.href = '/admin'; }} className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#F1F5F9]">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
