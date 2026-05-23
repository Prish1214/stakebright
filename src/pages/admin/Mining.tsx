import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { KpiCard } from '@/components/admin/KpiCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#22d3ee', '#a78bfa', '#f59e0b'];

export default function AdminMining() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('mining_rentals').select('*').order('created_at', { ascending: false }).limit(2000);
      setRows(data || []);
    })();
  }, []);

  const active = rows.filter(r => r.status === 'active');
  const locked = active.reduce((a, b) => a + Number(b.locked_amount), 0);
  const yieldPaid = rows.reduce((a, b) => a + Number(b.total_yield || 0), 0);
  // exposure: remaining max possible yield
  const exposure = active.reduce((a, b) => {
    const daysLeft = Math.max(0, (new Date(b.ends_at).getTime() - Date.now()) / 86400000);
    return a + Number(b.locked_amount) * Number(b.daily_max_pct) / 100 * daysLeft;
  }, 0);

  const byCoin = ['BTC', 'LTC', 'DOGE'].map(c => ({
    name: c,
    value: active.filter(r => r.coin === c).reduce((a, b) => a + Number(b.locked_amount), 0)
  }));

  const expiring7 = active.filter(r => new Date(r.ends_at) <= new Date(Date.now() + 7 * 86400000));

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Mining Management</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Allocations" value={active.length} accent="cyan" />
        <KpiCard label="Locked Capital" value={`$${locked.toFixed(2)}`} accent="violet" />
        <KpiCard label="Yield Paid" value={`$${yieldPaid.toFixed(2)}`} accent="emerald" />
        <KpiCard label="Max Remaining Exposure" value={`$${exposure.toFixed(2)}`} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Coin distribution (locked $)">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCoin} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {byCoin.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={`Expiring in 7 days (${expiring7.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
                <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Coin</th><th className="py-2 pr-3">Tier</th>
                <th className="py-2 pr-3 text-right">Locked</th><th className="py-2 pr-3">Ends</th>
              </tr></thead>
              <tbody>
                {expiring7.sort((a, b) => +new Date(a.ends_at) - +new Date(b.ends_at)).map(r => (
                  <tr key={r.id} className="border-b border-cyan-500/5">
                    <td className="py-2 pr-3 text-xs font-mono">{r.user_id.slice(0, 10)}…</td>
                    <td className="py-2 pr-3">{r.coin}</td>
                    <td className="py-2 pr-3">{r.tier}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">${Number(r.locked_amount).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(r.ends_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {expiring7.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">None.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
