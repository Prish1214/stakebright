import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Pickaxe, Zap, Cpu, Activity, RefreshCw, Server, Bitcoin, Clock, Flame, Lock, TrendingUp, Gauge } from 'lucide-react';

type Coin = 'BTC' | 'LTC' | 'DOGE';
type Tier = 'Basic' | 'Pro' | 'Elite';

interface Profile {
  wallet_balance: number;
  mining_wallet: number;
}

interface Rental {
  id: string;
  coin: Coin;
  tier: Tier;
  locked_amount: number;
  runtime_days: number;
  daily_min_pct: number;
  daily_max_pct: number;
  efficiency: number;
  hashrate: number;
  started_at: string;
  ends_at: string;
  total_yield: number;
  status: 'active' | 'completed';
}

const PLANS: Record<Coin, { tier: Tier; price: number; days: number; min: number; max: number; hash: number; eff: number; glow: 'cyan' | 'purple' | 'gold' }[]> = {
  BTC: [
    { tier: 'Basic', price: 50, days: 30, min: 0.7, max: 1.0, hash: 10, eff: 88, glow: 'cyan' },
    { tier: 'Pro', price: 200, days: 60, min: 1.0, max: 1.2, hash: 50, eff: 93, glow: 'purple' },
    { tier: 'Elite', price: 750, days: 90, min: 1.2, max: 1.5, hash: 200, eff: 98, glow: 'gold' },
  ],
  LTC: [
    { tier: 'Basic', price: 40, days: 30, min: 0.9, max: 1.2, hash: 15, eff: 88, glow: 'cyan' },
    { tier: 'Pro', price: 180, days: 60, min: 1.1, max: 1.4, hash: 70, eff: 93, glow: 'purple' },
    { tier: 'Elite', price: 700, days: 90, min: 1.4, max: 1.7, hash: 250, eff: 98, glow: 'gold' },
  ],
  DOGE: [
    { tier: 'Basic', price: 30, days: 20, min: 1.2, max: 1.5, hash: 20, eff: 88, glow: 'cyan' },
    { tier: 'Pro', price: 150, days: 45, min: 1.5, max: 1.9, hash: 90, eff: 93, glow: 'purple' },
    { tier: 'Elite', price: 600, days: 75, min: 1.8, max: 2.3, hash: 300, eff: 98, glow: 'gold' },
  ],
};

const COIN_META: Record<Coin, { color: string; label: string; unit: string }> = {
  BTC: { color: 'text-crypto-gold', label: 'Bitcoin', unit: 'TH/s' },
  LTC: { color: 'text-secondary', label: 'Litecoin', unit: 'GH/s' },
  DOGE: { color: 'text-accent', label: 'Dogecoin', unit: 'MH/s' },
};

const fmt = (n: number, d = 4) => Number(n || 0).toFixed(d);

