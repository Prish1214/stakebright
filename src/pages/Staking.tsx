import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TrendingUp, Clock, DollarSign, Target, ArrowDownUp } from 'lucide-react';
import WalletTransferModal from '@/components/WalletTransferModal';

interface StakingPlan {
  id: string;
  name: string;
  duration_days: number;
  daily_return_rate: number;
  minimum_amount: number;
}

interface UserProfile {
  wallet_balance: number;
  staking_wallet: number;
  mining_wallet: number;
  trading_wallet: number;
}

const Staking = () => {
  const { user } = useAuth();
  const [stakingPlans, setStakingPlans] = useState<StakingPlan[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<StakingPlan | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    fetchStakingPlans();
    fetchUserProfile();
  }, [user]);

  const fetchStakingPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('staking_plans')
        .select('*')
        .eq('is_active', true)
        .order('duration_days');

      if (error) throw error;
      setStakingPlans(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading staking plans",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('wallet_balance, staking_wallet, mining_wallet, trading_wallet')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const calculateReturns = (amount: number, plan: StakingPlan) => {
    const dailyReturn = amount * plan.daily_return_rate;
    const totalReturn = dailyReturn * plan.duration_days;
    return { dailyReturn, totalReturn };
  };

  const handleStake = async () => {
    if (!selectedPlan || !user || !userProfile) return;

    const amount = parseFloat(stakeAmount);
    
    if (amount < selectedPlan.minimum_amount) {
      toast({
        title: "Invalid amount",
        description: `Minimum stake amount is ${selectedPlan.minimum_amount} USDT`,
        variant: "destructive"
      });
      return;
    }

    if (amount > userProfile.staking_wallet) {
      toast({
        title: "Insufficient Staking Wallet",
        description: "Transfer USDT from Main Wallet to Staking Wallet first.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { dailyReturn } = calculateReturns(amount, selectedPlan);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + selectedPlan.duration_days);

      // Create stake
      const { error: stakeError } = await supabase
        .from('stakes')
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          amount,
          daily_return: dailyReturn,
          end_date: endDate.toISOString()
        });

      if (stakeError) throw stakeError;

      // Deduct from staking_wallet
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
          staking_wallet: userProfile.staking_wallet - amount
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Stake created successfully!",
        description: `You've staked ${amount} USDT in ${selectedPlan.name}`
      });

      setDialogOpen(false);
      setStakeAmount('');
      setSelectedPlan(null);
      fetchUserProfile();
    } catch (error: any) {
      toast({
        title: "Error creating stake",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (index: number) => {
    const colors = [
      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
      'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950',
      'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staking Plans</h1>
          <p className="text-muted-foreground">Choose a plan and start earning daily returns</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold text-success">
            {userProfile ? Number(userProfile.wallet_balance).toFixed(2) : '0.00'} USDT
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stakingPlans.map((plan, index) => {
          const isRecommended = index === 1; // Middle plan as recommended
          
          return (
            <Card key={plan.id} className={`relative ${getPlanColor(index)} transition-all hover:shadow-lg`}>
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Recommended
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-primary">
                    {(plan.daily_return_rate * 100).toFixed(1)}%
                    <span className="text-sm font-normal text-muted-foreground">daily</span>
                  </div>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      Duration
                    </span>
                    <span className="font-medium">{plan.duration_days} days</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4" />
                      Minimum
                    </span>
                    <span className="font-medium">{plan.minimum_amount} USDT</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4" />
                      Total Return
                    </span>
                    <span className="font-medium text-success">
                      {(plan.daily_return_rate * plan.duration_days * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full" 
                        variant={isRecommended ? "default" : "outline"}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Stake Now
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Stake in {selectedPlan?.name}</DialogTitle>
                        <DialogDescription>
                          Enter the amount you want to stake. You'll earn{' '}
                          {selectedPlan ? (selectedPlan.daily_return_rate * 100).toFixed(1) : 0}% daily returns.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="stake-amount">Amount (USDT)</Label>
                          <Input
                            id="stake-amount"
                            type="number"
                            placeholder={`Minimum ${selectedPlan?.minimum_amount || 25}`}
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(e.target.value)}
                            min={selectedPlan?.minimum_amount || 25}
                            step="0.01"
                          />
                        </div>
                        
                        {stakeAmount && selectedPlan && Number(stakeAmount) >= selectedPlan.minimum_amount && (
                          <div className="bg-muted p-4 rounded-lg space-y-2">
                            <h4 className="font-medium">Projection</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Daily Return</p>
                                <p className="font-medium text-success">
                                  +{calculateReturns(Number(stakeAmount), selectedPlan).dailyReturn.toFixed(2)} USDT
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Total Return</p>
                                <p className="font-medium text-success">
                                  +{calculateReturns(Number(stakeAmount), selectedPlan).totalReturn.toFixed(2)} USDT
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setDialogOpen(false);
                              setStakeAmount('');
                              setSelectedPlan(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={handleStake}
                            disabled={loading || !stakeAmount || Number(stakeAmount) < (selectedPlan?.minimum_amount || 25)}
                          >
                            {loading ? 'Creating Stake...' : 'Confirm Stake'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>How Staking Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">1. Choose Amount</h3>
              <p className="text-sm text-muted-foreground">Select how much USDT you want to stake</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">2. Lock Period</h3>
              <p className="text-sm text-muted-foreground">Your funds are locked for the selected duration</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">3. Earn Daily</h3>
              <p className="text-sm text-muted-foreground">Receive daily returns that can be withdrawn</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Staking;