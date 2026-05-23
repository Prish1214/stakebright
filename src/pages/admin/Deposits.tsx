import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

export default function AdminDeposits() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [network, setNetwork] = useState('all');
  const [q, setQ] = useState('');

  const load = async () => {
    const { data } = await supabase.from('deposits').select('*').order('created_at', { ascending: false }).limit(500);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  // suspicious: duplicate tx hash
  const hashCounts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach(r => { if (r.transaction_hash) m[r.transaction_hash] = (m[r.transaction_hash] || 0) + 1; });
    return m;
  }, [rows]);

  const filtered = rows.filter(r =>
    (status === 'all' || r.status === status) &&
    (network === 'all' || r.network === network) &&
    (!q || r.transaction_hash?.toLowerCase().includes(q.toLowerCase()) || r.user_id?.toLowerCase().includes(q.toLowerCase()))
  );

  const setDepStatus = async (id: string, s: string) => {
    const note = s === 'rejected' ? prompt('Reason for rejection?') || '' : '';
    const { error } = await (supabase as any).rpc('admin_update_deposit_status', { p_id: id, p_status: s, p_note: note });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: `Deposit ${s}` }); load(); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Deposits</h1>
      <Panel>
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Search tx or user" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-[#0a0e1a] border-cyan-500/20" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger className="w-36 bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              <SelectItem value="bep20">BEP-20</SelectItem>
              <SelectItem value="trc20">TRC-20</SelectItem>
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
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3">Network</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Tx</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const dup = r.transaction_hash && hashCounts[r.transaction_hash] > 1;
                return (
                  <tr key={r.id} className="border-b border-cyan-500/5 hover:bg-cyan-500/5">
                    <td className="py-2 pr-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-xs font-mono">{r.user_id.slice(0, 10)}…</td>
                    <td className="py-2 pr-3 text-right tabular-nums">${Number(r.amount).toFixed(2)}</td>
                    <td className="py-2 pr-3 uppercase text-xs">{r.network}</td>
                    <td className="py-2 pr-3 capitalize text-xs">{r.target_wallet}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-cyan-300 flex items-center gap-1">
                      {r.transaction_hash?.slice(0, 10)}…
                      {dup && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" title="Duplicate hash" />}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : r.status === 'rejected' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {r.status === 'pending' && <>
                        <Button size="sm" variant="ghost" className="h-7 text-emerald-300" onClick={() => setDepStatus(r.id, 'approved')}>Approve</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-rose-300" onClick={() => setDepStatus(r.id, 'rejected')}>Reject</Button>
                      </>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-500">No deposits.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
