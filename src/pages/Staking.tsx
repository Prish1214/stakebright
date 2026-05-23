import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { StakingReferralTeam } from '@/components/StakingReferralTeam';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  
  Lock,
  Users,
  Sparkles,
  Search,
  CheckCircle2,
  Zap,
  Radar,
} from 'lucide-react';


interface StakingPlan {
  id: string;
  name: string;
  duration_days: number;
  daily_return_rate: number;
  minimum_amount: number;
  min_daily_rate: number;
  max_daily_rate: number;
  required_referrals: number;
}

interface UserProfile {
  staking_wallet: number;
  mining_wallet: number;
  trading_wallet: number;
}

interface Stake {
  id: string;
  plan_id: string;
  amount: number;
  daily_return: number;
  total_earned: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  last_search_at: string | null;
}

const TIER_THEME: Record<string, { color: 'cyan' | 'gold' | 'purple'; gradient: string; ring: string }> = {
  'Silver Stake':   { color: 'cyan',   gradient: 'from-slate-300/20 via-cyan-400/10 to-transparent',   ring: 'ring-cyan-400/40' },
  'Gold Stake':     { color: 'gold',   gradient: 'from-amber-400/20 via-yellow-500/10 to-transparent', ring: 'ring-amber-400/40' },
  'Platinum Stake': { color: 'purple', gradient: 'from-fuchsia-500/20 via-purple-500/10 to-transparent', ring: 'ring-fuchsia-400/40' },
};

const SEARCH_PHASES = [
  'Connecting to Binance order book…',
  'Scanning Coinbase Pro liquidity…',
  'Analyzing Kraken spread differentials…',
  'Cross-referencing OKX arbitrage windows…',
  'Aggregating Bybit momentum signals…',
  'Calibrating AI yield optimizer…',
  'Locking in optimal profit channel…',
];

