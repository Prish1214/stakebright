import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/badge';
import { Pickaxe, Zap, Cpu, Activity, RefreshCw, Award, Server, Bitcoin, Clock, Flame } from 'lucide-react';

type Coin = 'BTC' | 'LTC' | 'DOGE';
type Tier = 'Basic' | 'Pro' | 'Elite';

interface Profile {
  wallet_balance: number;
  staking_wallet: number;
  mining_wallet: number;
  trading_wallet: number;
}

interface Miner {
  id: string;
  miner_type: Coin;
  miner_tier: Tier;
  hashrate: number;
  efficiency: number;
  lifespan_days: number;
  price: number;
  min_daily_return: number;
  max_daily_return: number;
  expires_at: string;
  mining_ends_at: string | null;
  is_mining: boolean;
  total_mined: number;
}

const TIERS: { tier: Tier; price: number; hashrate: number; eff: number; days: number; min: number; max: number; glow: 'cyan' | 'purple' | 'gold' }[] = [
  { tier: 'Basic', price: 50, hashrate: 10, eff: 85, days: 30, min: 0.5, max: 1.5, glow: 'cyan' },
  { tier: 'Pro', price: 200, hashrate: 50, eff: 92, days: 60, min: 2.5, max: 5.0, glow: 'purple' },
  { tier: 'Elite', price: 750, hashrate: 200, eff: 98, days: 90, min: 10, max: 20, glow: 'gold' },
];

const COIN_META: Record<Coin, { color: string; label: string; unit: string }> = {
  BTC: { color: 'text-crypto-gold', label: 'Bitcoin', unit: 'TH/s' },
  LTC: { color: 'text-secondary', label: 'Litecoin', unit: 'GH/s' },
  DOGE: { color: 'text-accent', label: 'Dogecoin', unit: 'MH/s' },
};

const Countdown = ({ endsAt }: { endsAt: string }) => {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date(endsAt).getTime() - Date.now();
      if (d <= 0) { setT('Ready to claim'); return; }
      const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000), s = Math.floor((d % 60000) / 1000);
      setT(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [endsAt]);
  return <span className="font-mono">{t}</span>;
};

