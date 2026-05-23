import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/admin/Panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

const FREEZE_KEYS = ['freeze_staking', 'freeze_mining', 'freeze_trading', 'freeze_withdrawals'];

export default function AdminControls() {
  const [settings, setSettings] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [anns, setAnns] = useState<any[]>([]);
  const [newAnn, setNewAnn] = useState({ title: '', body: '', type: 'info' });
  const [reward, setReward] = useState({ user_id: '', wallet: 'earnings', amount: '', note: '' });

  const load = async () => {
    const [s, p, a] = await Promise.all([
      supabase.from('system_settings').select('*'),
      supabase.from('staking_plans').select('*').order('minimum_amount'),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    ]);
    setSettings(s.data || []); setPlans(p.data || []); setAnns(a.data || []);
  };
  useEffect(() => { load(); }, []);

  const setSetting = async (key: string, value: string) => {
    const { error } = await (supabase as any).rpc('admin_set_setting', { p_key: key, p_value: value });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Saved' }); load(); }
  };

  const updatePlan = async (id: string, patch: any) => {
    const { error } = await supabase.from('staking_plans').update(patch).eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Plan updated' }); load(); }
  };

  const createAnn = async () => {
    if (!newAnn.title || !newAnn.body) return;
    const { error } = await supabase.from('announcements').insert([newAnn]);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Created' }); setNewAnn({ title: '', body: '', type: 'info' }); load(); }
  };
  const delAnn = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id); load();
  };
  const toggleAnn = async (a: any) => {
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id); load();
  };

  const credit = async () => {
    if (!reward.user_id || !reward.amount) return;
    const { error } = await (supabase as any).rpc('admin_credit_reward', {
      p_user_id: reward.user_id, p_wallet: reward.wallet, p_amount: Number(reward.amount), p_note: reward.note
    });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Reward credited' }); setReward({ user_id: '', wallet: 'main', amount: '', note: '' }); }
  };

  const get = (k: string) => settings.find(s => s.setting_key === k)?.setting_value;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Admin Controls</h1>

      <Panel title="Section freeze controls">
        <div className="grid sm:grid-cols-2 gap-3">
          {FREEZE_KEYS.map(k => (
            <div key={k} className="flex items-center justify-between rounded-lg border border-cyan-500/10 bg-[#0a0e1a]/60 px-3 py-3">
              <div>
                <div className="font-medium capitalize">{k.replace('freeze_', 'Freeze ')}</div>
                <div className="text-xs text-slate-500">When on, users cannot perform that action.</div>
              </div>
              <Switch checked={get(k) === 'true'} onCheckedChange={(c) => setSetting(k, c ? 'true' : 'false')} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Reward ranges — staking plans">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-cyan-500/10">
              <th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Min %</th><th className="py-2 pr-3">Max %</th><th className="py-2"></th>
            </tr></thead>
            <tbody>
              {plans.map(p => <PlanRow key={p.id} plan={p} onSave={updatePlan} />)}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Manual reward / credit">
        <div className="grid sm:grid-cols-4 gap-2">
          <Input placeholder="User ID (UUID)" value={reward.user_id} onChange={(e) => setReward({ ...reward, user_id: e.target.value })} className="bg-[#0a0e1a] border-cyan-500/20" />
          <Select value={reward.wallet} onValueChange={(v) => setReward({ ...reward, wallet: v })}>
            <SelectTrigger className="bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main</SelectItem>
              <SelectItem value="staking">Staking</SelectItem>
              <SelectItem value="mining">Mining</SelectItem>
              <SelectItem value="trading">Trading</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Amount" value={reward.amount} onChange={(e) => setReward({ ...reward, amount: e.target.value })} className="bg-[#0a0e1a] border-cyan-500/20" />
          <Input placeholder="Note" value={reward.note} onChange={(e) => setReward({ ...reward, note: e.target.value })} className="bg-[#0a0e1a] border-cyan-500/20" />
        </div>
        <Button onClick={credit} className="mt-3 bg-cyan-500 hover:bg-cyan-400 text-black">Credit reward</Button>
      </Panel>

      <Panel title="Announcements / Banners">
        <div className="grid sm:grid-cols-4 gap-2 mb-3">
          <Input placeholder="Title" value={newAnn.title} onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })} className="bg-[#0a0e1a] border-cyan-500/20" />
          <Select value={newAnn.type} onValueChange={(v) => setNewAnn({ ...newAnn, type: v })}>
            <SelectTrigger className="bg-[#0a0e1a] border-cyan-500/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="danger">Danger</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Body" value={newAnn.body} onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })} className="bg-[#0a0e1a] border-cyan-500/20 sm:col-span-2 min-h-[44px]" />
        </div>
        <Button onClick={createAnn} className="bg-cyan-500 hover:bg-cyan-400 text-black mb-4">Publish</Button>

        <ul className="space-y-2">
          {anns.map(a => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-cyan-500/10 bg-[#0a0e1a]/60 p-3">
              <div className="flex-1">
                <div className="font-semibold text-slate-100">{a.title} <span className="text-[10px] uppercase text-slate-500 ml-2">{a.type}</span></div>
                <div className="text-sm text-slate-400">{a.body}</div>
              </div>
              <Switch checked={a.is_active} onCheckedChange={() => toggleAnn(a)} />
              <Button size="sm" variant="ghost" className="text-rose-300" onClick={() => delAnn(a.id)}><Trash2 className="w-4 h-4" /></Button>
            </li>
          ))}
          {anns.length === 0 && <li className="text-slate-500 text-sm text-center py-4">No announcements.</li>}
        </ul>
      </Panel>
    </div>
  );
}

function PlanRow({ plan, onSave }: { plan: any; onSave: (id: string, patch: any) => void }) {
  const [min, setMin] = useState(plan.min_daily_rate ?? '');
  const [max, setMax] = useState(plan.max_daily_rate ?? '');
  return (
    <tr className="border-b border-cyan-500/5">
      <td className="py-2 pr-3">{plan.name}</td>
      <td className="py-2 pr-3"><Input value={min} onChange={(e) => setMin(e.target.value)} type="number" step="0.001" className="h-8 bg-[#0a0e1a] border-cyan-500/20 w-28" /></td>
      <td className="py-2 pr-3"><Input value={max} onChange={(e) => setMax(e.target.value)} type="number" step="0.001" className="h-8 bg-[#0a0e1a] border-cyan-500/20 w-28" /></td>
      <td className="py-2"><Button size="sm" variant="ghost" className="text-cyan-300" onClick={() => onSave(plan.id, { min_daily_rate: Number(min), max_daily_rate: Number(max) })}>Save</Button></td>
    </tr>
  );
}
