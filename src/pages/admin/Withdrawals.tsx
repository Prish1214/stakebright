import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function AdminWithdrawals() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');

  const load = async () => {
    const { data } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(500);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    (status === 'all' || r.status === status) &&
    (!q || r.withdrawal_address?.toLowerCase().includes(q.toLowerCase()) || r.user_id?.toLowerCase().includes(q.toLowerCase()))
  );

  const act = async (id: string, action: 'approve' | 'reject') => {
    const note = action === 'reject' ? prompt('Reason?') || '' : prompt('Approval note (optional)') || '';
    const { error } = await (supabase as any).rpc('admin_process_withdrawal', { p_id: id, p_action: action, p_note: note });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: `Withdrawal ${action}d` }); load(); }
  };

  const big = (n: number) => n >= 1000;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
      <Panel>
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search address or user" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-[#0a0e1a] border-cyan-500/20" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40 bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ml-auto">{filtered.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-cyan-500/10">
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3 text-right">Gross</th>
                <th className="py-2 pr-3 text-right">Fee</th>
                <th className="py-2 pr-3 text-right">Net</th>
                <th className="py-2 pr-3">Address</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={'border-b border-cyan-500/5 hover:bg-cyan-500/5 ' + (big(Number(r.amount)) ? 'bg-amber-500/5' : '')}>
                  <td className="py-2 pr-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs font-mono">{r.user_id.slice(0, 10)}…</td>
                  <td className="py-2 pr-3 text-right tabular-nums">${Number(r.amount).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">${Number(r.fee_amount).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">${Number(r.net_amount).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-xs font-mono text-cyan-300">{r.withdrawal_address?.slice(0, 14)}…</td>
                  <td className="py-2 pr-3">
                    <Badge className={r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : r.status === 'rejected' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {r.status === 'pending' && <>
                      <Button size="sm" variant="ghost" className="h-7 text-emerald-300" onClick={() => act(r.id, 'approve')}>Approve</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-rose-300" onClick={() => act(r.id, 'reject')}>Reject</Button>
                    </>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-500">No withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