const Mining = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [miners, setMiners] = useState<Miner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<Coin>('BTC');

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: p }, { data: m }] = await Promise.all([
      (supabase as any).from('profiles').select('wallet_balance, staking_wallet, mining_wallet, trading_wallet').eq('user_id', user.id).single(),
      (supabase as any).from('user_miners').select('*').eq('user_id', user.id).order('purchased_at', { ascending: false }),
    ]);
    setProfile(p);
    setMiners(m || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);

  const purchase = async (tier: Tier) => {
    setBusy(`buy-${tier}`);
    try {
      const { error } = await (supabase as any).rpc('purchase_miner', { p_type: selectedCoin, p_tier: tier });
      if (error) throw error;
      toast({ title: 'Miner Purchased!', description: `${selectedCoin} ${tier} miner added to your fleet.` });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Purchase failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const startMining = async (id: string) => {
    setBusy(id);
    try {
      const { error } = await (supabase as any).rpc('start_miner', { p_miner_id: id });
      if (error) throw error;
      toast({ title: 'Mining started', description: '24h cycle active.' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Cannot start', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const claim = async (id: string) => {
    setBusy(id);
    try {
      const { data, error } = await (supabase as any).rpc('claim_miner_rewards', { p_miner_id: id });
      if (error) throw error;
      toast({ title: 'Rewards claimed!', description: `+${Number((data as any).reward).toFixed(4)} USDT to Mining Wallet` });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Claim failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => <div key={i} className="cyber-card rounded-xl p-6 animate-pulse h-40" />)}
    </div>
  );

  const totalMined = miners.reduce((s, m) => s + Number(m.total_mined), 0);
  const activeCount = miners.filter(m => m.is_mining).length;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-mono font-bold gradient-text flex items-center gap-3">
            <Pickaxe className="h-8 w-8 text-primary" />
            Cloud Mining
          </h1>
          <p className="text-muted-foreground mt-1">Buy miners, run them for 24h, claim variable BTC/LTC/DOGE rewards.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Mining Wallet</p>
            <p className="text-xl font-mono font-bold text-crypto-gold">
              <AnimatedNumber value={Number(profile?.mining_wallet || 0)} glowColor="gold" suffix=" USDT" />
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CyberCard glowColor="purple"><div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Total Mined</span><GlowingIcon icon={Zap} size="sm" color="purple" animated={false} /></div><div className="text-xl font-mono font-bold text-primary"><AnimatedNumber value={totalMined} glowColor="purple" suffix=" USDT" decimals={4} /></div></CyberCard>
        <CyberCard glowColor="cyan"><div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Active Rigs</span><GlowingIcon icon={Activity} size="sm" color="cyan" animated={false} /></div><div className="text-xl font-mono font-bold text-secondary">{activeCount} / {miners.length}</div></CyberCard>
        <CyberCard glowColor="gold"><div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Owned Miners</span><GlowingIcon icon={Server} size="sm" color="gold" animated={false} /></div><div className="text-xl font-mono font-bold text-crypto-gold">{miners.length}</div></CyberCard>
        <CyberCard glowColor="green"><div className="flex items-center justify-between mb-2"><span className="text-xs uppercase font-mono text-muted-foreground">Hashpower</span><GlowingIcon icon={Cpu} size="sm" color="green" animated={false} /></div><div className="text-xl font-mono font-bold text-success">{miners.reduce((s, m) => s + Number(m.hashrate), 0).toFixed(0)}</div></CyberCard>
      </div>

      {/* Marketplace */}
      <CyberCard glowColor="purple">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-mono font-bold flex items-center gap-2"><Bitcoin className="h-5 w-5 text-crypto-gold" /> Miner Marketplace</h2>
            <p className="text-sm text-muted-foreground">Pick a coin, then a tier. Funds come from your Mining Wallet.</p>
          </div>
          <div className="flex gap-2">
            {(['BTC','LTC','DOGE'] as Coin[]).map(c => (
              <button key={c} onClick={() => setSelectedCoin(c)} className={`px-4 py-2 rounded-lg font-mono text-sm border transition-all ${selectedCoin===c ? 'border-primary bg-primary/20 text-primary' : 'border-muted/40 text-muted-foreground hover:border-primary/40'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map(t => (
            <div key={t.tier} className={`relative rounded-xl p-5 border bg-muted/5 hover:bg-muted/10 transition-all hover:scale-[1.02] ${t.tier==='Pro' ? 'border-primary/40' : t.tier==='Elite' ? 'border-crypto-gold/40' : 'border-secondary/40'}`}>
              {t.tier === 'Pro' && <Badge className="absolute -top-2 right-3 bg-primary">Popular</Badge>}
              <div className="flex items-center gap-2 mb-3">
                <Server className={`h-5 w-5 ${COIN_META[selectedCoin].color}`} />
                <h3 className="font-mono font-bold text-lg">{selectedCoin} {t.tier}</h3>
              </div>
              <div className="space-y-1.5 text-sm font-mono mb-4">
                <div className="flex justify-between"><span className="text-muted-foreground">Hashrate</span><span>{t.hashrate} {COIN_META[selectedCoin].unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Efficiency</span><span className="text-success">{t.eff}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lifespan</span><span>{t.days} days</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Daily Reward</span><span className="text-crypto-gold">{t.min}–{t.max} USDT</span></div>
              </div>
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-xs text-muted-foreground">Price</span>
                <span className="text-2xl font-mono font-bold gradient-text">{t.price} USDT</span>
              </div>
              <NeonButton glowColor={t.glow} onClick={() => purchase(t.tier)} disabled={busy===`buy-${t.tier}`} className="w-full">
                {busy===`buy-${t.tier}` ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Pickaxe className="h-4 w-4 mr-2" />}
                Buy Miner
              </NeonButton>
            </div>
          ))}
        </div>
      </CyberCard>

      {/* My Miners */}
      <CyberCard glowColor="cyan">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2"><Flame className="h-5 w-5 text-accent" /> My Mining Fleet</h2>
        {miners.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Server className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p>No miners yet. Buy one above to start earning.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {miners.map(m => {
              const finished = m.is_mining && m.mining_ends_at && new Date(m.mining_ends_at).getTime() <= Date.now();
              const expired = new Date(m.expires_at).getTime() <= Date.now();
              return (
                <div key={m.id} className={`relative rounded-xl border p-4 overflow-hidden ${m.is_mining ? 'border-primary/50 bg-primary/5' : 'border-muted/40 bg-muted/5'}`}>
                  {m.is_mining && !finished && (
                    <>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 blur-3xl rounded-full animate-pulse pointer-events-none" />
                      <div className="absolute inset-0 pointer-events-none">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="absolute w-1 h-1 bg-primary rounded-full animate-ping" style={{ top: `${20+i*15}%`, left: `${10+i*18}%`, animationDelay: `${i*0.4}s` }} />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`relative ${m.is_mining ? 'animate-pulse' : ''}`}>
                          <Server className={`h-6 w-6 ${COIN_META[m.miner_type].color}`} />
                          {m.is_mining && !finished && <div className="absolute inset-0 rounded-full border border-primary animate-ping" />}
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm">{m.miner_type} {m.miner_tier}</div>
                          <div className="text-[10px] text-muted-foreground">Mined: {Number(m.total_mined).toFixed(4)} USDT</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={m.is_mining ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}>
                        {expired ? 'Expired' : m.is_mining ? (finished ? 'Ready' : 'Mining') : 'Idle'}
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1 font-mono mb-3">
                      <div className="flex justify-between text-muted-foreground"><span>Hashrate</span><span className="text-foreground">{m.hashrate} {COIN_META[m.miner_type].unit}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Reward range</span><span className="text-crypto-gold">{m.min_daily_return}–{m.max_daily_return} USDT</span></div>
                      {m.is_mining && m.mining_ends_at && (
                        <div className="flex justify-between text-muted-foreground"><span><Clock className="h-3 w-3 inline mr-1" />Ends in</span><span className="text-primary"><Countdown endsAt={m.mining_ends_at} /></span></div>
                      )}
                    </div>

                    {/* progress ring */}
                    {m.is_mining && m.mining_ends_at && !finished && (
                      <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden mb-3">
                        <div className="absolute inset-y-0 left-0 bg-neon-gradient animate-pulse" style={{ width: `${Math.min(100, ((Date.now() - new Date(m.mining_ends_at).getTime() + 86400000) / 86400000) * 100)}%` }} />
                      </div>
                    )}

                    {expired ? (
                      <div className="text-center text-xs text-muted-foreground py-2">Lifespan ended</div>
                    ) : finished ? (
                      <NeonButton glowColor="cyan" onClick={() => claim(m.id)} disabled={busy===m.id} className="w-full text-sm">
                        {busy===m.id ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Award className="h-3 w-3 mr-2" />}
                        Claim Rewards
                      </NeonButton>
                    ) : !m.is_mining ? (
                      <NeonButton onClick={() => startMining(m.id)} disabled={busy===m.id} className="w-full text-sm">
                        {busy===m.id ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Pickaxe className="h-3 w-3 mr-2" />}
                        Start 24h Mining
                      </NeonButton>
                    ) : (
                      <div className="text-center text-xs text-primary py-2 animate-pulse">⚡ Mining in progress...</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

      {profile && (
        <WalletTransferModal
          open={transferOpen}
          onOpenChange={setTransferOpen}
          balances={{ main: profile.wallet_balance, staking: profile.staking_wallet, mining: profile.mining_wallet, trading: profile.trading_wallet }}
          defaultFrom="main"
          defaultTo="mining"
          onTransferred={fetchAll}
        />
      )}
    </div>
  );
};

export default Mining;
