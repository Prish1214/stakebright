import { ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  LayoutDashboard, Users, ArrowDownToLine, ArrowUpFromLine,
  Layers, Bot, Pickaxe, Network, BarChart3, Sliders, ShieldAlert, LogOut, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/admin/staking', label: 'Staking', icon: Layers },
  { to: '/admin/trading', label: 'AI Trading', icon: Bot },
  { to: '/admin/mining', label: 'Mining', icon: Pickaxe },
  { to: '/admin/referrals', label: 'Referrals', icon: Network },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/controls', label: 'Controls', icon: Sliders },
  { to: '/admin/security', label: 'Security', icon: ShieldAlert },
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070912]">
        <div className="text-cyan-400 animate-pulse">Loading admin…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#070912] text-slate-100 flex">
      {/* sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-cyan-500/10 bg-[#0a0e1a]/80 backdrop-blur">
        <div className="p-5 border-b border-cyan-500/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold tracking-wide">Stake Bright</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                  : 'text-slate-400 hover:text-cyan-200 hover:bg-white/5'
              )}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-cyan-500/10 space-y-1">
          <NavLink to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-cyan-200 hover:bg-white/5">
            <Home className="w-4 h-4" /> Back to App
          </NavLink>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-300 hover:bg-rose-500/10">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-cyan-500/10 bg-[#0a0e1a]/70 backdrop-blur flex items-center px-4 sticky top-0 z-30">
          <div className="lg:hidden font-bold text-cyan-300 mr-3">Admin</div>
          <div className="text-xs text-slate-400">Signed in as <span className="text-cyan-300">{user.email}</span></div>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="ghost" size="sm" className="text-slate-300"><NavLink to="/dashboard">App</NavLink></Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-rose-300">Sign out</Button>
          </div>
        </header>

        {/* mobile nav */}
        <div className="lg:hidden border-b border-cyan-500/10 bg-[#0a0e1a]/70 overflow-x-auto">
          <div className="flex gap-1 p-2 min-w-max">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-xs whitespace-nowrap',
                  isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400'
                )}
              >
                <n.icon className="w-3.5 h-3.5" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
