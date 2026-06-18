import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  ArrowDownToLine, ArrowUpFromLine, Copy, Coins, Pickaxe, LineChart as LineIcon,
  Users, Share2, TrendingUp, Wallet, Sparkles, Trophy, CheckCircle2,
} from 'lucide-react';

interface ProfileRow {
  username: string | null;
  email: string;
  referral_code: string;
  withdrawable_earnings: number;
  earnings_staking: number;
  earnings_mining: number;
  earnings_referral: number;
  staking_wallet: number;
  mining_wallet: number;
  trading_wallet: number;
  created_at: string;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const startOfTodayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [todayStaking, setTodayStaking] = useState(0);
  const [todayMining, setTodayMining] = useState(0);
  const [todayTrading, setTodayTrading] = useState(0);
  const [todayReferral, setTodayReferral] = useState(0);

  const [totalTrading, setTotalTrading] = useState(0);
  const [series, setSeries] = useState<{ day: string; staking: number; mining: number; trading: number; referral: number }[]>([]);

  const [teamCount, setTeamCount] = useState(0);
  const [activeTeamCount, setActiveTeamCount] = useState(0);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    try {
      const todayISO = startOfTodayUTC();
      const since = new Date(Date.now() - 29 * 86400000);
      since.setUTCHours(0, 0, 0, 0);
      const sinceISO = since.toISOString();

      const [
        { data: prof },
        { data: stakes },
        { data: rentals },
        { data: sessions },
        { data: refs },
        { data: team },
      ] = await Promise.all([
        (supabase as any).from('profiles')
          .select('username,email,referral_code,withdrawable_earnings,earnings_staking,earnings_mining,earnings_referral,staking_wallet,mining_wallet,trading_wallet,created_at')
          .eq('user_id', user!.id).single(),
        supabase.from('stakes').select('daily_return,is_active,end_date').eq('user_id', user!.id),
        (supabase as any).from('mining_rentals')
          .select('locked_amount,daily_min_pct,daily_max_pct,status,ends_at').eq('user_id', user!.id),
        (supabase as any).from('trading_sessions')
          .select('profit,started_at,status').eq('user_id', user!.id).gte('started_at', sinceISO),
        (supabase as any).from('referral_earnings')
          .select('amount,created_at,kind').eq('referrer_id', user!.id).gte('created_at', sinceISO),
        (supabase as any).rpc('get_staking_referral_team'),
      ]);

      setProfile(prof as any);

      // Today staking — sum daily_return of active, not-yet-ended stakes
      const tdStake = (stakes || [])
        .filter((s: any) => s.is_active && new Date(s.end_date) > new Date())
        .reduce((a: number, s: any) => a + Number(s.daily_return || 0), 0);
      setTodayStaking(tdStake);

      // Today mining — sum mid-pct daily yield of active rentals
      const tdMine = (rentals || [])
        .filter((r: any) => r.status === 'active' && new Date(r.ends_at) > new Date())
        .reduce((a: number, r: any) => {
          const mid = (Number(r.daily_min_pct) + Number(r.daily_max_pct)) / 2;
          return a + Number(r.locked_amount) * mid / 100;
        }, 0);
      setTodayMining(tdMine);

      // Trading — today + total (last 30d shown in chart, total = all-time profit)
      const tdTrade = (sessions || [])
        .filter((s: any) => s.started_at >= todayISO && (s.status === 'claimed' || s.status === 'scalp'))
        .reduce((a: number, s: any) => a + Number(s.profit || 0), 0);
      setTodayTrading(tdTrade);

      const { data: allSessions } = await (supabase as any)
        .from('trading_sessions').select('profit,status').eq('user_id', user!.id);
      const totTrade = (allSessions || [])
        .filter((s: any) => s.status === 'claimed' || s.status === 'scalp')
        .reduce((a: number, s: any) => a + Number(s.profit || 0), 0);
      setTotalTrading(totTrade);

      // Referral
      const tdRef = (refs || [])
        .filter((r: any) => r.created_at >= todayISO)
        .reduce((a: number, r: any) => a + Number(r.amount), 0);
      setTodayReferral(tdRef);

      // 30d series — referral & trading have timestamps; staking/mining approximated as daily_avg
      const days: Record<string, { staking: number; mining: number; trading: number; referral: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        d.setUTCHours(0, 0, 0, 0);
        days[d.toISOString().slice(0, 10)] = { staking: 0, mining: 0, trading: 0, referral: 0 };
      }
      (sessions || []).forEach((s: any) => {
        if (s.status !== 'claimed' && s.status !== 'scalp') return;
        const k = String(s.started_at).slice(0, 10);
        if (days[k]) days[k].trading += Number(s.profit || 0);
      });
      (refs || []).forEach((r: any) => {
        const k = String(r.created_at).slice(0, 10);
        if (days[k]) days[k].referral += Number(r.amount || 0);
      });
      // distribute today's staking/mining as a constant baseline across days where stake/rental was active
      Object.keys(days).forEach(k => {
        days[k].staking = tdStake;
        days[k].mining = tdMine;
      });
      setSeries(Object.entries(days).map(([day, v]) => ({ day: day.slice(5), ...v })));

      const teamArr = (team as any[]) || [];
      setTeamCount(teamArr.length);
      setActiveTeamCount(teamArr.filter((m: any) => m.qualified).length);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const referralLink = useMemo(
    () => profile?.referral_code ? `${window.location.origin}/auth?ref=${profile.referral_code}` : '',
    [profile?.referral_code]
  );

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const totalToday = todayStaking + todayMining + todayTrading + todayReferral;
  const totalAllTime =
    Number(profile?.earnings_staking || 0) +
    Number(profile?.earnings_mining || 0) +
    Number(profile?.earnings_referral || 0) +
    totalTrading;

  const initials = (profile?.username || profile?.email || 'U')
    .slice(0, 2).toUpperCase();

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Header */}
      <CyberCard glowColor="purple" className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <Avatar className="h-20 w-20 border-2 border-primary/40 neon-glow-purple">
          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-secondary/30 text-2xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold">{profile.username || profile.email.split('@')[0]}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's Earnings</p>
          <p className="text-3xl font-bold neon-text-cyan">${fmt(totalToday)}</p>
          <p className="text-xs text-muted-foreground">All-time: ${fmt(totalAllTime)}</p>
        </div>
      </CyberCard>