const Countdown = ({ endsAt }: { endsAt: string }) => {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date(endsAt).getTime() - Date.now();
      if (d <= 0) { setT('Completed'); return; }
      const days = Math.floor(d / 86400000);
      const h = Math.floor((d % 86400000) / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setT(`${days}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [endsAt]);
  return <span className="font-mono">{t}</span>;
};

// Live ticking profit estimator between accruals
const LiveProfit = ({ rental }: { rental: Rental }) => {
  const [val, setVal] = useState(rental.total_yield);
  useEffect(() => {
    const avgDaily = rental.locked_amount * ((rental.daily_min_pct + rental.daily_max_pct) / 2) / 100;
    const perSec = avgDaily / 86400;
    const start = Date.now();
    const base = Number(rental.total_yield);
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const endCap = (new Date(rental.ends_at).getTime() - Date.now()) / 1000;
      const usable = Math.min(elapsed, Math.max(0, endCap + elapsed));
      setVal(base + perSec * usable);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [rental.id, rental.total_yield]);
  return <span className="font-mono text-success">+{fmt(val, 6)}</span>;
};

const Mining = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<Coin>('BTC');

  const fetchAll = async () => {
    if (!user) return;
    // Accrue yields server-side, then fetch fresh data
    await (supabase as any).rpc('accrue_mining_yields').catch(() => {});
    const [{ data: p }, { data: r }] = await Promise.all([
      (supabase as any).from('profiles').select('wallet_balance, mining_wallet').eq('user_id', user.id).single(),
      (supabase as any).from('mining_rentals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setProfile(p);
    setRentals(r || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);

  // Auto-refresh every 60s for live yields
  useEffect(() => {
    const i = setInterval(fetchAll, 60_000);
    return () => clearInterval(i);
  }, [user]);

  const startRental = async (tier: Tier) => {
    setBusy(`start-${tier}`);
    try {
      const { error } = await (supabase as any).rpc('start_mining_rental', { p_coin: selectedCoin, p_tier: tier });
      if (error) throw error;
      toast({ title: '⚡ Hashpower Activated', description: `${selectedCoin} ${tier} rental started.` });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Activation failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => <div key={i} className="cyber-card rounded-xl p-6 animate-pulse h-40" />)}
    </div>
  );

  const active = rentals.filter(r => r.status === 'active');
  const completed = rentals.filter(r => r.status === 'completed');
  const totalLocked = active.reduce((s, r) => s + Number(r.locked_amount), 0);
  const totalYield = rentals.reduce((s, r) => s + Number(r.total_yield), 0);
  const totalHash = active.reduce((s, r) => s + Number(r.hashrate), 0);
  const avgEff = active.length ? active.reduce((s, r) => s + Number(r.efficiency), 0) / active.length : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-mono font-bold gradient-text flex items-center gap-3">
            <Pickaxe className="h-8 w-8 text-primary" />
            Mining Power Rental
          </h1>
          <p className="text-muted-foreground mt-1">Allocate Mining Wallet balance to rent hashpower. Earn variable daily yields to your withdrawable balance. Locked funds unlock automatically when runtime ends.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mining Wallet</p>
            <p className="text-lg font-mono font-bold text-crypto-gold">
              <AnimatedNumber value={Number(profile?.mining_wallet || 0)} glowColor="gold" suffix=" USDT" />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Withdrawable</p>
            <p className="text-lg font-mono font-bold text-success">
              <AnimatedNumber value={Number(profile?.wallet_balance || 0)} glowColor="green" suffix=" USDT" />
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CyberCard glowColor="purple">
          <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Active Power</span><GlowingIcon icon={Zap} size="sm" color="purple" animated={false} /></div>
          <div className="text-xl font-mono font-bold text-primary"><AnimatedNumber value={totalLocked} glowColor="purple" suffix=" USDT" /></div>
          <div className="text-[10px] text-muted-foreground mt-1">{active.length} active rental{active.length !== 1 ? 's' : ''}</div>
        </CyberCard>
        <CyberCard glowColor="green">
          <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Total Yield</span><GlowingIcon icon={TrendingUp} size="sm" color="green" animated={false} /></div>
          <div className="text-xl font-mono font-bold text-success"><AnimatedNumber value={totalYield} glowColor="green" suffix=" USDT" decimals={4} /></div>
          <div className="text-[10px] text-muted-foreground mt-1">All-time earnings</div>
        </CyberCard>
        <CyberCard glowColor="cyan">
          <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Hashpower</span><GlowingIcon icon={Cpu} size="sm" color="cyan" animated={false} /></div>
          <div className="text-xl font-mono font-bold text-secondary">{totalHash.toFixed(0)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Combined units</div>
        </CyberCard>
        <CyberCard glowColor="gold">
          <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Efficiency</span><GlowingIcon icon={Gauge} size="sm" color="gold" animated={false} /></div>
          <div className="text-xl font-mono font-bold text-crypto-gold">{avgEff.toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">Avg fleet output</div>
        </CyberCard>
      </div>

      {/* Plan picker */}
      <CyberCard glowColor="purple">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-mono font-bold flex items-center gap-2"><Bitcoin className="h-5 w-5 text-crypto-gold" /> Hashpower Marketplace</h2>
            <p className="text-sm text-muted-foreground">Pick a coin, then a plan. Funds lock from Mining Wallet for the runtime.</p>
          </div>
          <div className="flex gap-2">
            {(['BTC','LTC','DOGE'] as Coin[]).map(c => (
              <button key={c} onClick={() => setSelectedCoin(c)} className={`px-4 py-2 rounded-lg font-mono text-sm border transition-all ${selectedCoin===c ? 'border-primary bg-primary/20 text-primary neon-glow-purple' : 'border-muted/40 text-muted-foreground hover:border-primary/40'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS[selectedCoin].map(p => {
            const cta = p.tier === 'Basic' ? 'Start Mining' : p.tier === 'Pro' ? 'Allocate Power' : 'Activate Hashpower';
            const estDaily = (p.price * ((p.min + p.max) / 2) / 100).toFixed(2);
            const estTotal = (p.price * ((p.min + p.max) / 2) / 100 * p.days).toFixed(0);
            return (
              <div key={p.tier} className={`relative rounded-xl p-5 border bg-muted/5 hover:bg-muted/10 transition-all hover:scale-[1.02] overflow-hidden ${p.tier==='Pro' ? 'border-primary/40' : p.tier==='Elite' ? 'border-crypto-gold/40' : 'border-secondary/40'}`}>
                {p.tier === 'Pro' && <Badge className="absolute -top-2 right-3 bg-primary">Popular</Badge>}
                {p.tier === 'Elite' && <Badge className="absolute -top-2 right-3 bg-crypto-gold text-background">Best Yield</Badge>}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 blur-3xl rounded-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className={`h-5 w-5 ${COIN_META[selectedCoin].color}`} />
                    <h3 className="font-mono font-bold text-lg">{selectedCoin} {p.tier}</h3>
                  </div>
                  <div className="space-y-1.5 text-sm font-mono mb-4">
                    <div className="flex justify-between"><span className="text-muted-foreground">Hashrate</span><span>{p.hash} {COIN_META[selectedCoin].unit}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Efficiency</span><span className="text-success">{p.eff}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Runtime</span><span>{p.days} days</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Daily Yield</span><span className="text-crypto-gold">{p.min}%–{p.max}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Daily</span><span className="text-success">~{estDaily} USDT</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Total</span><span className="text-success">~{estTotal} USDT</span></div>
                  </div>
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-xs text-muted-foreground">Allocation</span>
                    <span className="text-2xl font-mono font-bold gradient-text">{p.price} USDT</span>
                  </div>
                  <NeonButton glowColor={p.glow} onClick={() => startRental(p.tier)} disabled={busy===`start-${p.tier}`} className="w-full">
                    {busy===`start-${p.tier}` ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    {cta}
                  </NeonButton>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">Principal returns after {p.days}d</p>
                </div>
              </div>
            );
          })}
        </div>
      </CyberCard>

      {/* Active rentals */}
      <CyberCard glowColor="cyan">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2"><Flame className="h-5 w-5 text-accent" /> Active Hashpower</h2>
        {active.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Server className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p>No active rentals. Activate a plan above to start mining.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map(r => {
              const totalMs = new Date(r.ends_at).getTime() - new Date(r.started_at).getTime();
              const elapsedMs = Math.min(totalMs, Date.now() - new Date(r.started_at).getTime());
              const progress = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
              return (
                <div key={r.id} className="relative rounded-xl border border-primary/40 bg-primary/5 p-4 overflow-hidden">
                  {/* mining FX */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 blur-3xl rounded-full animate-pulse pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="absolute w-1 h-1 bg-primary rounded-full animate-ping" style={{ top: `${15+i*13}%`, left: `${8+i*15}%`, animationDelay: `${i*0.35}s` }} />
                    ))}
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="relative animate-pulse">
                          <Server className={`h-6 w-6 ${COIN_META[r.coin].color}`} />
                          <div className="absolute inset-0 rounded-full border border-primary animate-ping" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm">{r.coin} {r.tier}</div>
                          <div className="text-[10px] text-muted-foreground">Hashrate {r.hashrate} {COIN_META[r.coin].unit}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-primary text-primary animate-pulse">Mining</Badge>
                    </div>

                    <div className="text-xs space-y-1.5 font-mono mb-3">
                      <div className="flex justify-between text-muted-foreground"><span className="flex items-center gap-1"><Lock className="h-3 w-3" />Locked</span><span className="text-crypto-gold">{fmt(r.locked_amount, 2)} USDT</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Daily Range</span><span className="text-secondary">{r.daily_min_pct}%–{r.daily_max_pct}%</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Efficiency</span><span className="text-success">{r.efficiency}%</span></div>
                      <div className="flex justify-between text-muted-foreground"><span><Clock className="h-3 w-3 inline mr-1" />Runtime left</span><span className="text-primary"><Countdown endsAt={r.ends_at} /></span></div>
                      <div className="flex justify-between text-muted-foreground"><span className="flex items-center gap-1"><Activity className="h-3 w-3" />Live profit</span><LiveProfit rental={r} /></div>
                    </div>

                    <div className="mb-2">
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                        <span>{progress.toFixed(1)}% complete</span>
                        <span>{r.runtime_days}d total</span>
                      </div>
                    </div>

                    <div className="text-center text-[11px] text-primary py-1 animate-pulse font-mono">⚡ Hashpower streaming yields hourly</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

      {/* Completed rentals */}
      {completed.length > 0 && (
        <CyberCard glowColor="green">
          <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-success" /> Completed Rentals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {completed.map(r => (
              <div key={r.id} className="rounded-lg border border-muted/40 bg-muted/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className={`h-4 w-4 ${COIN_META[r.coin].color}`} />
                    <span className="font-mono text-sm font-bold">{r.coin} {r.tier}</span>
                  </div>
                  <Badge variant="outline" className="border-success/50 text-success text-[10px]">Unlocked</Badge>
                </div>
                <div className="text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-muted-foreground"><span>Allocated</span><span>{fmt(r.locked_amount, 2)} USDT</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Yield earned</span><span className="text-success">+{fmt(r.total_yield, 4)} USDT</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Runtime</span><span>{r.runtime_days}d</span></div>
                </div>
              </div>
            ))}
          </div>
        </CyberCard>
      )}
    </div>
  );
};

export default Mining;
