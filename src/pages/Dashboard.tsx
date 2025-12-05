import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  Users,
  DollarSign,
  Clock,
  Award
} from 'lucide-react';

interface UserProfile {
  wallet_balance: number;
  referral_code: string;
}

interface ActiveStake {
  id: string;
  amount: number;
  daily_return: number;
  total_earned: number;
  start_date: string;
  end_date: string;
  staking_plans: {
    name: string;
    duration_days: number;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeStakes, setActiveStakes] = useState<ActiveStake[]>([]);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance, referral_code')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch active stakes
      const { data: stakesData, error: stakesError } = await supabase
        .from('stakes')
        .select(`
          id,
          amount,
          daily_return,
          total_earned,
          start_date,
          end_date,
          staking_plans (
            name,
            duration_days
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (stakesError) throw stakesError;
      setActiveStakes(stakesData || []);

      // Calculate total earnings from stakes (including real-time accumulated earnings)
      const stakesEarnings = stakesData?.reduce((sum, stake) => {
        const startDate = new Date(stake.start_date);
        const now = new Date();
        const endDate = new Date(stake.end_date);
        const effectiveEndDate = now < endDate ? now : endDate;
        
        // Calculate days passed since start
        const daysPassed = Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate accumulated earnings: stored total_earned + (days * daily_return)
        // This ensures we show real-time earnings even before cron runs
        const accumulatedEarnings = Number(stake.total_earned) + (daysPassed * Number(stake.daily_return));
        
        return sum + accumulatedEarnings;
      }, 0) || 0;

      // Calculate daily earnings from all active stakes
      const totalDailyEarnings = stakesData?.reduce((sum, stake) => sum + Number(stake.daily_return), 0) || 0;
      setDailyEarnings(totalDailyEarnings);

      // Fetch referral earnings
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
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your staking overview.</p>
        </div>
        <Link to="/staking">
          <Button className="bg-primary hover:bg-primary/90">
            <TrendingUp className="mr-2 h-4 w-4" />
            Stake More
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(profile?.wallet_balance || 0).toFixed(2)} USDT</div>
            <p className="text-xs text-muted-foreground">Available for staking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{totalEarnings.toFixed(2)} USDT</div>
            <p className="text-xs text-muted-foreground">Daily returns + referral earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stakes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStakes.length}</div>
            <p className="text-xs text-muted-foreground">Currently earning</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Earnings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-crypto-gold">{referralEarnings.toFixed(2)} USDT</div>
            <p className="text-xs text-muted-foreground">5% commission</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Stakes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Active Stakes
            </CardTitle>
            <CardDescription>Your current staking positions</CardDescription>
          </CardHeader>
          <CardContent>
            {activeStakes.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Stakes</h3>
                <p className="text-muted-foreground mb-4">Start staking to earn daily returns</p>
                <Link to="/staking">
                  <Button>Start Staking</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStakes.map((stake) => {
                  const daysRemaining = getDaysRemaining(stake.end_date);
                  const totalDays = stake.staking_plans.duration_days;
                  const progress = ((totalDays - daysRemaining) / totalDays) * 100;
                  
                  return (
                    <div key={stake.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{stake.staking_plans.name}</Badge>
                          <span className="font-semibold">{Number(stake.amount).toFixed(2)} USDT</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-success font-medium">
                            +{Number(stake.daily_return).toFixed(2)} USDT/day
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total earned: {Number(stake.total_earned).toFixed(2)} USDT
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {daysRemaining} days remaining
                          </span>
                          <span>{Math.round(progress)}% complete</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/deposit" className="block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Deposit USDT
              </CardTitle>
              <CardDescription>Add funds to your wallet</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/withdraw" className="block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowUpCircle className="h-5 w-5 text-success" />
                Withdraw Earnings
              </CardTitle>
              <CardDescription>Cash out your profits</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/referrals" className="block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-crypto-gold" />
                Refer & Earn
              </CardTitle>
              <CardDescription>Earn 5% commission</CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;