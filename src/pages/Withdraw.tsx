import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpCircle, DollarSign, Clock, CheckCircle } from 'lucide-react';
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
  created_at: string;
  processed_at: string | null;
}

interface SystemSettings {
  withdrawal_fee_percentage: number;
}

const Withdraw = () => {
  const { user } = useAuth();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalType, setWithdrawalType] = useState('earnings');
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([]);
  const [feePercentage, setFeePercentage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }

    // Set up real-time subscription for withdrawal changes
    const withdrawalChannel = supabase
      .channel('withdrawal-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawals',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Also subscribe to profile changes (wallet balance updates)
    const profileChannel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchData(); // Refresh all data including withdrawals
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(withdrawalChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch system settings for withdrawal fee
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'withdrawal_fee_percentage')
        .single();

      if (settingsData) {
        setFeePercentage(Number(settingsData.setting_value));
      }

      // Calculate available balance
      await calculateAvailableBalance();

      // Fetch withdrawal history
      const { data: historyData, error: historyError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      setWithdrawalHistory(historyData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAvailableBalance = async () => {
    try {
      // Get total earned from stakes
      const { data: stakesData, error: stakesError } = await supabase
        .from('stakes')
        .select('total_earned')
        .eq('user_id', user?.id);

      if (stakesError) throw stakesError;
      const totalEarnings = stakesData?.reduce((sum, stake) => sum + Number(stake.total_earned), 0) || 0;

      // Get referral earnings
      const { data: referralData, error: referralError } = await supabase
        .from('referral_earnings')
        .select('amount')
        .eq('referrer_id', user?.id);

      if (referralError) throw referralError;
      const referralEarnings = referralData?.reduce((sum, earning) => sum + Number(earning.amount), 0) || 0;

      // Get total withdrawn (including approved, confirmed, and completed)
      const { data: withdrawnData, error: withdrawnError } = await supabase
        .from('withdrawals')
        .select('net_amount')
        .eq('user_id', user?.id)
        .in('status', ['completed', 'approved', 'confirmed']);

      if (withdrawnError) throw withdrawnError;
      const totalWithdrawn = withdrawnData?.reduce((sum, withdrawal) => sum + Number(withdrawal.net_amount), 0) || 0;

      const available = totalEarnings + referralEarnings - totalWithdrawn;
      setAvailableBalance(Math.max(0, available));
    } catch (error: any) {
      console.error('Error calculating balance:', error);
    }
  };

  const calculateFee = (amount: number) => {
    return (amount * feePercentage) / 100;
  };

  const calculateNetAmount = (amount: number) => {
    return amount - calculateFee(amount);
  };

  const handleWithdraw = async () => {
    if (!withdrawalAmount || Number(withdrawalAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive"
      });
      return;
    }

    if (!withdrawalAddress.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter your USDT BEP20 withdrawal address",
        variant: "destructive"
      });
      return;
    }

    const amount = Number(withdrawalAmount);
    if (amount > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: "Withdrawal amount exceeds available balance",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const feeAmount = calculateFee(amount);
      const netAmount = calculateNetAmount(amount);

      const { error } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user?.id,
          amount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          withdrawal_type: withdrawalType,
          withdrawal_address: withdrawalAddress.trim(),
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted for admin approval"
      });

      setWithdrawalAmount('');
      setWithdrawalAddress('');
      fetchData(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Withdraw Earnings</h1>
        <p className="text-muted-foreground mt-2">
          Withdraw your staking and referral earnings
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-crypto-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-crypto-gold" />
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-crypto-gold">
              {availableBalance.toFixed(2)} USDT
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              From staking rewards and referral earnings
            </p>
          </CardContent>
        </Card>

        <Card className="border-crypto-purple/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-crypto-purple" />
              New Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="withdrawal-type">Withdrawal Type</Label>
              <Select value={withdrawalType} onValueChange={setWithdrawalType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earnings">Earnings Only</SelectItem>
                  <SelectItem value="principal">Principal (After Lock Period)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount (USDT)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount to withdraw"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                max={availableBalance}
              />
            </div>

            <div>
              <Label htmlFor="address">USDT BEP20 Withdrawal Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="Enter your USDT BEP20 address (0x...)"
                value={withdrawalAddress}
                onChange={(e) => setWithdrawalAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Only enter USDT BEP20 network addresses. Wrong network = lost funds!
              </p>
            </div>

            {withdrawalAmount && Number(withdrawalAmount) > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Withdrawal Amount:</span>
                  <span>{Number(withdrawalAmount).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Fee ({feePercentage}%):</span>
                  <span>{calculateFee(Number(withdrawalAmount)).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Net Amount:</span>
                  <span className="text-crypto-gold">
                    {calculateNetAmount(Number(withdrawalAmount)).toFixed(2)} USDT
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={handleWithdraw} 
              disabled={submitting || !withdrawalAmount || Number(withdrawalAmount) <= 0 || !withdrawalAddress.trim()}
              className="w-full"
            >
              {submitting ? 'Processing...' : 'Request Withdrawal'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No withdrawal history yet</p>
              <p className="text-sm">Your withdrawal requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawalHistory.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-4 bg-card/50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(withdrawal.status)}
                    <div>
                      <p className="font-medium">
                        {Number(withdrawal.amount).toFixed(2)} USDT
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {withdrawal.withdrawal_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium capitalize ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Net: {Number(withdrawal.net_amount).toFixed(2)} USDT
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </p>
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
            <p>• A {feePercentage}% fee is applied to all withdrawals</p>
            <p>• Principal amounts can only be withdrawn after the staking period ends</p>
            <p>• Processing time is typically 24-48 hours</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Withdraw;