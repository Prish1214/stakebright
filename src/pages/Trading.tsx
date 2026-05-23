import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import LiveMarketCharts from '@/components/LiveMarketCharts';
import { TradingReferralTeam } from '@/components/TradingReferralTeam';
import NeonButton from '@/components/ui/NeonButton';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity, Brain, Cpu, Zap, RefreshCw, Award, TrendingUp, TrendingDown,
  Shield, Crown, Sparkles, Radar, Target, Gauge, Users, Lock, CheckCircle2, Timer,
} from 'lucide-react';

type Sym = 'BTC' | 'ETH' | 'SOL' | 'BNB';
type Phase = 'idle' | 'scanning' | 'analyzing' | 'executing' | 'complete';

interface Profile {
  staking_wallet: number; mining_wallet: number; trading_wallet: number;
}

interface Session {
  id: string; capital: number; started_at: string; profit: number; win_rate: number;
  status: string; trades_json?: any;
}

const LEVELS = [
  { lvl: 1, bal: 100,   refs: 0,   min: 0.8,  max: 1.0,  name: 'Recruit',   color: 'cyan',   icon: Shield },
  { lvl: 2, bal: 500,   refs: 3,   min: 1.05, max: 1.2,  name: 'Operator',  color: 'purple', icon: Target },
  { lvl: 3, bal: 1500,  refs: 8,   min: 1.5,  max: 1.7,  name: 'Strategist',color: 'pink',   icon: Radar },
  { lvl: 4, bal: 5000,  refs: 20,  min: 1.85, max: 2.0,  name: 'Commander', color: 'gold',   icon: Gauge },
  { lvl: 5, bal: 12000, refs: 50,  min: 2.2,  max: 2.6,  name: 'Architect', color: 'pink',   icon: Sparkles },
  { lvl: 6, bal: 30000, refs: 100, min: 3.2,  max: 3.5,  name: 'Sovereign', color: 'gold',   icon: Crown },
] as const;

const SYMS: Sym[] = ['BTC', 'ETH', 'SOL', 'BNB'];

interface ScalpTrade { id: number; sym: Sym; side: 'BUY' | 'SELL'; pnl: number; }

const computeLevel = (bal: number, refs: number) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const L = LEVELS[i];
    if (bal >= L.bal && refs >= L.refs) return L;
  }
  return null;
};

