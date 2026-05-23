import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { KpiCard } from '@/components/admin/KpiCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function AdminStaking() {
  const [stakes, setStakes] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        supabase.from('stakes').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('staking_plans').select('*'),
      ]);
      setStakes(s.data || []); setPlans(p.data || []);
    })();
  }, []);

  const active = stakes.filter(s => s.is_active);
  const totalLocked = active.reduce((a, b) => a + Number(b.amount), 0);
  const totalEarned = stakes.reduce((a, b) => a + Number(b.total_earned || 0), 0);
  const next7 = active.filter(s => new Date(s.end_date) <= new Date(Date.now() + 7 * 86400000));
  const unlock7 = next7.reduce((a, b) => a + Number(b.amount), 0);
  const next30 = active.filter(s => new Date(s.end_date) <= new Date(Date.now() + 30 * 86400000));
  const unlock30 = next30.reduce((a, b) => a + Number(b.amount), 0);

  const planMap = Object.fromEntries(plans.map(p => [p.id, p.name]));
  const perPlan = plans.map(p => {
    const ps = stakes.filter(s => s.plan_id === p.id);
    return {
      name: p.name,
      active: ps.filter(s => s.is_active).length,
      locked: ps.filter(s => s.is_active).reduce((a, b) => a + Number(b.amount), 0),
      paid: ps.reduce((a, b) => a + Number(b.total_earned || 0), 0),
    };
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Staking Management</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Stakes" value={active.length} accent="cyan" />
        <KpiCard label="Total Locked" value={`$${totalLocked.toFixed(2)}`} accent="violet" />
        <KpiCard label="Unlock in 7d" value={`$${unlock7.toFixed(2)}`} hint={`${next7.length} stakes`} accent="amber" />
        <KpiCard label="Total Earnings Paid" value={`$${totalEarned.toFixed(2)}`} accent="emerald" />
      </div>

      <Panel title="Per-plan analytics">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={perPlan}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
              <Bar dataKey="active" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              <Bar dataKey="locked" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              <Bar dataKey="paid" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title={`Upcoming unlocks (next 30 days · $${unlock30.toFixed(2)})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
              <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Plan</th>
              <th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3 text-right">Earned</th>
              <th className="py-2 pr-3">Unlocks</th>
            </tr></thead>
            <tbody>
              {next30.sort((a, b) => +new Date(a.end_date) - +new Date(b.end_date)).map(s => (
                <tr key={s.id} className="border-b border-cyan-500/5">
                  <td className="py-2 pr-3 text-xs font-mono">{s.user_id.slice(0, 10)}…</td>
                  <td className="py-2 pr-3">{planMap[s.plan_id] || '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">${Number(s.amount).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">${Number(s.total_earned || 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-xs">{new Date(s.end_date).toLocaleDateString()}</td>
                </tr>
              ))}
              {next30.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No upcoming unlocks.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
