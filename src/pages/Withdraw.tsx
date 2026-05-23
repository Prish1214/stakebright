import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, DollarSign, Clock, CheckCircle, Lock, Unlock, Coins } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WithdrawalHistory {
  id: string;
  amount: number;
  net_amount: number;
  fee_amount: number;
  status: string;
  withdrawal_type: string;
  withdrawal_address: string;
  stake_id: string | null;
  created_at: string;
  processed_at: string | null;
}

interface StakeRow {
  id: string;
  amount: number;
  total_earned: number;
  daily_return: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  principal_withdrawn: boolean;
  plan_name?: string;
}

const ACTIVE_WITHDRAWAL_STATUSES = ['pending', 'approved', 'confirmed', 'completed'];

const Withdraw = () => {
  const { user } = useAuth();
  const [earningsBalance, setEarningsBalance] = useState(0);
  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [pendingPrincipalStakeIds, setPendingPrincipalStakeIds] = useState<Set<string>>(new Set());
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [principalAddress, setPrincipalAddress] = useState('');
  const [principalStakeId, setPrincipalStakeId] = useState<string | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([]);
  const [feePercentage, setFeePercentage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPrincipal, setSubmittingPrincipal] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();

    const withdrawalChannel = supabase
      .channel('withdrawal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user?.id}` }, () => fetchData())
      .subscribe();

    const profileChannel = supabase
      .channel('profile-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user?.id}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(withdrawalChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'withdrawal_fee_percentage')
        .single();
      if (settingsData) setFeePercentage(Number(settingsData.setting_value));

      // Fetch stakes with plan name
      const { data: stakesData, error: stakesError } = await supabase
        .from('stakes')
        .select('id, amount, total_earned, daily_return, start_date, end_date, is_active, principal_withdrawn, staking_plans(name)')
        .eq('user_id', user?.id)
        .order('end_date', { ascending: false });
      if (stakesError) throw stakesError;

      const normalizedStakes: StakeRow[] = (stakesData || []).map((s: any) => ({
        id: s.id,
        amount: Number(s.amount),
        total_earned: Number(s.total_earned ?? 0),
        daily_return: Number(s.daily_return ?? 0),
        start_date: s.start_date,
        end_date: s.end_date,
        is_active: s.is_active,
        principal_withdrawn: s.principal_withdrawn,
        plan_name: s.staking_plans?.name,
      }));
      setStakes(normalizedStakes);

      // Withdrawals
      const { data: historyData, error: historyError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (historyError) throw historyError;
      setWithdrawalHistory(historyData || []);

      // Compute pending/active principal withdrawals per stake
      const pendingPrincipal = new Set<string>();
      (historyData || []).forEach((w: any) => {
        if (w.withdrawal_type === 'principal' && w.stake_id && ACTIVE_WITHDRAWAL_STATUSES.includes(w.status)) {
          pendingPrincipal.add(w.stake_id);
        }
      });
      setPendingPrincipalStakeIds(pendingPrincipal);

      // Earnings balance
      let totalEarnings = 0;
      const now = new Date();
      normalizedStakes.forEach((stake) => {
        const startDate = new Date(stake.start_date);
        const endDate = new Date(stake.end_date);
        const stakeEnded = now >= endDate;
        if (stake.is_active) {
          const effectiveEndDate = stakeEnded ? endDate : now;
          const daysPassed = Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          totalEarnings += stake.total_earned + daysPassed * stake.daily_return;
        } else {
          totalEarnings += stake.total_earned;
        }
      });

      const { data: referralData, error: referralError } = await supabase
        .from('referral_earnings')
        .select('amount')
        .eq('referrer_id', user?.id);
      if (referralError) throw referralError;
      const referralEarnings = referralData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      const earningsWithdrawn = (historyData || [])
        .filter((w: any) => w.withdrawal_type === 'earnings' && ACTIVE_WITHDRAWAL_STATUSES.includes(w.status))
        .reduce((sum: number, w: any) => sum + Number(w.amount), 0);

      setEarningsBalance(Math.max(0, totalEarnings + referralEarnings - earningsWithdrawn));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateFee = (amount: number) => (amount * feePercentage) / 100;
  const calculateNetAmount = (amount: number) => amount - calculateFee(amount);

  const handleWithdrawEarnings = async () => {
    if (!withdrawalAmount || Number(withdrawalAmount) <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid withdrawal amount', variant: 'destructive' });
      return;
    }
    if (!withdrawalAddress.trim()) {
      toast({ title: 'Address Required', description: 'Please enter your USDT BEP20 withdrawal address', variant: 'destructive' });
      return;
    }
    const amount = Number(withdrawalAmount);
    if (amount > earningsBalance) {
      toast({ title: 'Insufficient Balance', description: 'Withdrawal amount exceeds available earnings', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const feeAmount = calculateFee(amount);
      const netAmount = calculateNetAmount(amount);
      const { error } = await supabase.from('withdrawals').insert({
        user_id: user?.id,
        amount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        withdrawal_type: 'earnings',
        withdrawal_address: withdrawalAddress.trim(),
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Earnings Withdrawal Requested', description: 'Submitted for admin approval' });
      setWithdrawalAmount('');
      setWithdrawalAddress('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawPrincipal = async (stake: StakeRow) => {
    if (!principalAddress.trim()) {
      toast({ title: 'Address Required', description: 'Enter your USDT BEP20 address', variant: 'destructive' });
      return;
    }
    setSubmittingPrincipal(stake.id);
    try {
      const amount = stake.amount;
      const { error } = await supabase.from('withdrawals').insert({
        user_id: user?.id,
        amount,
        fee_amount: 0,
        net_amount: amount,
        withdrawal_type: 'principal',
        stake_id: stake.id,
        withdrawal_address: principalAddress.trim(),
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Principal Withdrawal Requested', description: 'Submitted for admin approval (no fee)' });
      setPrincipalStakeId(null);
      setPrincipalAddress('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingPrincipal(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'confirmed':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString();
  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const now = new Date();
  const completedPrincipalAvailable = stakes
    .filter((s) => new Date(s.end_date) <= now && !s.principal_withdrawn && !pendingPrincipalStakeIds.has(s.id))
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Withdraw</h1>
        <p className="text-muted-foreground mt-2">
          Withdraw your daily earnings, referral commissions, or unlocked principals
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-crypto-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-crypto-gold" />
              Available Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-crypto-gold">{earningsBalance.toFixed(2)} USDT</div>
            <p className="text-sm text-muted-foreground mt-2">
              Daily staking earnings + referral commissions ({feePercentage}% fee on withdrawal)
            </p>
          </CardContent>
        </Card>

        <Card className="border-crypto-purple/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-crypto-purple" />
              Available To Withdraw
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-crypto-purple">{completedPrincipalAvailable.toFixed(2)} USDT</div>
            <p className="text-sm text-muted-foreground mt-2">
              Unlocked principal from completed stakes (no fee)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Locked Balance Overview */}
      <LockedBalanceOverview userId={user?.id} />

      {/* Withdraw Earnings */}
      <Card className="border-crypto-purple/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-crypto-purple" />
            Withdraw Earnings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (USDT)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount to withdraw"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              max={earningsBalance}
            />
          </div>
          <div>
            <Label htmlFor="address">USDT BEP20 Address</Label>
            <Input
              id="address"
              type="text"
              placeholder="0x..."
              value={withdrawalAddress}
              onChange={(e) => setWithdrawalAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ⚠️ Only USDT BEP20 network. Wrong network = lost funds!
            </p>
          </div>
          {withdrawalAmount && Number(withdrawalAmount) > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm"><span>Amount:</span><span>{Number(withdrawalAmount).toFixed(2)} USDT</span></div>
              <div className="flex justify-between text-sm"><span>Fee ({feePercentage}%):</span><span>{calculateFee(Number(withdrawalAmount)).toFixed(2)} USDT</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Net:</span><span className="text-crypto-gold">{calculateNetAmount(Number(withdrawalAmount)).toFixed(2)} USDT</span></div>
            </div>
          )}
          <Button
            onClick={handleWithdrawEarnings}
            disabled={submitting || !withdrawalAmount || Number(withdrawalAmount) <= 0 || !withdrawalAddress.trim()}
            className="w-full"
          >
            {submitting ? 'Processing...' : 'Withdraw Earnings'}
          </Button>
        </CardContent>
      </Card>

      {/* Stakes & Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Your Stakes — Principal Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stakes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No stakes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stakes.map((stake) => {
                const endDate = new Date(stake.end_date);
                const ended = endDate <= now;
                const pendingPrincipal = pendingPrincipalStakeIds.has(stake.id);
                const withdrawable = ended && !stake.principal_withdrawn && !pendingPrincipal;
                const expanded = principalStakeId === stake.id;

                return (
                  <div key={stake.id} className="p-4 rounded-lg border bg-card/50 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{stake.plan_name || 'Stake'}</p>
                          {withdrawable ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                              <Unlock className="h-3 w-3 mr-1" /> Principal Unlocked
                            </Badge>
                          ) : stake.principal_withdrawn ? (
                            <Badge variant="secondary">Principal Withdrawn</Badge>
                          ) : pendingPrincipal ? (
                            <Badge variant="outline">Withdrawal Pending</Badge>
                          ) : (
                            <Badge variant="outline">
                              <Lock className="h-3 w-3 mr-1" /> Locked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Principal: <span className="font-medium text-foreground">{stake.amount.toFixed(2)} USDT</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ended ? 'Unlocked on' : 'Unlocks on'} {formatDate(stake.end_date)}
                          {!ended && ` (in ${daysUntil(stake.end_date)} days)`}
                        </p>
                      </div>
                      {withdrawable && (
                        <Button size="sm" variant="outline" onClick={() => setPrincipalStakeId(expanded ? null : stake.id)}>
                          {expanded ? 'Cancel' : 'Withdraw Principal'}
                        </Button>
                      )}
                    </div>
                    {expanded && (
                      <div className="space-y-3 pt-2 border-t">
                        <div>
                          <Label htmlFor={`addr-${stake.id}`}>USDT BEP20 Address</Label>
                          <Input
                            id={`addr-${stake.id}`}
                            placeholder="0x..."
                            value={principalAddress}
                            onChange={(e) => setPrincipalAddress(e.target.value)}
                          />
                        </div>
                        <div className="p-3 bg-muted/50 rounded text-sm flex justify-between">
                          <span>You will receive:</span>
                          <span className="font-semibold text-crypto-gold">{stake.amount.toFixed(2)} USDT (no fee)</span>
                        </div>
                        <Button
                          className="w-full"
                          disabled={submittingPrincipal === stake.id || !principalAddress.trim()}
                          onClick={() => handleWithdrawPrincipal(stake)}
                        >
                          {submittingPrincipal === stake.id ? 'Processing...' : `Confirm Withdraw ${stake.amount.toFixed(2)} USDT`}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Withdrawal History</CardTitle></CardHeader>
        <CardContent>
          {withdrawalHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No withdrawal history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawalHistory.map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(withdrawal.status)}
                    <div>
                      <p className="font-medium">{Number(withdrawal.amount).toFixed(2)} USDT</p>
                      <p className="text-sm text-muted-foreground capitalize">{withdrawal.withdrawal_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium capitalize ${getStatusColor(withdrawal.status)}`}>{withdrawal.status}</p>
                    <p className="text-sm text-muted-foreground">Net: {Number(withdrawal.net_amount).toFixed(2)} USDT</p>
                    <p className="text-xs text-muted-foreground">{new Date(withdrawal.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-800/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 text-amber-800 dark:text-amber-200">Important Notes</h3>
          <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
            <p>• A {feePercentage}% fee applies to <strong>earnings</strong> withdrawals (daily returns + referral commissions)</p>
            <p>• Principal withdrawals are <strong>fee-free</strong> after the staking period ends</p>
            <p>• Each stake's principal is locked until its unlock date shown above</p>
            <p>• Processing time is typically 24-48 hours</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Withdraw;
