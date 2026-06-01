import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Copy, Users, DollarSign, Link as LinkIcon, Share2, Trophy,
  Sparkles, Zap, TrendingUp, Coins, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Crown, Target,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Profile { referral_code: string; username: string | null; email: string; }
interface Earning {
  id: string; amount: number; percentage: number; created_at: string;
  referred_id: string; kind?: string;
}
interface StakingMember { user_id: string; username: string | null; created_at: string; total_deposits: number; qualified: boolean; }
interface TradingMember { user_id: string; username: string | null; created_at: string; qualified: boolean; trading_level: number; }

const TRADING_LEVELS = [
  { level: 1, refs: 0, capital: 100, bonus: 0 },
  { level: 2, refs: 3, capital: 500, bonus: 2 },
  { level: 3, refs: 8, capital: 1500, bonus: 3 },
  { level: 4, refs: 20, capital: 5000, bonus: 4 },
  { level: 5, refs: 50, capital: 12000, bonus: 5 },
  { level: 6, refs: 100, capital: 30000, bonus: 6 },
];

const initials = (name?: string | null) =>
  (name || 'U').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();

const Referrals = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [staking, setStaking] = useState<StakingMember[]>([]);
  const [trading, setTrading] = useState<TradingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  const fetchAll = async () => {
    try {
      const [{ data: prof }, { data: ern }, { data: stk }, { data: trd }] = await Promise.all([
        supabase.from('profiles').select('referral_code, username, email').eq('user_id', user!.id).single(),
        supabase.from('referral_earnings').select('id,amount,percentage,created_at,referred_id,kind').eq('referrer_id', user!.id).order('created_at', { ascending: false }),
        (supabase as any).rpc('get_staking_referral_team'),
        (supabase as any).rpc('get_trading_referral_team'),
      ]);
      setProfile(prof as any);
      setEarnings((ern as any) || []);
      setStaking((stk as any) || []);
      setTrading((trd as any) || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const totalEarnings = useMemo(() => earnings.reduce((s, e) => s + Number(e.amount), 0), [earnings]);
  const earningsByUser = useMemo(() => {
    const m = new Map<string, number>();
    earnings.forEach(e => m.set(e.referred_id, (m.get(e.referred_id) || 0) + Number(e.amount)));
    return m;
  }, [earnings]);

  // merge by user_id
  type TeamRow = {
    user_id: string; username: string | null; created_at: string;
    stakingActive: boolean; tradingActive: boolean; tradingLevel: number;
    earnings: number;
  };
  const team: TeamRow[] = useMemo(() => {
    const map = new Map<string, TeamRow>();
    staking.forEach(s => map.set(s.user_id, {
      user_id: s.user_id, username: s.username, created_at: s.created_at,
      stakingActive: s.qualified, tradingActive: false, tradingLevel: 0,
      earnings: earningsByUser.get(s.user_id) || 0,
    }));
    trading.forEach(t => {
      const ex = map.get(t.user_id);
      if (ex) { ex.tradingActive = t.qualified; ex.tradingLevel = t.trading_level; }
      else map.set(t.user_id, {
        user_id: t.user_id, username: t.username, created_at: t.created_at,
        stakingActive: false, tradingActive: t.qualified, tradingLevel: t.trading_level,
        earnings: earningsByUser.get(t.user_id) || 0,
      });
    });
    return Array.from(map.values()).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [staking, trading, earningsByUser]);

  const activeTradingRefs = team.filter(t => t.tradingActive).length;
  const activeStakingRefs = team.filter(t => t.stakingActive).length;

  const currentLevel = [...TRADING_LEVELS].reverse().find(l => activeTradingRefs >= l.refs) || TRADING_LEVELS[0];
  const nextLevel = TRADING_LEVELS.find(l => activeTradingRefs < l.refs);
  const refsToNext = nextLevel ? Math.max(0, nextLevel.refs - activeTradingRefs) : 0;
  const progressPct = nextLevel
    ? Math.min(100, ((activeTradingRefs - currentLevel.refs) / (nextLevel.refs - currentLevel.refs)) * 100)
    : 100;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  const share = async () => {
    const link = `${window.location.origin}/auth?ref=${profile?.referral_code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join StakeBright', text: 'Join me on StakeBright and start earning!', url: link }); }
      catch {/* canceled */}
    } else copy(link, 'Referral link');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const refLink = profile?.referral_code ? `${window.location.origin}/auth?ref=${profile.referral_code}` : '';

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 sm:p-8">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-crypto-gold animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-crypto-gold font-semibold">Referral Network</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-crypto-gold bg-clip-text text-transparent">
            Build Your Team. Earn Forever.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl">
            Earn a <span className="text-crypto-gold font-semibold">5% activation bonus</span> on staking,
            <span className="text-crypto-gold font-semibold"> 1% on every staking yield</span>, plus
            <span className="text-crypto-gold font-semibold"> up to 6% AI Trading team bonus</span> as your network levels up.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Total Referrals" value={team.length} color="primary" />
        <StatCard icon={Coins} label="Active Staking" value={activeStakingRefs} color="gold" />
        <StatCard icon={TrendingUp} label="Active Trading" value={activeTradingRefs} color="cyan" />
        <StatCard icon={DollarSign} label="Total Earnings" value={`${totalEarnings.toFixed(2)} USDT`} color="green" />
      </div>

      {/* Share */}
      <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Share2 className="h-5 w-5 text-primary" /> Your Invite Kit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Referral Code</Label>
            <div className="flex gap-2 mt-2">
              <Input readOnly value={profile?.referral_code || ''} className="font-mono text-base sm:text-lg tracking-widest" />
              <Button size="icon" onClick={() => copy(profile!.referral_code, 'Referral code')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Referral Link</Label>
            <div className="flex gap-2 mt-2">
              <Input readOnly value={refLink} className="text-xs sm:text-sm" />
              <Button size="icon" variant="outline" onClick={() => copy(refLink, 'Referral link')}>
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={share}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Trading Level Progress */}
      <Card className="border-secondary/30 bg-gradient-to-br from-card via-card to-secondary/5 overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Trophy className="h-5 w-5 text-crypto-gold" /> AI Trading Team Level
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Active referral = $100+ Trading Wallet balance
              </p>
            </div>
            <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0 px-3 py-1.5 text-sm">
              <Crown className="h-3.5 w-3.5 mr-1" /> Level {currentLevel.level}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* current bonus */}
          <div className="rounded-xl border border-crypto-gold/30 bg-gradient-to-r from-crypto-gold/10 to-transparent p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Team Bonus Unlocked</div>
                <div className="text-3xl sm:text-4xl font-bold text-crypto-gold mt-1">{currentLevel.bonus}%</div>
              </div>
              <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-crypto-gold/40" />
            </div>
          </div>

          {/* next level */}
          {nextLevel ? (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress to Level {nextLevel.level}</span>
                <span className="font-mono text-secondary">{activeTradingRefs}/{nextLevel.refs} refs</span>
              </div>
              <Progress
                value={progressPct}
                className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-secondary [&>div]:via-primary [&>div]:to-accent"
              />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <MiniStat label="Refs needed" value={refsToNext} accent="cyan" />
                <MiniStat label="Next bonus" value={`${nextLevel.bonus}%`} accent="gold" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Each next-level referral must also hold ≥ ${nextLevel.capital.toLocaleString()} in their Trading Wallet.
              </p>
            </div>
          ) : (
            <div className="text-center py-3">
              <Crown className="h-10 w-10 mx-auto text-crypto-gold animate-pulse" />
              <div className="font-bold text-crypto-gold mt-2">MAX LEVEL REACHED</div>
            </div>
          )}

          {/* Level grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {TRADING_LEVELS.map(l => {
              const reached = activeTradingRefs >= l.refs;
              const isCurrent = l.level === currentLevel.level;
              return (
                <div
                  key={l.level}
                  className={cn(
                    'relative rounded-lg border p-2 sm:p-3 text-center transition-all',
                    reached
                      ? 'border-crypto-gold/50 bg-gradient-to-br from-crypto-gold/20 to-crypto-gold/5 text-foreground'
                      : 'border-border/40 bg-muted/20 text-muted-foreground',
                    isCurrent && 'ring-2 ring-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
                  )}
                >
                  <div className="text-[10px] sm:text-xs uppercase opacity-80">Lv</div>
                  <div className="text-lg sm:text-2xl font-bold">{l.level}</div>
                  <div className="text-[10px] sm:text-xs mt-1">{l.bonus}%</div>
                  <div className="text-[9px] sm:text-[10px] opacity-70 mt-0.5">{l.refs} refs</div>
                  {reached && (
                    <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-crypto-gold bg-background rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* My Team — Tree */}
      <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-5 w-5 text-accent" /> My Team
              <Badge variant="outline" className="ml-1 border-accent/40 text-accent">{team.length}</Badge>
            </CardTitle>
            {team.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)} className="text-xs">
                {expanded ? <><ChevronDown className="h-4 w-4 mr-1" /> Collapse</> : <><ChevronRight className="h-4 w-4 mr-1" /> Expand</>}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Root */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-primary via-accent to-crypto-gold flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-[0_0_30px_hsl(var(--primary)/0.6)]">
                {initials(profile?.username || profile?.email)}
              </div>
              <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-crypto-gold text-black border-0 text-[10px] px-2">
                YOU
              </Badge>
            </div>
            <div className="mt-3 text-center">
              <div className="font-semibold">{profile?.username || 'You'}</div>
              <div className="text-xs text-muted-foreground">Network Root • Lv {currentLevel.level}</div>
            </div>

            {team.length > 0 && expanded && (
              <>
                {/* connector */}
                <div className="w-px h-6 bg-gradient-to-b from-primary to-transparent mt-2" />
                <div className="w-full mt-2 space-y-3">
                  {team.map((m, idx) => (
                    <TeamNode key={m.user_id} member={m} index={idx} />
                  ))}
                </div>
              </>
            )}

            {team.length === 0 && (
              <div className="mt-8 text-center py-6 w-full">
                <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-border to-transparent mb-4" />
                <Target className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mt-3">Your team grows here</p>
                <p className="text-xs text-muted-foreground mt-1">Share your code to recruit your first member</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="h-5 w-5 text-crypto-gold" /> Earnings History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No earnings yet — invite users to start earning.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {earnings.map(e => {
                const member = team.find(t => t.user_id === e.referred_id);
                const label = (e as any).kind === 'activation' ? '5% Activation'
                  : (e as any).kind === 'yield_share' ? '1% Yield Share'
                  : (e as any).kind === 'trading_team' ? 'AI Trading Team Bonus'
                  : `${e.percentage}% Commission`;
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/40 hover:border-crypto-gold/40 transition-colors">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(member?.username || 'U')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{member?.username || 'Member'}</div>
                        <div className="text-xs text-muted-foreground truncate">{label}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-sm font-bold text-crypto-gold">+{Number(e.amount).toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-crypto-gold/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">How Rewards Work</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
          <Step n={1} text="Share your unique referral code or link." />
          <Step n={2} text="When their staking deposits hit $50, you earn a one-time 5% activation bonus." />
          <Step n={3} text="Then earn 1% of every staking yield they ever receive — automatically, forever." />
          <Step n={4} text="Recruit traders with $100+ Trading Wallets to unlock AI Trading Team bonuses up to 6%." />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: 'primary'|'gold'|'cyan'|'green' }) => {
  const c = {
    primary: 'border-primary/30 from-primary/10 text-primary',
    gold: 'border-crypto-gold/30 from-crypto-gold/10 text-crypto-gold',
    cyan: 'border-secondary/30 from-secondary/10 text-secondary',
    green: 'border-success/30 from-success/10 text-success',
  }[color];
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br to-card p-3 sm:p-4 transition-all hover:scale-[1.02]', c)}>
      <Icon className="h-5 w-5 mb-2" />
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base sm:text-2xl font-bold text-foreground mt-1 break-all">{value}</div>
    </div>
  );
};

const MiniStat = ({ label, value, accent }: { label: string; value: any; accent: 'cyan'|'gold' }) => (
  <div className={cn(
    'rounded-lg border p-3 text-center',
    accent === 'cyan' ? 'border-secondary/30 bg-secondary/5' : 'border-crypto-gold/30 bg-crypto-gold/5'
  )}>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn('text-xl font-bold mt-1', accent === 'cyan' ? 'text-secondary' : 'text-crypto-gold')}>{value}</div>
  </div>
);

const TeamNode = ({ member, index }: { member: any; index: number }) => {
  const isActive = member.stakingActive || member.tradingActive;
  return (
    <div className="relative pl-4 sm:pl-8" style={{ animation: `fadeIn 0.4s ease ${index * 50}ms backwards` }}>
      {/* tree connector */}
      <span className="absolute left-0 top-0 bottom-1/2 w-4 sm:w-8 border-l-2 border-b-2 border-primary/30 rounded-bl-lg" />
      <div className={cn(
        'rounded-xl border p-3 sm:p-4 backdrop-blur transition-all',
        isActive
          ? 'border-crypto-gold/40 bg-gradient-to-r from-crypto-gold/10 to-transparent shadow-[0_0_20px_hsl(var(--crypto-gold)/0.15)]'
          : 'border-border/50 bg-card/40'
      )}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {isActive && <div className="absolute inset-0 rounded-full bg-crypto-gold/40 blur-md animate-pulse" />}
            <div className={cn(
              'relative h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center text-sm font-bold text-white',
              isActive
                ? 'bg-gradient-to-br from-crypto-gold via-accent to-primary'
                : 'bg-gradient-to-br from-muted to-muted-foreground/40'
            )}>
              {initials(member.username)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{member.username || 'Member'}</span>
              {member.tradingLevel > 0 && (
                <Badge variant="outline" className="border-secondary/40 text-secondary text-[10px] h-5">
                  <Trophy className="h-2.5 w-2.5 mr-0.5" /> L{member.tradingLevel}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Joined {new Date(member.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-crypto-gold">+{member.earnings.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">USDT</div>
          </div>
        </div>

        {/* status pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {member.stakingActive && (
            <Badge className="bg-crypto-gold/15 text-crypto-gold border border-crypto-gold/30 text-[10px] h-5 gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> Staking Active
            </Badge>
          )}
          {member.tradingActive && (
            <Badge className="bg-secondary/15 text-secondary border border-secondary/30 text-[10px] h-5 gap-1">
              <Zap className="h-2.5 w-2.5" /> Trading Active
            </Badge>
          )}
          {!member.stakingActive && !member.tradingActive && (
            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-[10px] h-5 gap-1">
              <Clock className="h-2.5 w-2.5" /> Not Qualified
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

const Step = ({ n, text }: { n: number; text: string }) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_15px_hsl(var(--primary)/0.4)]">
      {n}
    </div>
    <p className="text-foreground/90">{text}</p>
  </div>
);

export default Referrals;