      {/* Today + Total per section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SectionCard
          icon={<Coins className="h-5 w-5" />}
          label="Staking" color="purple"
          today={todayStaking} total={Number(profile.earnings_staking || 0)}
        />
        <SectionCard
          icon={<Pickaxe className="h-5 w-5" />}
          label="Mining" color="gold"
          today={todayMining} total={Number(profile.earnings_mining || 0)}
        />
        <SectionCard
          icon={<LineIcon className="h-5 w-5" />}
          label="Trading" color="cyan"
          today={todayTrading} total={totalTrading}
        />
        <SectionCard
          icon={<Users className="h-5 w-5" />}
          label="Referral" color="pink"
          today={todayReferral} total={Number(profile.earnings_referral || 0)}
        />
      </div>

      {/* Analytics */}
      <CyberCard glowColor="cyan">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-secondary" />
            <h2 className="text-lg font-bold">Earnings Analytics — 30 days</h2>
          </div>
          <Badge variant="outline" className="border-secondary/40 text-secondary">Live</Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="pTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                formatter={(v: any) => `$${Number(v).toFixed(2)}`}
              />
              <Area type="monotone" dataKey={(d: any) => d.staking + d.mining + d.trading + d.referral}
                name="Daily Total" stroke="hsl(var(--primary))" fill="url(#pTotal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-56 mt-2">
          <ResponsiveContainer>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                formatter={(v: any) => `$${Number(v).toFixed(2)}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="staking" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="mining" stackId="a" fill="hsl(var(--crypto-gold, 45 100% 60%))" />
              <Bar dataKey="trading" stackId="a" fill="hsl(var(--secondary))" />
              <Bar dataKey="referral" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CyberCard>

      {/* Quick actions: Deposit / Withdraw */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/deposit">
          <CyberCard glowColor="green" hoverable className="h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10 border border-success/30">
                <ArrowDownToLine className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">Deposit Funds</h3>
                <p className="text-xs text-muted-foreground">Top up Staking / Mining / Trading</p>
              </div>
              <Sparkles className="h-4 w-4 text-success" />
            </div>
          </CyberCard>
        </Link>
        <Link to="/withdraw">
          <CyberCard glowColor="pink" hoverable className="h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/30">
                <ArrowUpFromLine className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">Withdraw</h3>
                <p className="text-xs text-muted-foreground">Earnings, Trading & Unlocked Principal</p>
              </div>
              <Wallet className="h-4 w-4 text-accent" />
            </div>
          </CyberCard>
        </Link>
      </div>

      {/* Referral tracking */}
      <CyberCard glowColor="pink">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold">Referral Tracking</h2>
          </div>
          <Link to="/referrals" className="text-xs text-secondary hover:underline">View team →</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Total Referrals" value={teamCount} icon={<Users className="h-4 w-4" />} />
          <Stat label="Qualified" value={activeTeamCount} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
          <Stat label="Referral Earned" value={`$${fmt(profile.earnings_referral || 0)}`} icon={<Coins className="h-4 w-4 text-accent" />} />
          <Stat label="Today" value={`$${fmt(todayReferral)}`} icon={<Sparkles className="h-4 w-4 text-secondary" />} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Referral Code</label>
            <div className="flex gap-2 mt-1">
              <Input value={profile.referral_code} readOnly className="font-mono bg-muted/30" />
              <Button variant="outline" size="icon" onClick={() => copy(profile.referral_code, 'Code')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Referral Link</label>
            <div className="flex gap-2 mt-1">
              <Input value={referralLink} readOnly className="font-mono text-xs bg-muted/30" />
              <Button variant="outline" size="icon" onClick={() => copy(referralLink, 'Link')}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="icon"
                onClick={() => {
                  if (navigator.share) navigator.share({ title: 'Join StakeBright', url: referralLink });
                  else copy(referralLink, 'Link');
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CyberCard>
    </div>
  );
};

const SectionCard = ({
  icon, label, color, today, total,
}: { icon: React.ReactNode; label: string; color: 'purple' | 'cyan' | 'pink' | 'gold'; today: number; total: number }) => (
  <CyberCard glowColor={color} className="p-4">
    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
      {icon}
      <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <p className="text-xs text-muted-foreground">Today</p>
    <p className="text-xl font-bold">${fmt(today)}</p>
    <div className="mt-2 pt-2 border-t border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase">Total earned</p>
      <p className="text-sm font-semibold text-secondary">${fmt(total)}</p>
    </div>
  </CyberCard>
);

const Stat = ({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) => (
  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
    <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
    <p className="text-lg font-bold mt-1">{value}</p>
  </div>
);

export default Profile;
