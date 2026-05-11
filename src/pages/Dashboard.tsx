import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import CyberCard from '@/components/ui/CyberCard';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import {
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  Users,
  DollarSign,
  Clock,
  Award,
  Zap,
  Target
} from 'lucide-react';

interface UserProfile {
  wallet_balance: number;
  referral_code: string;
}

interface StakeData {
  id: string;
  amount: number;
  daily_return: number;
  total_earned: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  staking_plans: {
    name: string;
    duration_days: number;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeStakes, setActiveStakes] = useState<StakeData[]>([]);
  const [completedStakes, setCompletedStakes] = useState<StakeData[]>([]);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completedSortBy, setCompletedSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'earned_desc'>('date_desc');
  const [completedFilter, setCompletedFilter] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance, referral_code')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch active stakes
      const { data: activeStakesData, error: activeStakesError } = await supabase
        .from('stakes')
        .select(`
          id,
          amount,
          daily_return,
          total_earned,
          start_date,
          end_date,
          is_active,
          staking_plans (
            name,
            duration_days
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (activeStakesError) throw activeStakesError;
      setActiveStakes(activeStakesData || []);

      // Fetch completed stakes
      const { data: completedStakesData, error: completedStakesError } = await supabase
        .from('stakes')
        .select(`
          id,
          amount,
          daily_return,
          total_earned,
          start_date,
          end_date,
          is_active,
          staking_plans (
            name,
            duration_days
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', false)
        .order('end_date', { ascending: false });

      if (completedStakesError) throw completedStakesError;
      setCompletedStakes(completedStakesData || []);

      // Calculate earnings from both active and completed stakes
      const allStakes = [...(activeStakesData || []), ...(completedStakesData || [])];
      const stakesEarnings = allStakes.reduce((sum, stake) => {
        const startDate = new Date(stake.start_date);
        const now = new Date();
        const endDate = new Date(stake.end_date);
        const effectiveEndDate = now < endDate ? now : endDate;
        const daysPassed = Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const accumulatedEarnings = Number(stake.total_earned) + (daysPassed * Number(stake.daily_return));
        return sum + accumulatedEarnings;
      }, 0);

      const totalDailyEarnings = activeStakesData?.reduce((sum, stake) => sum + Number(stake.daily_return), 0) || 0;
      setDailyEarnings(totalDailyEarnings);

      const { data: referralData, error: referralError } = await supabase
        .from('referral_earnings')
        .select('amount')
        .eq('referrer_id', user.id);

      if (referralError) throw referralError;
      const refEarnings = referralData?.reduce((sum, earning) => sum + Number(earning.amount), 0) || 0;
      setReferralEarnings(refEarnings);
      setTotalEarnings(stakesEarnings + refEarnings);

    } catch (error: any) {
      toast({
        title: "Error loading dashboard",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="cyber-card rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-primary/20 rounded w-24 mb-4"></div>
              <div className="h-8 bg-primary/10 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-mono font-bold gradient-text">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your staking overview.</p>
        </div>
        <Link to="/staking">
          <NeonButton glowColor="purple" pulse>
            <TrendingUp className="mr-2 h-4 w-4" />
            Stake More
          </NeonButton>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <CyberCard glowColor="cyan" className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Wallet Balance</span>
            <GlowingIcon icon={Wallet} size="sm" color="cyan" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-secondary">
            <AnimatedNumber value={Number(profile?.wallet_balance || 0)} glowColor="cyan" suffix=" USDT" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Available for staking</p>
        </CyberCard>

        <CyberCard glowColor="pink" className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Staked</span>
            <GlowingIcon icon={Target} size="sm" color="pink" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-accent">
            <AnimatedNumber
              value={activeStakes.reduce((sum, s) => sum + Number(s.amount), 0)}
              glowColor="pink"
              suffix=" USDT"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Across {activeStakes.length} active stake{activeStakes.length === 1 ? '' : 's'}</p>
        </CyberCard>

        <CyberCard glowColor="green" className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Earnings</span>
            <GlowingIcon icon={DollarSign} size="sm" color="green" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-success">
            <AnimatedNumber value={totalEarnings} glowColor="green" suffix=" USDT" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Daily returns + referral earnings</p>
        </CyberCard>

        <CyberCard glowColor="purple" className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Active Stakes</span>
            <GlowingIcon icon={TrendingUp} size="sm" color="purple" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-primary">
            {activeStakes.length}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Daily +{dailyEarnings.toFixed(2)} USDT</p>
        </CyberCard>

        <CyberCard glowColor="gold" className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Referral Earnings</span>
            <GlowingIcon icon={Users} size="sm" color="gold" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-crypto-gold">
            <AnimatedNumber value={referralEarnings} glowColor="gold" suffix=" USDT" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">5% commission</p>
        </CyberCard>
      </div>

      {/* Active Stakes */}
      <CyberCard glowColor="purple" className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-3 mb-6">
          <GlowingIcon icon={Zap} size="md" color="purple" />
          <div>
            <h2 className="text-xl font-mono font-bold">Active Stakes</h2>
            <p className="text-sm text-muted-foreground">Your current staking positions</p>
          </div>
        </div>

        {activeStakes.length === 0 ? (
          <div className="text-center py-12 border border-primary/20 rounded-xl bg-muted/10">
            <TrendingUp className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-mono font-semibold mb-2">No Active Stakes</h3>
            <p className="text-muted-foreground mb-6">Start staking to earn daily returns</p>
            <Link to="/staking">
              <NeonButton>Start Staking</NeonButton>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeStakes.map((stake, index) => {
              const daysRemaining = getDaysRemaining(stake.end_date);
              const totalDays = stake.staking_plans.duration_days;
              const progress = ((totalDays - daysRemaining) / totalDays) * 100;
              
              return (
                <div 
                  key={stake.id} 
                  className="border border-primary/20 rounded-xl p-5 bg-muted/5 hover:bg-muted/10 transition-all duration-300 hover:border-primary/40 animate-fade-in-up"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary/20 text-primary border-primary/30 font-mono">
                        {stake.staking_plans.name}
                      </Badge>
                      <span className="font-mono font-semibold text-lg">{Number(stake.amount).toFixed(2)} USDT</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-success flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        +{Number(stake.daily_return).toFixed(2)} USDT/day
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total earned: <span className="text-crypto-gold">{Number(stake.total_earned).toFixed(2)} USDT</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {daysRemaining} days remaining
                      </span>
                      <span className="font-mono text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-neon-gradient rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CyberCard>

      {/* Completed Stakes */}
      {completedStakes.length > 0 && (
        <CyberCard glowColor="green" className="animate-fade-in-up" style={{ animationDelay: '0.55s' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <GlowingIcon icon={Award} size="md" color="green" />
              <div>
                <h2 className="text-xl font-mono font-bold">Completed Stakes</h2>
                <p className="text-sm text-muted-foreground">Your staking history</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
              <Input
                placeholder="Filter by plan name..."
                value={completedFilter}
                onChange={(e) => setCompletedFilter(e.target.value)}
                className="sm:w-56 font-mono text-sm"
              />
              <Select value={completedSortBy} onValueChange={(v) => setCompletedSortBy(v as typeof completedSortBy)}>
                <SelectTrigger className="sm:w-56 font-mono text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Newest first</SelectItem>
                  <SelectItem value="date_asc">Oldest first</SelectItem>
                  <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
                  <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
                  <SelectItem value="earned_desc">Most earned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(() => {
            const filtered = completedStakes
              .filter((s) =>
                completedFilter.trim() === ''
                  ? true
                  : s.staking_plans?.name?.toLowerCase().includes(completedFilter.toLowerCase())
              )
              .sort((a, b) => {
                switch (completedSortBy) {
                  case 'date_asc':
                    return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
                  case 'amount_desc':
                    return Number(b.amount) - Number(a.amount);
                  case 'amount_asc':
                    return Number(a.amount) - Number(b.amount);
                  case 'earned_desc':
                    return Number(b.total_earned) - Number(a.total_earned);
                  case 'date_desc':
                  default:
                    return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
                }
              });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-8 text-sm text-muted-foreground border border-success/20 rounded-xl bg-muted/10">
                  No completed stakes match your filter.
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {filtered.map((stake, index) => {
                  const totalDays = stake.staking_plans.duration_days;

                  return (
                    <div
                      key={stake.id}
                      className="border border-success/20 rounded-xl p-5 bg-success/5 hover:bg-success/10 transition-all duration-300 hover:border-success/40 animate-fade-in-up"
                      style={{ animationDelay: `${0.6 + index * 0.05}s` }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className="bg-success/20 text-success border-success/30 font-mono">
                            {stake.staking_plans.name}
                          </Badge>
                          <Badge variant="outline" className="text-success border-success/30">
                            Completed
                          </Badge>
                          <span className="font-mono font-semibold text-lg">{Number(stake.amount).toFixed(2)} USDT</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Ended: {new Date(stake.end_date).toLocaleDateString()}
                          </div>
                          <div className="text-sm font-mono text-muted-foreground">
                            Duration: {totalDays} days
                          </div>
                          <div className="text-sm text-success font-semibold">
                            Total earned: {Number(stake.total_earned).toFixed(2)} USDT
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CyberCard>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/deposit" className="block">
          <CyberCard glowColor="cyan" className="h-full cursor-pointer group animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
            <div className="flex items-center gap-4">
              <GlowingIcon icon={Wallet} color="cyan" className="group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-mono font-semibold text-lg">Deposit USDT</h3>
                <p className="text-sm text-muted-foreground">Add funds to your wallet</p>
              </div>
            </div>
          </CyberCard>
        </Link>

        <Link to="/withdraw" className="block">
          <CyberCard glowColor="green" className="h-full cursor-pointer group animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="flex items-center gap-4">
              <GlowingIcon icon={ArrowUpCircle} color="green" className="group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-mono font-semibold text-lg">Withdraw Earnings</h3>
                <p className="text-sm text-muted-foreground">Cash out your profits</p>
              </div>
            </div>
          </CyberCard>
        </Link>

        <Link to="/referrals" className="block">
          <CyberCard glowColor="gold" className="h-full cursor-pointer group animate-fade-in-up" style={{ animationDelay: '0.9s' }}>
            <div className="flex items-center gap-4">
              <GlowingIcon icon={Award} color="gold" className="group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-mono font-semibold text-lg">Refer & Earn</h3>
                <p className="text-sm text-muted-foreground">Earn 5% commission</p>
              </div>
            </div>
          </CyberCard>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
