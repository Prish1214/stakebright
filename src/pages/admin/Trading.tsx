import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { KpiCard } from '@/components/admin/KpiCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';

export default function AdminTrading() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('trading_sessions').select('*').eq('status', 'scalp').order('started_at', { ascending: false }).limit(2000);
      setRows(data || []);
    })();
  }, []);

  const last24 = rows.filter(r => new Date(r.started_at) > new Date(Date.now() - 86400000));
  const totalProfit = rows.reduce((a, b) => a + Number(b.profit || 0), 0);
  const levels = [1, 2, 3, 4, 5, 6].map(l => ({
    level: `L${l}`,
    count: rows.filter(r => (r.trades_json?.level || 0) === l).length
  }));

  const byDay: Record<string, number> = {};
  rows.forEach(r => {
    const d = new Date(r.started_at).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + Number(r.profit || 0);
  });
  const daily = Object.entries(byDay).sort().slice(-30).map(([day, profit]) => ({ day: day.slice(5), profit: Number(profit.toFixed(2)) }));

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">AI Trading Management</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Activations (24h)" value={last24.length} accent="cyan" />
        <KpiCard label="Total Scalps" value={rows.length} accent="violet" />
        <KpiCard label="Total Rewards Paid" value={`$${totalProfit.toFixed(2)}`} accent="emerald" />
        <KpiCard label="Avg Profit / Scalp" value={`$${(totalProfit / Math.max(rows.length, 1)).toFixed(2)}`} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Level distribution">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={levels}>
                <XAxis dataKey="level" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
                <Bar dataKey="count" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Daily rewards (last 30 days)">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
                <Line dataKey="profit" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
