import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Snowflake, Pencil, Search, RefreshCw } from 'lucide-react';

const fmt = (n: any) => Number(n || 0).toFixed(2);

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [editWallet, setEditWallet] = useState('earnings');
  const [editDelta, setEditDelta] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id,email,username,wallet_balance,staking_wallet,mining_wallet,trading_wallet,is_frozen,referral_code,referred_by,last_login_at,created_at,admin_notes')
      .order('created_at', { ascending: false })
      .limit(1000);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.email?.toLowerCase().includes(s) ||
      r.username?.toLowerCase().includes(s) ||
      r.referral_code?.toLowerCase().includes(s) ||
      r.user_id?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const toggleFreeze = async (u: any) => {
    const { error } = await supabase.from('profiles').update({ is_frozen: !u.is_frozen }).eq('user_id', u.user_id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: u.is_frozen ? 'Unfrozen' : 'Frozen' }); load(); }
  };

  const submitAdjust = async () => {
    const delta = Number(editDelta);
    if (!delta) return toast({ title: 'Enter a non-zero delta', variant: 'destructive' });
    const { error } = await (supabase as any).rpc('admin_adjust_balance', {
      p_user_id: edit.user_id, p_wallet: editWallet, p_delta: delta, p_note: editNote
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Balance updated' }); setEdit(null); setEditDelta(''); setEditNote(''); load(); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email, username, code, id…" className="pl-8 bg-[#0a0e1a] border-cyan-500/20" />
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">{filtered.length} users</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-cyan-500/10">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3 text-right">Main</th>
                <th className="py-2 pr-3 text-right">Staking</th>
                <th className="py-2 pr-3 text-right">Mining</th>
                <th className="py-2 pr-3 text-right">Trading</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Last login</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="py-6 text-center text-slate-500">Loading…</td></tr>}
              {!loading && filtered.map((u) => (
                <tr key={u.user_id} className="border-b border-cyan-500/5 hover:bg-cyan-500/5">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-100">{u.username || u.email}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(u.wallet_balance)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(u.staking_wallet)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(u.mining_wallet)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(u.trading_wallet)}</td>
                  <td className="py-2 pr-3 text-cyan-300 font-mono text-xs">{u.referral_code}</td>
                  <td className="py-2 pr-3 text-xs text-slate-400">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}</td>
                  <td className="py-2 pr-3">
                    {u.is_frozen
                      ? <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">Frozen</Badge>
                      : <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Active</Badge>}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-cyan-300" onClick={() => setEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-300" onClick={() => toggleFreeze(u)}><Snowflake className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="bg-[#0d1322] border-cyan-500/20">
          <DialogHeader><DialogTitle>Adjust balance — {edit?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">Wallet</label>
              <Select value={editWallet} onValueChange={setEditWallet}>
                <SelectTrigger className="bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="staking">Staking</SelectItem>
                  <SelectItem value="mining">Mining</SelectItem>
                  <SelectItem value="trading">Trading</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Delta (use negative to deduct)</label>
              <Input type="number" step="0.01" value={editDelta} onChange={(e) => setEditDelta(e.target.value)} className="bg-[#0a0e1a] border-cyan-500/20" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Note (audit log)</label>
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Reason…" className="bg-[#0a0e1a] border-cyan-500/20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={submitAdjust} className="bg-cyan-500 hover:bg-cyan-400 text-black">Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