const Staking = () => {
  const { user } = useAuth();
  const [stakingPlans, setStakingPlans] = useState<StakingPlan[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [qualifiedReferrals, setQualifiedReferrals] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<StakingPlan | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  

  // Search Exchange state
  const [searchingStakeId, setSearchingStakeId] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchPhase, setSearchPhase] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<{ profit: number; percentage: number } | null>(null);

  useEffect(() => {
    refresh();
  }, [user]);

  const refresh = async () => {
    await Promise.all([fetchStakingPlans(), fetchUserProfile(), fetchStakes(), fetchQualifiedReferrals()]);
  };

  const fetchStakingPlans = async () => {
    const { data, error } = await supabase
      .from('staking_plans')
      .select('*')
      .eq('is_active', true)
      .order('minimum_amount');
    if (error) return toast({ title: 'Error loading plans', description: error.message, variant: 'destructive' });
    setStakingPlans((data as any) || []);
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('staking_wallet, mining_wallet, trading_wallet')
      .eq('user_id', user.id)
      .single();
    if (error) return;
    setUserProfile(data);
  };

  const fetchStakes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stakes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return;
    setStakes((data as any) || []);
  };

  const fetchQualifiedReferrals = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any).rpc('qualified_referrals_count', { _user_id: user.id });
    if (!error) setQualifiedReferrals(Number(data) || 0);
  };

  const calculateReturns = (amount: number, plan: StakingPlan) => {
    const minDaily = amount * plan.min_daily_rate;
    const maxDaily = amount * plan.max_daily_rate;
    return { minDaily, maxDaily, minTotal: minDaily * plan.duration_days, maxTotal: maxDaily * plan.duration_days };
  };

  const isPlanUnlocked = (plan: StakingPlan) => qualifiedReferrals >= plan.required_referrals;

  const handleStake = async () => {
    if (!selectedPlan || !user || !userProfile) return;
    const amount = parseFloat(stakeAmount);

    if (!isPlanUnlocked(selectedPlan)) {
      return toast({
        title: 'Plan locked',
        description: `Requires ${selectedPlan.required_referrals} qualified referrals (you have ${qualifiedReferrals}).`,
        variant: 'destructive',
      });
    }
    if (amount < selectedPlan.minimum_amount) {
      return toast({ title: 'Invalid amount', description: `Minimum is ${selectedPlan.minimum_amount} USDT`, variant: 'destructive' });
    }
    if (amount > userProfile.staking_wallet) {
      return toast({ title: 'Insufficient Staking Wallet', description: 'Transfer USDT from Main Wallet first.', variant: 'destructive' });
    }

    setLoading(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc('create_stake', {
        p_plan_id: selectedPlan.id,
        p_amount: amount,
      });
      if (rpcError) throw rpcError;

      toast({ title: 'Stake activated!', description: `${amount} USDT locked in ${selectedPlan.name}` });
      setDialogOpen(false);
      setStakeAmount('');
      setSelectedPlan(null);
      refresh();
    } catch (e: any) {
      toast({ title: 'Error creating stake', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runSearchExchange = async (stake: Stake) => {
    if (searchingStakeId) return;

    // Cooldown check (client side hint)
    if (stake.last_search_at) {
      const next = new Date(stake.last_search_at).getTime() + 24 * 3600 * 1000;
      if (next > Date.now()) {
        const hrs = Math.ceil((next - Date.now()) / 3600000);
        return toast({
          title: 'Cooldown active',
          description: `Next scan available in ~${hrs}h.`,
          variant: 'destructive',
        });
      }
    }

    setSearchingStakeId(stake.id);
    setSearchProgress(0);
    setSearchPhase(0);

    const totalMs = 12000;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / totalMs) * 100);
      setSearchProgress(pct);
      setSearchPhase(Math.min(SEARCH_PHASES.length - 1, Math.floor((pct / 100) * SEARCH_PHASES.length)));
    }, 120);

    try {
      // Wait for animation to finish before showing result
      await new Promise((r) => setTimeout(r, totalMs));
      const { data, error } = await (supabase as any).rpc('search_exchange', { p_stake_id: stake.id });
      if (error) throw error;
      clearInterval(interval);
      setSearchProgress(100);
      setResultData({ profit: Number(data.profit), percentage: Number(data.percentage) });
      setResultOpen(true);
      await refresh();
    } catch (e: any) {
      clearInterval(interval);
      toast({ title: 'Search failed', description: e.message, variant: 'destructive' });
    } finally {
      setSearchingStakeId(null);
      setSearchProgress(0);
      setSearchPhase(0);
    }
  };

  const planById = (id: string) => stakingPlans.find((p) => p.id === id);
  const cooldownRemaining = (s: Stake) => {
    if (!s.last_search_at) return 0;
    const next = new Date(s.last_search_at).getTime() + 24 * 3600 * 1000;
    return Math.max(0, next - Date.now());
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Premium Staking
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered yield discovery across global exchanges.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Staking Wallet</p>
            <p className="text-2xl font-bold text-success">
              {userProfile ? Number(userProfile.staking_wallet).toFixed(2) : '0.00'} USDT
            </p>
            <p className="text-xs text-muted-foreground">Main: {userProfile ? Number(userProfile.wallet_balance).toFixed(2) : '0.00'} USDT</p>
          </div>
        </div>
      </div>

      {/* Referral status */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qualified Referrals</p>
              <p className="text-xl font-bold">{qualifiedReferrals} <span className="text-sm font-normal text-muted-foreground">active</span></p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            A qualified referral is a user you invited whose approved deposits total ≥ $50. Unlocks Gold (5) & Platinum (15) tiers.
          </p>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stakingPlans.map((plan) => {
          const theme = TIER_THEME[plan.name] ?? TIER_THEME['Silver Stake'];
          const unlocked = isPlanUnlocked(plan);
          const balanceOk = (userProfile?.staking_wallet ?? 0) >= plan.minimum_amount;
          const refProgress = plan.required_referrals === 0 ? 100 : Math.min(100, (qualifiedReferrals / plan.required_referrals) * 100);

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden border bg-card/60 backdrop-blur transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${
                unlocked ? `ring-1 ${theme.ring}` : 'opacity-90'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} pointer-events-none`} />
              {!unlocked && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge variant="outline" className="gap-1 border-muted-foreground/30">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                </div>
              )}
              {unlocked && balanceOk && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge className="gap-1 bg-success/20 text-success border-success/30">
                    <Sparkles className="h-3 w-3" /> Ready
                  </Badge>
                </div>
              )}

              <CardHeader className="relative z-10 pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-primary">
                      {(plan.min_daily_rate * 100).toFixed(1)}–{(plan.max_daily_rate * 100).toFixed(1)}%
                    </span>
                    <span className="text-sm text-muted-foreground">daily</span>
                  </div>
                </CardDescription>
              </CardHeader>

              <CardContent className="relative z-10 space-y-4">
                <div className="space-y-2 text-sm">
                  <Row icon={<Clock className="h-4 w-4" />} label="Duration" value={`${plan.duration_days} days`} />
                  <Row icon={<DollarSign className="h-4 w-4" />} label="Minimum" value={`${plan.minimum_amount} USDT`} />
                  <Row
                    icon={<Target className="h-4 w-4" />}
                    label="Total range"
                    value={`${(plan.min_daily_rate * plan.duration_days * 100).toFixed(0)}–${(plan.max_daily_rate * plan.duration_days * 100).toFixed(0)}%`}
                    valueClass="text-success font-semibold"
                  />
                  <Row icon={<Lock className="h-4 w-4" />} label="Principal" value="Locked till maturity" />
                </div>

                {plan.required_referrals > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" /> Referrals
                      </span>
                      <span className={unlocked ? 'text-success font-semibold' : 'text-muted-foreground'}>
                        {qualifiedReferrals} / {plan.required_referrals}
                      </span>
                    </div>
                    <Progress value={refProgress} className="h-1.5" />
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    className="w-full"
                    variant={unlocked && balanceOk ? 'default' : 'outline'}
                    disabled={!unlocked}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setDialogOpen(true);
                    }}
                  >
                    {!unlocked ? (
                      <><Lock className="mr-2 h-4 w-4" /> Need {plan.required_referrals - qualifiedReferrals} more refs</>
                    ) : !balanceOk ? (
                      <><TrendingUp className="mr-2 h-4 w-4" /> Top up to activate</>
                    ) : (
                      <><Zap className="mr-2 h-4 w-4" /> Activate Plan</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Stakes */}
      {stakes.filter((s) => s.is_active).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> My Active Stakes
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stakes.filter((s) => s.is_active).map((stake) => {
              const plan = planById(stake.plan_id);
              if (!plan) return null;
              const totalMs = new Date(stake.end_date).getTime() - new Date(stake.start_date).getTime();
              const elapsed = Math.min(totalMs, Date.now() - new Date(stake.start_date).getTime());
              const progress = (elapsed / totalMs) * 100;
              const daysLeft = Math.max(0, Math.ceil((new Date(stake.end_date).getTime() - Date.now()) / 86400000));
              const cd = cooldownRemaining(stake);
              const isSearching = searchingStakeId === stake.id;
              const theme = TIER_THEME[plan.name] ?? TIER_THEME['Silver Stake'];

              return (
                <Card key={stake.id} className={`relative overflow-hidden border bg-card/60 backdrop-blur ring-1 ${theme.ring}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} pointer-events-none`} />
                  <CardHeader className="relative z-10 pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <p className="text-2xl font-bold mt-1">{Number(stake.amount).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDT</span></p>
                    </div>
                    <Badge className="bg-success/20 text-success border-success/30">Active</Badge>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Earned</p>
                        <p className="font-semibold text-success">+{Number(stake.total_earned).toFixed(4)} USDT</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Days left</p>
                        <p className="font-semibold">{daysLeft} / {plan.duration_days}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground text-right">{progress.toFixed(1)}% complete</p>
                    </div>

                    {isSearching ? (
                      <div className="space-y-3 rounded-lg border border-primary/30 bg-background/40 p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Radar className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: '2s' }} />
                          <span className="font-mono">{SEARCH_PHASES[searchPhase]}</span>
                        </div>
                        <Progress value={searchProgress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground font-mono">
                          <span className="animate-pulse">● SCANNING EXCHANGES</span>
                          <span>{searchProgress.toFixed(0)}%</span>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => runSearchExchange(stake)}
                        disabled={cd > 0}
                        className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground hover:opacity-90 font-semibold"
                      >
                        <Search className="mr-2 h-4 w-4" />
                        {cd > 0 ? `Cooldown: ~${Math.ceil(cd / 3600000)}h` : 'Search Exchange'}
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">
                      Profits credit instantly to your Main (withdrawable) wallet. Principal unlocks at maturity.
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Stake Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>Earn {(selectedPlan.min_daily_rate * 100).toFixed(1)}%–{(selectedPlan.max_daily_rate * 100).toFixed(1)}% daily via Search Exchange. Principal locked for {selectedPlan.duration_days} days.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stake-amount">Amount (USDT)</Label>
              <Input
                id="stake-amount"
                type="number"
                placeholder={`Minimum ${selectedPlan?.minimum_amount ?? 25}`}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min={selectedPlan?.minimum_amount ?? 25}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Available: {userProfile ? Number(userProfile.staking_wallet).toFixed(2) : '0.00'} USDT
              </p>
            </div>

            {stakeAmount && selectedPlan && Number(stakeAmount) >= selectedPlan.minimum_amount && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 border border-border/40">
                <h4 className="font-medium text-sm">Projection</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Daily Range</p>
                    <p className="font-semibold text-success">
                      +{calculateReturns(Number(stakeAmount), selectedPlan).minDaily.toFixed(2)}–{calculateReturns(Number(stakeAmount), selectedPlan).maxDaily.toFixed(2)} USDT
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Range</p>
                    <p className="font-semibold text-success">
                      +{calculateReturns(Number(stakeAmount), selectedPlan).minTotal.toFixed(2)}–{calculateReturns(Number(stakeAmount), selectedPlan).maxTotal.toFixed(2)} USDT
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); setStakeAmount(''); }}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleStake}
                disabled={loading || !stakeAmount || Number(stakeAmount) < (selectedPlan?.minimum_amount ?? 25)}
              >
                {loading ? 'Activating…' : 'Confirm Stake'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-md">
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-success/30 to-primary/30 flex items-center justify-center animate-scale-in">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Profit Secured!</h2>
              <p className="text-sm text-muted-foreground mt-1">AI located optimal yield channel</p>
            </div>
            {resultData && (
              <div className="space-y-2">
                <p className="text-5xl font-bold bg-gradient-to-r from-success via-primary to-accent bg-clip-text text-transparent">
                  +{resultData.profit.toFixed(4)}
                </p>
                <p className="text-sm text-muted-foreground">USDT credited to Main Wallet</p>
                <Badge className="bg-success/20 text-success border-success/30 text-sm">
                  {resultData.percentage.toFixed(3)}% daily rate
                </Badge>
              </div>
            )}
            <Button className="w-full" onClick={() => setResultOpen(false)}>Awesome</Button>
          </div>
        </DialogContent>
      </Dialog>

      <StakingReferralTeam />
    </div>
  );
};

const Row = ({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
    <span className={`font-medium ${valueClass ?? ''}`}>{value}</span>
  </div>
);

export default Staking;
