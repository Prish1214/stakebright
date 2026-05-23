import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KpiCard } from '@/components/admin/KpiCard';
import { Panel } from '@/components/admin/Panel';
import { Users, Wallet, Layers, Bot, Pickaxe, ArrowDownToLine, ArrowUpFromLine, Lock, Snowflake, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtUSD = (n: any) => `$${fmt(n)}`;

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any).rpc('admin_stats');
    setStats(data);

    const [dep, wd, st, sc] = await Promise.all([
      supabase.from('deposits').select('id,user_id,amount,status,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('withdrawals').select('id,user_id,amount,status,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('stakes').select('id,user_id,amount,created_at').order('created_at', { ascending: false }).limit(4),
      supabase.from('trading_sessions').select('id,user_id,profit,status,started_at').eq('status', 'scalp').order('started_at', { ascending: false }).limit(4),
    ]);
    const items = [
      ...(dep.data || []).map((d: any) => ({ type: 'deposit', id: d.id, user: d.user_id, amount: d.amount, status: d.status, at: d.created_at })),
      ...(wd.data || []).map((d: any) => ({ type: 'withdrawal', id: d.id, user: d.user_id, amount: d.amount, status: d.status, at: d.created_at })),
      ...(st.data || []).map((d: any) => ({ type: 'stake', id: d.id, user: d.user_id, amount: d.amount, at: d.created_at })),
      ...(sc.data || []).map((d: any) => ({ type: 'scalp', id: d.id, user: d.user_id, amount: d.profit, at: d.started_at })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 18);
    setFeed(items);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Operations Overview</h1>
          <p className="text-sm text-slate-400">Live state of the platform — auto-refreshes every 15s.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KpiCard label="Total Users" value={fmt(stats?.total_users)} icon={<Users className="w-5 h-5" />} accent="cyan" />
        <KpiCard label="Active (7d)" value={fmt(stats?.active_users_7d)} icon={<Activity className="w-5 h-5" />} accent="emerald" />
        <KpiCard label="Frozen" value={fmt(stats?.frozen_users)} icon={<Snowflake className="w-5 h-5" />} accent="rose" />
        <KpiCard label="Pending Withdrawals" value={fmt(stats?.pending_withdrawals)} icon={<ArrowUpFromLine className="w-5 h-5" />} accent="amber" />
        <KpiCard label="Total Deposits" value={fmtUSD(stats?.total_deposits)} icon={<ArrowDownToLine className="w-5 h-5" />} accent="emerald" hint={`${fmt(stats?.pending_deposits)} pending`} />
        <KpiCard label="Total Withdrawals" value={fmtUSD(stats?.total_withdrawals)} icon={<ArrowUpFromLine className="w-5 h-5" />} accent="violet" />
        <KpiCard label="Locked in Stakes" value={fmtUSD(stats?.total_locked_stakes)} icon={<Lock className="w-5 h-5" />} accent="cyan" />
        <KpiCard label="Locked in Mining" value={fmtUSD(stats?.total_locked_mining)} icon={<Pickaxe className="w-5 h-5" />} accent="violet" />
        <KpiCard label="All Wallet Liability" value={fmtUSD(stats?.total_wallet_balance)} icon={<Wallet className="w-5 h-5" />} accent="amber" />
        <KpiCard label="Active Staking Users" value={fmt(stats?.active_staking_users)} icon={<Layers className="w-5 h-5" />} accent="cyan" />
        <KpiCard label="AI Trading (24h)" value={fmt(stats?.active_trading_users_24h)} icon={<Bot className="w-5 h-5" />} accent="violet" />
        <KpiCard label="Mining Allocations" value={fmt(stats?.active_mining_allocations)} icon={<Pickaxe className="w-5 h-5" />} accent="emerald" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Live Activity Feed" className="lg:col-span-2">
          <ul className="divide-y divide-cyan-500/10">
            {feed.length === 0 && <li className="text-sm text-slate-500 py-8 text-center">No recent activity.</li>}
            {feed.map((f) => (
              <li key={f.type + f.id} className="py-2.5 flex items-center gap-3 text-sm">
                <span className={
                  'inline-block w-1.5 h-1.5 rounded-full ' +
                  (f.type === 'deposit' ? 'bg-emerald-400' : f.type === 'withdrawal' ? 'bg-amber-400' : f.type === 'stake' ? 'bg-cyan-400' : 'bg-violet-400')
                } />
                <span className="capitalize text-slate-200 w-24">{f.type}</span>
                <span className="text-slate-400 text-xs truncate flex-1">user {String(f.user).slice(0, 8)}…</span>
                <span className={'tabular-nums font-medium ' + (Number(f.amount) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  {fmtUSD(f.amount)}
                </span>
                {f.status && <span className="text-[10px] uppercase tracking-wide text-slate-500 w-20 text-right">{f.status}</span>}
                <span className="text-[11px] text-slate-500 w-28 text-right">{formatDistanceToNow(new Date(f.at), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Earnings Distributed">
          <div className="space-y-3">
            <Row label="Referral payouts" value={fmtUSD(stats?.total_referral_earnings)} />
            <Row label="Staking earnings" value={fmtUSD(stats?.total_staking_earnings)} />
            <Row label="Mining yield" value={fmtUSD(stats?.total_mining_yield)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-cyan-500/10 bg-[#0a0e1a]/60 px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-cyan-300 font-semibold tabular-nums">{value}</span>
    </div>
  );
}
