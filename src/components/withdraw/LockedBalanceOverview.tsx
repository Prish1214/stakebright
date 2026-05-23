import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Pickaxe, LineChart, TrendingUp } from 'lucide-react';

interface Props { userId?: string }

export const LockedBalanceOverview = ({ userId }: Props) => {
  const [data, setData] = useState({ staking: 0, mining: 0, trading: 0 });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [stakesRes, miningRes, sessionsRes, profileRes] = await Promise.all([
        supabase.from('stakes').select('amount, is_active').eq('user_id', userId).eq('is_active', true),
        (supabase as any).from('mining_rentals').select('locked_amount, status').eq('user_id', userId).eq('status', 'active'),
        (supabase as any).from('trading_sessions').select('capital, status').eq('user_id', userId).eq('status', 'active'),
        (supabase as any).from('profiles').select('trading_wallet').eq('user_id', userId).maybeSingle(),
      ]);
      const staking = (stakesRes.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      const mining = (miningRes.data || []).reduce((s: number, r: any) => s + Number(r.locked_amount), 0);
      const sessionsCap = (sessionsRes.data || []).reduce((s: number, r: any) => s + Number(r.capital), 0);
      const trading = sessionsCap || Number(profileRes.data?.trading_wallet || 0);
      setData({ staking, mining, trading });
    })();
  }, [userId]);

  const items = [
    { label: 'Staking Locked', value: data.staking, icon: TrendingUp, color: 'text-crypto-purple', border: 'border-crypto-purple/20' },
    { label: 'Mining Allocation', value: data.mining, icon: Pickaxe, color: 'text-crypto-gold', border: 'border-crypto-gold/20' },
    { label: 'Trading Active', value: data.trading, icon: LineChart, color: 'text-accent', border: 'border-accent/20' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" /> Locked Balance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.label} className={`rounded-lg border ${it.border} bg-card/50 p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{it.label}</span>
                <it.icon className={`h-4 w-4 ${it.color}`} />
              </div>
              <div className={`text-2xl font-bold ${it.color}`}>{it.value.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDT</span></div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">These balances are committed to active positions and not available to withdraw yet.</p>
      </CardContent>
    </Card>
  );
};

export default LockedBalanceOverview;
