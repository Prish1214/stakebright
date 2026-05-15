import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import WalletTransferModal from '@/components/WalletTransferModal';
import ManualTradeModal from '@/components/ManualTradeModal';
import { Badge } from '@/components/ui/badge';
import { LineChart, ArrowDownUp, Activity, TrendingUp, TrendingDown, Cpu, Brain, Zap, RefreshCw, Award, BarChart3, Rocket } from 'lucide-react';

type Sym = 'BTC' | 'ETH' | 'SOL';

interface Profile {
  wallet_balance: number; staking_wallet: number; mining_wallet: number; trading_wallet: number;
}

interface Session {
  id: string;
  capital: number;
  started_at: string;
  ends_at: string;
  profit: number;
  win_rate: number;
  status: 'active' | 'claimed' | 'manual';
  trades_json?: any;
}

const SYMS: { sym: Sym; base: number; vol: number; color: string }[] = [
  { sym: 'BTC', base: 67800, vol: 350, color: 'text-crypto-gold' },
  { sym: 'ETH', base: 3450, vol: 28, color: 'text-secondary' },
  { sym: 'SOL', base: 178, vol: 2.5, color: 'text-accent' },
];

// --- Live Candlestick (SVG) — pulls real klines + price stream from Binance ---
const Chart = ({ sym, base, vol, color }: { sym: Sym; base: number; vol: number; color: string }) => {
  const pair = `${sym}USDT`;
  const [candles, setCandles] = useState<{ o: number; h: number; l: number; c: number }[]>(() => {
    // optimistic fallback while real data loads
    let p = base;
    return Array.from({ length: 30 }, () => {
      const o = p;
      const c = p + (Math.random() - 0.5) * vol;
      const h = Math.max(o, c) + Math.random() * vol * 0.5;
      const l = Math.min(o, c) - Math.random() * vol * 0.5;
      p = c;
      return { o, h, l, c };
    });
  });
  const [live, setLive] = useState(false);

  // Seed real klines (1m, last 30) and connect WS for live updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    const seed = async () => {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=30`);
        const data = await r.json();
        if (!Array.isArray(data) || cancelled) return;
        setCandles(data.map((k: any) => ({ o: +k[1], h: +k[2], l: +k[3], c: +k[4] })));
        setLive(true);
      } catch {/* keep fallback */}
    };
    seed();
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_1m`);
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg.k;
          if (!k) return;
          const candle = { o: +k.o, h: +k.h, l: +k.l, c: +k.c };
          setCandles(prev => {
            const next = [...prev];
            if (k.x) { next.shift(); next.push(candle); }
            else { next[next.length - 1] = candle; }
            return next;
          });
          setLive(true);
        } catch {/* ignore */}
      };
    } catch {/* ignore */}
    return () => { cancelled = true; ws?.close(); };
  }, [pair]);

  const min = Math.min(...candles.map(c => c.l));
  const max = Math.max(...candles.map(c => c.h));
  const range = max - min || 1;
  const W = 280, H = 110, cw = W / candles.length;
  const y = (v: number) => H - ((v - min) / range) * (H - 10) - 5;
  const last = candles[candles.length - 1].c;
  const first = candles[0].o;
  const up = last >= first;

  return (
    <div className="rounded-xl border border-primary/20 bg-background/50 p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold ${color}`}>{sym}/USDT</span>
          <Badge variant="outline" className={up ? 'border-success text-success' : 'border-destructive text-destructive'}>
            {up ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {(((last - first) / first) * 100).toFixed(2)}%
          </Badge>
        </div>
        <span className="font-mono text-sm">${last.toFixed(2)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        {candles.map((k, i) => {
          const x = i * cw + cw / 2;
          const isUp = k.c >= k.o;
          const fill = isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(k.h)} y2={y(k.l)} stroke={fill} strokeWidth="1" />
              <rect
                x={x - cw * 0.35}
                y={y(Math.max(k.o, k.c))}
                width={cw * 0.7}
                height={Math.max(1, Math.abs(y(k.o) - y(k.c)))}
                fill={fill}
                opacity="0.85"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// --- Trade ticker ---
interface FakeTrade { id: number; sym: Sym; side: 'BUY' | 'SELL'; pnl: number; ts: number; }

const Trading = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [trades, setTrades] = useState<FakeTrade[]>([]);
  const [livePnl, setLivePnl] = useState(0);
  const [now, setNow] = useState(Date.now());
  const tradeIdRef = useRef(0);

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: p }, { data: sessions }] = await Promise.all([
      (supabase as any).from('profiles').select('wallet_balance, staking_wallet, mining_wallet, trading_wallet').eq('user_id', user.id).single(),
      (supabase as any).from('trading_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(20),
    ]);
    setProfile(p);
    const list: Session[] = sessions || [];
    setActiveSession(list.find(s => s.status === 'active') || null);
    setPastSessions(list.filter(s => s.status === 'claimed' || s.status === 'manual'));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);

  // Live ticker
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Generate fake trades + live pnl while session active
  useEffect(() => {
    if (!activeSession || new Date(activeSession.ends_at).getTime() <= Date.now()) return;
    const i = setInterval(() => {
      const sym = (['BTC', 'ETH', 'SOL'] as Sym[])[Math.floor(Math.random() * 3)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const pnl = (Math.random() - 0.42) * activeSession.capital * 0.003;
      const t: FakeTrade = { id: ++tradeIdRef.current, sym, side, pnl, ts: Date.now() };
      setTrades(prev => [t, ...prev].slice(0, 12));
      setLivePnl(prev => prev + pnl);
    }, 2200);
    return () => clearInterval(i);
  }, [activeSession]);

  const start = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('start_trading_session');
      if (error) throw error;
      toast({ title: 'AI Trading Activated', description: 'Auto-trade running for 24h.' });
      setLivePnl(0);
      setTrades([]);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Cannot start', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const claim = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('claim_trading_session');
      if (error) throw error;
      const r = data as any;
      toast({ title: 'Session Closed', description: `PnL: ${Number(r.profit).toFixed(2)} USDT · Win rate ${r.win_rate}%` });
      setLivePnl(0);
      setTrades([]);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Claim failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const sessionFinished = activeSession && new Date(activeSession.ends_at).getTime() <= now;
  const remainingMs = activeSession ? new Date(activeSession.ends_at).getTime() - now : 0;
  const hours = Math.max(0, Math.floor(remainingMs / 3600000));
  const minutes = Math.max(0, Math.floor((remainingMs % 3600000) / 60000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  const sentiment = useMemo(() => {
    const r = (Math.sin(now / 60000) + 1) / 2; // 0..1
    if (r > 0.66) return { label: 'Bullish', color: 'text-success', val: 70 + Math.round(r * 25) };
    if (r > 0.33) return { label: 'Neutral', color: 'text-crypto-gold', val: 40 + Math.round(r * 25) };
    return { label: 'Bearish', color: 'text-destructive', val: 20 + Math.round(r * 20) };
  }, [Math.floor(now / 5000)]);

  const winRate = trades.length ? Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100) : 0;

  if (loading) return <div className="cyber-card rounded-xl p-6 animate-pulse h-40" />;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-mono font-bold gradient-text flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            AI Trading Bot
          </h1>
          <p className="text-muted-foreground mt-1">Premium scalping bot trading BTC / ETH / SOL with adaptive strategies.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Trading Wallet</p>
            <p className="text-xl font-mono font-bold text-accent">
              <AnimatedNumber value={Number(profile?.trading_wallet || 0)} glowColor="pink" suffix=" USDT" />
            </p>
          </div>
          <NeonButton glowColor="pink" onClick={() => setTransferOpen(true)}>
            <ArrowDownUp className="h-4 w-4 mr-2" /> Transfer
          </NeonButton>
          <NeonButton onClick={() => setTradeOpen(true)} disabled={!profile?.trading_wallet}>
            <Rocket className="h-4 w-4 mr-2" /> Place Trade
          </NeonButton>
        </div>
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SYMS.map(s => <Chart key={s.sym} {...s} />)}
      </div>

      {/* Bot Control */}
      <CyberCard glowColor={activeSession ? 'cyan' : 'purple'} className="relative overflow-hidden">
        {activeSession && !sessionFinished && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent animate-pulse" />
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`relative h-14 w-14 rounded-full border-2 flex items-center justify-center ${activeSession ? 'border-primary animate-pulse' : 'border-muted'}`}>
                <Cpu className={`h-7 w-7 ${activeSession ? 'text-primary' : 'text-muted-foreground'}`} />
                {activeSession && <div className="absolute inset-0 rounded-full border border-primary animate-ping" />}
              </div>
              <div>
                <h2 className="text-xl font-mono font-bold">
                  {activeSession ? (sessionFinished ? 'Session Complete' : 'AI Bot Active') : 'Bot Standby'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeSession
                    ? sessionFinished ? 'Claim your PnL to start a new run.' : 'Scanning markets · executing scalp trades'
                    : 'Activate to run a 24-hour auto-trading cycle.'}
                </p>
              </div>
            </div>

            {activeSession && !sessionFinished && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>Time remaining</span>
                  <span className="text-primary text-base">{String(hours).padStart(2,'0')}:{String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Live PnL</div>
                    <div className={`font-mono font-bold ${livePnl >= 0 ? 'text-success' : 'text-destructive'}`}>{livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} USDT</div>
                  </div>
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Win Rate</div>
                    <div className="font-mono font-bold text-success">{winRate}%</div>
                  </div>
                  <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Sentiment</div>
                    <div className={`font-mono font-bold ${sentiment.color}`}>{sentiment.label} {sentiment.val}</div>
                  </div>
                </div>

                {/* Scanning bar */}
                <div className="rounded-lg border border-primary/20 p-3 bg-background/50">
                  <div className="flex items-center gap-2 text-xs font-mono mb-2"><Activity className="h-3 w-3 text-primary animate-pulse" /> AI scanning order books...</div>
                  <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 w-1/3 bg-neon-gradient rounded-full" style={{ animation: 'slide-in-right 2s linear infinite' }} />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              {!activeSession ? (
                <NeonButton onClick={start} disabled={busy || !profile?.trading_wallet} className="w-full text-base py-5">
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Activate Auto Trade (24h)
                </NeonButton>
              ) : sessionFinished ? (
                <NeonButton glowColor="cyan" onClick={claim} disabled={busy} className="w-full text-base py-5">
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Award className="h-4 w-4 mr-2" />}
                  Close Session & Claim PnL
                </NeonButton>
              ) : null}
              {!profile?.trading_wallet && !activeSession && (
                <p className="text-xs text-center text-muted-foreground mt-2">Trading Wallet is empty — transfer funds to activate.</p>
              )}
            </div>
          </div>

          {/* Trade tape */}
          <div className="border-l-0 lg:border-l border-primary/10 lg:pl-6">
            <h3 className="font-mono font-bold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Live Trades</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {trades.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{activeSession ? 'Waiting for first trade...' : 'No active session'}</p>
              ) : trades.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs font-mono p-2 rounded bg-muted/20 border border-primary/10 animate-fade-in-up">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={t.side === 'BUY' ? 'border-success text-success' : 'border-destructive text-destructive'}>{t.side}</Badge>
                    <span>{t.sym}</span>
                  </div>
                  <span className={t.pnl >= 0 ? 'text-success' : 'text-destructive'}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CyberCard>

      {/* Past sessions */}
      <CyberCard glowColor="gold">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2"><Award className="h-5 w-5 text-crypto-gold" /> Trading History</h2>
        {pastSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {pastSessions.map(s => {
              const isManual = s.status === 'manual';
              const meta = isManual && Array.isArray(s.trades_json) ? s.trades_json[0] : null;
              return (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-primary/10 bg-muted/10">
                  <div className="text-xs font-mono text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={isManual ? 'border-accent text-accent' : 'border-primary text-primary'}>
                      {isManual ? 'MANUAL' : 'AI 24H'}
                    </Badge>
                    {meta && (
                      <Badge variant="outline" className={meta.side === 'BUY' ? 'border-success text-success' : 'border-destructive text-destructive'}>
                        {meta.side} {meta.symbol}
                      </Badge>
                    )}
                    <span>{new Date(s.started_at).toLocaleString()} · size {Number(s.capital).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-mono">
                    {!isManual && <span className="text-muted-foreground">Win {Number(s.win_rate).toFixed(1)}%</span>}
                    <span className={Number(s.profit) >= 0 ? 'text-success font-bold' : 'text-destructive font-bold'}>
                      {Number(s.profit) >= 0 ? '+' : ''}{Number(s.profit).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

      {profile && (
        <>
          <WalletTransferModal
            open={transferOpen}
            onOpenChange={setTransferOpen}
            balances={{ main: profile.wallet_balance, staking: profile.staking_wallet, mining: profile.mining_wallet, trading: profile.trading_wallet }}
            defaultFrom="main"
            defaultTo="trading"
            onTransferred={fetchAll}
          />
          <ManualTradeModal
            open={tradeOpen}
            onOpenChange={setTradeOpen}
            tradingWallet={Number(profile.trading_wallet || 0)}
            onCompleted={fetchAll}
          />
        </>
      )}
    </div>
  );
};

export default Trading;