const Trading = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refsCount, setRefsCount] = useState(0);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [scanTrades, setScanTrades] = useState<ScalpTrade[]>([]);
  const [livePnl, setLivePnl] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [finalProfit, setFinalProfit] = useState<number | null>(null);
  const tradeIdRef = useRef(0);
  const [now, setNow] = useState(Date.now());

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: p }, { data: sessions }, { count }] = await Promise.all([
      (supabase as any).from('profiles').select('staking_wallet, mining_wallet, trading_wallet').eq('user_id', user.id).single(),
      (supabase as any).from('trading_sessions').select('*').eq('user_id', user.id).eq('status', 'scalp').order('started_at', { ascending: false }).limit(15),
      (supabase as any).from('profiles').select('user_id', { count: 'exact', head: true }).eq('referred_by', user.id).gte('trading_wallet', 100),
    ]);
    setProfile(p);
    setRefsCount(count || 0);
    const list: Session[] = sessions || [];
    setLastSession(list[0] || null);
    setHistory(list);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const currentLevel = useMemo(
    () => computeLevel(Number(profile?.trading_wallet || 0), refsCount),
    [profile, refsCount],
  );
  const nextLevel = currentLevel ? LEVELS.find(l => l.lvl === currentLevel.lvl + 1) : LEVELS[0];

  const cooldownMs = lastSession ? Math.max(0, new Date(lastSession.started_at).getTime() + 24 * 3600_000 - now) : 0;
  const onCooldown = cooldownMs > 0;
  const hh = Math.floor(cooldownMs / 3600_000);
  const mm = Math.floor((cooldownMs % 3600_000) / 60_000);
  const ss = Math.floor((cooldownMs % 60_000) / 1000);

  const canRun = !!profile && Number(profile.trading_wallet) >= 100 && !onCooldown && phase === 'idle';

  const runScalp = async () => {
    if (!canRun) return;
    setBusy(true);
    setPhase('scanning');
    setScanTrades([]);
    setLivePnl(0);
    setScanProgress(0);
    setFinalProfit(null);

    const totalMs = 10000 + Math.floor(Math.random() * 15000); // 10-25s
    const start = Date.now();
    const capital = Number(profile!.trading_wallet);

    // phase transitions
    const phaseTimer1 = setTimeout(() => setPhase('analyzing'), Math.floor(totalMs * 0.25));
    const phaseTimer2 = setTimeout(() => setPhase('executing'), Math.floor(totalMs * 0.5));

    // animated scan trades
    const tradeInterval = setInterval(() => {
      const sym = SYMS[Math.floor(Math.random() * SYMS.length)];
      const side: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const pnl = (Math.random() - 0.35) * capital * 0.0025;
      const t: ScalpTrade = { id: ++tradeIdRef.current, sym, side, pnl };
      setScanTrades(prev => [t, ...prev].slice(0, 14));
      setLivePnl(prev => prev + pnl);
    }, 600);

    // progress
    const progInterval = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - start) / totalMs) * 100);
      setScanProgress(pct);
    }, 100);

    // wait for the simulated scan to finish, then call backend
    await new Promise(r => setTimeout(r, totalMs));
    clearInterval(tradeInterval);
    clearInterval(progInterval);
    clearTimeout(phaseTimer1);
    clearTimeout(phaseTimer2);
    setScanProgress(100);

    try {
      const { data, error } = await (supabase as any).rpc('run_ai_scalping');
      if (error) throw error;
      const r = data as any;
      setFinalProfit(Number(r.profit));
      setPhase('complete');
      toast({
        title: `Scalp Complete · L${r.level}`,
        description: `Net Profit: +${Number(r.profit).toFixed(4)} USDT (${Number(r.pct).toFixed(2)}%)`,
      });
      await fetchAll();
      setTimeout(() => { setPhase('idle'); setScanTrades([]); setLivePnl(0); setFinalProfit(null); }, 6000);
    } catch (e: any) {
      toast({ title: 'AI Scalp failed', description: e.message, variant: 'destructive' });
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="cyber-card rounded-xl p-6 animate-pulse h-40" />;

  const balance = Number(profile?.trading_wallet || 0);
  const phaseLabel: Record<Phase, string> = {
    idle: 'Standby', scanning: 'Scanning Markets', analyzing: 'Analyzing Volatility',
    executing: 'Executing Scalps', complete: 'Cycle Complete',
  };
  const winCount = scanTrades.filter(t => t.pnl > 0).length;
  const winRate = scanTrades.length ? Math.round((winCount / scanTrades.length) * 100) : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-mono font-bold gradient-text flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            AI Scalping Engine
          </h1>
          <p className="text-muted-foreground mt-1">Level-based autonomous scalping bot · 24h cooldown per cycle.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Trading Wallet</p>
          <p className="text-2xl font-mono font-bold text-accent">
            <AnimatedNumber value={balance} glowColor="pink" suffix=" USDT" />
          </p>
        </div>
      </div>

      {/* Live market charts */}
      <LiveMarketCharts />

      {/* Rank + Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Rank badge */}
        <CyberCard glowColor={(currentLevel?.color as any) || 'cyan'} className="relative overflow-hidden">
          <div className="absolute inset-0 bg-neon-gradient opacity-5" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">AI Rank</span>
              {currentLevel && (
                <Badge variant="outline" className="border-primary text-primary font-mono">
                  L{currentLevel.lvl}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className={`relative h-20 w-20 rounded-2xl border-2 border-primary/40 flex items-center justify-center bg-background/60 ${currentLevel ? 'animate-pulse-slow' : 'opacity-50'}`}>
                {currentLevel ? <currentLevel.icon className="h-10 w-10 text-primary" /> : <Lock className="h-10 w-10 text-muted-foreground" />}
                {currentLevel && <div className="absolute inset-0 rounded-2xl border border-primary animate-ping opacity-30" />}
              </div>
              <div>
                <p className="text-2xl font-mono font-bold gradient-text">{currentLevel?.name || 'Unranked'}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {currentLevel ? `${currentLevel.min}% – ${currentLevel.max}% / cycle` : 'Deposit 100+ USDT to unlock L1'}
                </p>
              </div>
            </div>

            {nextLevel && (
              <div className="space-y-2 pt-3 border-t border-primary/10">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Next: L{nextLevel.lvl} {nextLevel.name}</span>
                  <span className="text-primary">+{nextLevel.min}–{nextLevel.max}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="rounded border border-primary/20 p-2 bg-background/40">
                    <div className="text-muted-foreground uppercase">Balance</div>
                    <div className={balance >= nextLevel.bal ? 'text-success' : 'text-foreground'}>
                      {balance.toFixed(0)} / {nextLevel.bal}
                    </div>
                  </div>
                  <div className="rounded border border-primary/20 p-2 bg-background/40">
                    <div className="text-muted-foreground uppercase">Active Refs</div>
                    <div className={refsCount >= nextLevel.refs ? 'text-success' : 'text-foreground'}>
                      {refsCount} / {nextLevel.refs}
                    </div>
                  </div>
                </div>
                <Progress value={Math.min(100, (balance / nextLevel.bal) * 100)} className="h-1.5 mt-1" />
              </div>
            )}
          </div>
        </CyberCard>

        {/* Engine */}
        <CyberCard glowColor={phase !== 'idle' ? 'cyan' : 'purple'} className="lg:col-span-2 relative overflow-hidden">
          {phase !== 'idle' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent animate-pulse" />
          )}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`relative h-14 w-14 rounded-full border-2 flex items-center justify-center ${phase !== 'idle' ? 'border-primary animate-pulse' : 'border-muted'}`}>
                <Cpu className={`h-7 w-7 ${phase !== 'idle' ? 'text-primary' : 'text-muted-foreground'}`} />
                {phase !== 'idle' && <div className="absolute inset-0 rounded-full border border-primary animate-ping" />}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-mono font-bold">{phaseLabel[phase]}</h2>
                <p className="text-xs text-muted-foreground">
                  {phase === 'idle' && (onCooldown
                    ? `Cooldown active · next cycle in ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
                    : 'Activate to scan the market and execute scalps')}
                  {phase === 'scanning' && 'Sweeping order books across BTC · ETH · SOL · BNB'}
                  {phase === 'analyzing' && 'Calibrating volatility, liquidity, and momentum signals'}
                  {phase === 'executing' && 'Bot is firing high-frequency scalp trades'}
                  {phase === 'complete' && `Net profit secured to your Trading Wallet`}
                </p>
              </div>
              {phase !== 'idle' && (
                <Badge variant="outline" className="border-success text-success font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1.5" /> LIVE
                </Badge>
              )}
            </div>

            {(phase === 'scanning' || phase === 'analyzing' || phase === 'executing') && (
              <>
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1">
                    <span><Activity className="h-3 w-3 inline mr-1" /> Scan progress</span>
                    <span>{Math.floor(scanProgress)}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Live Pnl</div>
                    <div className={`font-mono font-bold ${livePnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Win Rate</div>
                    <div className="font-mono font-bold text-success">{winRate}%</div>
                  </div>
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Trades</div>
                    <div className="font-mono font-bold text-primary">{scanTrades.length}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/10 bg-background/30 p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {scanTrades.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs font-mono animate-fade-in-up">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={t.side === 'BUY' ? 'border-success text-success' : 'border-destructive text-destructive'}>
                          {t.side === 'BUY' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {t.side}
                        </Badge>
                        <span>{t.sym}/USDT</span>
                      </div>
                      <span className={t.pnl >= 0 ? 'text-success' : 'text-destructive'}>
                        {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(3)}
                      </span>
                    </div>
                  ))}
                  {!scanTrades.length && <p className="text-xs text-muted-foreground italic">Waiting for first execution...</p>}
                </div>
              </>
            )}

            {phase === 'complete' && finalProfit !== null && (
              <div className="rounded-xl border border-success/40 bg-success/5 p-5 text-center animate-scale-in">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
                <p className="text-xs font-mono uppercase text-muted-foreground">Net Profit Credited</p>
                <p className="text-3xl font-mono font-bold text-success mt-1">+{finalProfit.toFixed(4)} USDT</p>
              </div>
            )}

            <NeonButton
              onClick={runScalp}
              disabled={busy || !canRun}
              className="w-full text-base py-5"
              glowColor={canRun ? 'cyan' : 'purple'}
            >
              {phase !== 'idle' && phase !== 'complete' ? (
                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> {phaseLabel[phase]}...</>
              ) : onCooldown ? (
                <><Timer className="h-4 w-4 mr-2" /> Next Scalp in {String(hh).padStart(2,'0')}:{String(mm).padStart(2,'0')}:{String(ss).padStart(2,'0')}</>
              ) : balance < 100 ? (
                <><Lock className="h-4 w-4 mr-2" /> Need 100+ USDT in Trading Wallet</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Start AI Scalping</>
              )}
            </NeonButton>
          </div>
        </CyberCard>
      </div>

      {/* Level ladder */}
      <CyberCard glowColor="gold">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-crypto-gold" /> Rank Ladder
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LEVELS.map(L => {
            const unlocked = balance >= L.bal && refsCount >= L.refs;
            const isCurrent = currentLevel?.lvl === L.lvl;
            return (
              <div
                key={L.lvl}
                className={`rounded-xl border p-4 transition-all ${isCurrent ? 'border-primary bg-primary/5 neon-glow-purple' : unlocked ? 'border-success/40 bg-success/5' : 'border-primary/10 bg-background/40 opacity-70'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <L.icon className={`h-5 w-5 ${isCurrent ? 'text-primary' : unlocked ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-mono font-bold">L{L.lvl} · {L.name}</span>
                  </div>
                  {isCurrent ? <Badge variant="outline" className="border-primary text-primary">ACTIVE</Badge>
                    : unlocked ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="text-xs font-mono text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>Balance</span><span className="text-foreground">{L.bal} USDT</span></div>
                  <div className="flex justify-between"><span>Active Refs</span><span className="text-foreground">{L.refs}</span></div>
                  <div className="flex justify-between"><span>Return / cycle</span><span className="text-success font-bold">{L.min}% – {L.max}%</span></div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground font-mono mt-4 flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Active referral = a referred user holding 100+ USDT in their Trading Wallet (L1 unlocked).
        </p>
      </CyberCard>

      {/* History */}
      <CyberCard glowColor="purple">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Scalp History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scalp cycles completed yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(s => {
              const meta = s.trades_json as any;
              return (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-primary/10 bg-muted/10">
                  <div className="text-xs font-mono text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-primary text-primary">L{meta?.level || '?'}</Badge>
                    <span>{new Date(s.started_at).toLocaleString()}</span>
                    <span>· capital {Number(s.capital).toFixed(2)} USDT</span>
                    {meta?.pct && <span>· {Number(meta.pct).toFixed(2)}%</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-mono">
                    <span className="text-muted-foreground">Win {Number(s.win_rate).toFixed(1)}%</span>
                    <span className="text-success font-bold">+{Number(s.profit).toFixed(4)} USDT</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

      <TradingReferralTeam />
    </div>
  );
};

export default Trading;
