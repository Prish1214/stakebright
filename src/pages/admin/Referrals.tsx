import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { KpiCard } from '@/components/admin/KpiCard';
import { AlertTriangle } from 'lucide-react';

export default function AdminReferrals() {
  const [top, setTop] = useState<any[]>([]);
  const [suspicious, setSuspicious] = useState<any[]>([]);
  const [totals, setTotals] = useState({ refs: 0, paid: 0 });

  useEffect(() => {
    (async () => {
      const { data: t } = await (supabase as any).rpc('admin_top_referrers', { p_limit: 20 });
      setTop(t || []);

      const { data: re } = await supabase.from('referral_earnings').select('amount');
      const paid = (re || []).reduce((a: number, b: any) => a + Number(b.amount), 0);

      const { data: profs } = await supabase.from('profiles').select('user_id,referred_by,created_at,last_login_ip');
      const refs = (profs || []).filter((p: any) => p.referred_by).length;
      setTotals({ refs, paid });

      // Suspicious: same IP signups
      const ipMap: Record<string, any[]> = {};
      (profs || []).forEach((p: any) => {
        if (p.last_login_ip) (ipMap[p.last_login_ip] ||= []).push(p);
      });
      const susp = Object.entries(ipMap).filter(([, list]) => list.length > 1).map(([ip, list]) => ({ ip, count: list.length, users: list }));
      setSuspicious(susp);
    })();
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Referral Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Total Referrals" value={totals.refs} accent="cyan" />
        <KpiCard label="Total Commissions Paid" value={`$${totals.paid.toFixed(2)}`} accent="emerald" />
        <KpiCard label="Top Referrer Count" value={top[0]?.qualified_count || 0} accent="violet" />
      </div>

      <Panel title="Top 20 Referrers">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
              <th className="py-2 pr-3">#</th><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3 text-right">Referred</th><th className="py-2 pr-3 text-right">Earned</th>
            </tr></thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={r.user_id} className="border-b border-cyan-500/5">
                  <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                  <td className="py-2 pr-3">{r.username || r.email}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-cyan-300">{r.referral_code}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.qualified_count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">${Number(r.total_earnings).toFixed(2)}</td>
                </tr>
              ))}
              {top.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No referrers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Suspicious patterns — shared IP signups">
        {suspicious.length === 0
          ? <div className="text-sm text-slate-500 py-4 text-center">No suspicious clusters detected.</div>
          : <ul className="space-y-2">
              {suspicious.map(s => (
                <li key={s.ip} className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="text-amber-200 font-mono">{s.ip}</div>
                    <div className="text-xs text-slate-400">{s.count} users from same IP</div>
                  </div>
                </li>
              ))}
            </ul>}
      </Panel>
    </div>
  );
}
