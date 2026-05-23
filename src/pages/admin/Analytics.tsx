import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

export default function AdminAnalytics() {
  const [growth, setGrowth] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc('admin_daily_growth', { p_days: 30 });
      const arr = (data || []).map((d: any) => ({
        day: String(d.day).slice(5),
        signups: Number(d.signups),
        deposits: Number(d.deposits),
        withdrawals: Number(d.withdrawals),
        net: Number(d.deposits) - Number(d.withdrawals),
      }));
      setGrowth(arr);
    })();
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Charts & Analytics</h1>

      <Panel title="User signups (30d)">
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={growth}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
              <Area type="monotone" dataKey="signups" stroke="#22d3ee" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Deposits vs Withdrawals (30d)">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
              <Legend />
              <Bar dataKey="deposits" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withdrawals" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Net flow (deposits − withdrawals)">
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={growth}>
              <defs>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0d1322', border: '1px solid rgba(34,211,238,0.2)' }} />
              <Area dataKey="net" stroke="#a78bfa" fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
