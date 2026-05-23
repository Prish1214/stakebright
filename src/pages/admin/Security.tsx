import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { Badge } from '@/components/ui/badge';

export default function AdminSecurity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logins, setLogins] = useState<any[]>([]);
  const [bigWithdrawals, setBig] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [l, e, w] = await Promise.all([
        supabase.from('admin_activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('login_events').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('withdrawals').select('*').gte('amount', 1000).order('created_at', { ascending: false }).limit(50),
      ]);
      setLogs(l.data || []); setLogins(e.data || []); setBig(w.data || []);
    })();
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Security & Audit</h1>

      <Panel title="Admin Activity Log" action={<Badge variant="outline" className="border-cyan-500/30 text-cyan-300">{logs.length}</Badge>}>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0d1322]"><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
              <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Admin</th><th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Target</th><th className="py-2 pr-3">Meta</th>
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-cyan-500/5">
                  <td className="py-2 pr-3 text-xs text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs font-mono">{l.admin_id.slice(0, 10)}…</td>
                  <td className="py-2 pr-3"><Badge className="bg-cyan-500/20 text-cyan-300">{l.action}</Badge></td>
                  <td className="py-2 pr-3 text-xs">{l.target_type} {l.target_id?.slice(0, 10)}…</td>
                  <td className="py-2 pr-3 text-xs text-slate-400 font-mono">{JSON.stringify(l.metadata)}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No admin activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent Logins (IP tracking)">
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
              <th className="py-2 pr-3">When</th><th className="py-2 pr-3">User</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3">User Agent</th>
            </tr></thead>
            <tbody>
              {logins.map(l => (
                <tr key={l.id} className="border-b border-cyan-500/5">
                  <td className="py-2 pr-3 text-xs text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs font-mono">{l.user_id.slice(0, 10)}…</td>
                  <td className="py-2 pr-3 font-mono text-cyan-300">{l.ip || '—'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-400 truncate max-w-[400px]">{l.user_agent}</td>
                </tr>
              ))}
              {logins.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No login events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Suspicious: large withdrawals (>$1,000) — ${bigWithdrawals.length}`}>
        <ul className="divide-y divide-cyan-500/10">
          {bigWithdrawals.map(w => (
            <li key={w.id} className="py-2 flex items-center gap-3 text-sm">
              <Badge className={w.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}>{w.status}</Badge>
              <span className="font-mono text-xs">{w.user_id.slice(0, 10)}…</span>
              <span className="tabular-nums text-amber-300 font-semibold">${Number(w.amount).toFixed(2)}</span>
              <span className="text-xs text-slate-400 font-mono">{w.withdrawal_address?.slice(0, 16)}…</span>
              <span className="text-xs text-slate-500 ml-auto">{new Date(w.created_at).toLocaleString()}</span>
            </li>
          ))}
          {bigWithdrawals.length === 0 && <li className="text-slate-500 text-sm text-center py-4">None flagged.</li>}
        </ul>
      </Panel>

      <Panel title="Webhook / payment logs">
        <p className="text-sm text-slate-400">
          NOWPayments webhook delivery logs are available in the Supabase Edge Function logs viewer.
        </p>
        <a
          href="https://supabase.com/dashboard/project/pzdnpksdcndpmmgtkbey/functions/nowpayments-webhook/logs"
          target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-cyan-300 hover:text-cyan-200 underline text-sm"
        >Open webhook logs →</a>
      </Panel>
    </div>
  );
}
