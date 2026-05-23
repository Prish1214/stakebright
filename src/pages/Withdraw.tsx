import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, DollarSign, Clock, CheckCircle, Lock, Unlock, Coins, BookmarkPlus, X, TrendingUp, Pickaxe, Users, LineChart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LockedBalanceOverview } from '@/components/withdraw/LockedBalanceOverview';

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
  source?: string;
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

interface EarningsBreakdown {
  total: number;
  staking: number;
  mining: number;
  referral: number;
  trading: number;
}

const ACTIVE_WITHDRAWAL_STATUSES = ['pending', 'approved', 'confirmed', 'completed'];

const Withdraw = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsBreakdown>({ total: 0, staking: 0, mining: 0, referral: 0, trading: 0 });
  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [pendingPrincipalStakeIds, setPendingPrincipalStakeIds] = useState<Set<string>>(new Set());
  const [earningsAmount, setEarningsAmount] = useState('');
  const [earningsAddress, setEarningsAddress] = useState('');
  const [tradingAmount, setTradingAmount] = useState('');
  const [tradingAddress, setTradingAddress] = useState('');
  const [principalAddress, setPrincipalAddress] = useState('');
  const [principalStakeId, setPrincipalStakeId] = useState<string | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([]);
  const [feePercentage, setFeePercentage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [submittingEarnings, setSubmittingEarnings] = useState(false);
  const [submittingTrading, setSubmittingTrading] = useState(false);
  const [submittingPrincipal, setSubmittingPrincipal] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);

  const SAVED_KEY = 'withdraw_saved_addresses';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSavedAddresses(JSON.parse(raw));
    } catch {}
  }, []);
  const persistAddresses = (list: string[]) => {
    setSavedAddresses(list);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch {}
  };
  const saveAddress = (addr: string) => {
    const a = addr.trim();
    if (!a || savedAddresses.includes(a)) return;
    const list = [a, ...savedAddresses].slice(0, 5);
    persistAddresses(list);
    toast({ title: 'Address saved' });
  };
  const removeAddress = (addr: string) => persistAddresses(savedAddresses.filter(a => a !== addr));

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
    if (!user) return;
    try {
      const { data: settingsData } = await supabase
        .from('system_settings').select('setting_value')
        .eq('setting_key', 'withdrawal_fee_percentage').single();
      if (settingsData) setFeePercentage(Number(settingsData.setting_value));

      // Profile = source of truth for earnings & trading balances
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('withdrawable_earnings, earnings_staking, earnings_mining, earnings_referral, trading_wallet')
        .eq('user_id', user.id).maybeSingle();

      setEarnings({
        total: Number(profile?.withdrawable_earnings || 0),
        staking: Number(profile?.earnings_staking || 0),
        mining: Number(profile?.earnings_mining || 0),
        referral: Number(profile?.earnings_referral || 0),
        trading: Number(profile?.trading_wallet || 0),
      });

      const { data: stakesData } = await supabase
        .from('stakes')
        .select('id, amount, total_earned, daily_return, start_date, end_date, is_active, principal_withdrawn, staking_plans(name)')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });
      const normalized: StakeRow[] = (stakesData || []).map((s: any) => ({
        id: s.id, amount: Number(s.amount), total_earned: Number(s.total_earned ?? 0),
        daily_return: Number(s.daily_return ?? 0), start_date: s.start_date, end_date: s.end_date,
        is_active: s.is_active, principal_withdrawn: s.principal_withdrawn, plan_name: s.staking_plans?.name,
      }));
      setStakes(normalized);

      const { data: historyData } = await supabase
        .from('withdrawals').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setWithdrawalHistory((historyData as any) || []);

      const pendingPrincipal = new Set<string>();
      (historyData || []).forEach((w: any) => {
        if (w.withdrawal_type === 'principal' && w.stake_id && ACTIVE_WITHDRAWAL_STATUSES.includes(w.status)) {
          pendingPrincipal.add(w.stake_id);
        }
      });
      setPendingPrincipalStakeIds(pendingPrincipal);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calcFee = (n: number) => (n * feePercentage) / 100;
  const calcNet = (n: number) => n - calcFee(n);

  const handleWithdraw = async (source: 'earnings' | 'trading') => {
    const amountStr = source === 'earnings' ? earningsAmount : tradingAmount;
    const address = source === 'earnings' ? earningsAddress : tradingAddress;
    const balance = source === 'earnings' ? earnings.total : earnings.trading;
    const amount = Number(amountStr);

    if (!amount || amount <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }
    if (!address.trim()) { toast({ title: 'Address required', variant: 'destructive' }); return; }
    if (amount > balance) { toast({ title: 'Insufficient balance', variant: 'destructive' }); return; }

    source === 'earnings' ? setSubmittingEarnings(true) : setSubmittingTrading(true);
    try {
      const { data, error } = await (supabase as any).rpc('request_withdrawal', {
        p_source: source, p_amount: amount, p_address: address.trim(),
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Failed');
      saveAddress(address);
      toast({ title: source === 'earnings' ? 'Earnings Withdrawal Requested' : 'Trading Withdrawal Requested', description: 'Submitted for admin approval' });
      if (source === 'earnings') { setEarningsAmount(''); setEarningsAddress(''); }
      else { setTradingAmount(''); setTradingAddress(''); }
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      source === 'earnings' ? setSubmittingEarnings(false) : setSubmittingTrading(false);
    }
  };

  const handleWithdrawPrincipal = async (stake: StakeRow) => {
    if (!principalAddress.trim()) { toast({ title: 'Address Required', variant: 'destructive' }); return; }
    setSubmittingPrincipal(stake.id);
    try {
      const { error } = await supabase.from('withdrawals').insert({
        user_id: user!.id, amount: stake.amount, fee_amount: 0, net_amount: stake.amount,
        withdrawal_type: 'principal', stake_id: stake.id,
        withdrawal_address: principalAddress.trim(), status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Principal Withdrawal Requested', description: 'Submitted for admin approval (no fee)' });
      setPrincipalStakeId(null); setPrincipalAddress(''); fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingPrincipal(null);
    }
  };

  const getStatusIcon = (status: string) => {
    if (['completed','approved','confirmed'].includes(status)) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-500" />;
    return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
  };
  const getStatusColor = (status: string) => {
    if (['completed','approved','confirmed'].includes(status)) return 'text-green-500';
    if (status === 'pending') return 'text-yellow-500';
    return 'text-red-500';
  };
  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const daysUntil = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  const SavedAddressChips = ({ value, onPick }: { value: string; onPick: (a: string) => void }) =>
    savedAddresses.length > 0 ? (
      <div className="mt-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Saved addresses</p>
        <div className="flex flex-wrap gap-2">
          {savedAddresses.map((a) => (
            <div key={a} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
              <button type="button" onClick={() => onPick(a)} className="font-mono hover:text-crypto-purple">
                {a.slice(0, 8)}…{a.slice(-6)}
              </button>
              <button type="button" onClick={() => removeAddress(a)} className="text-muted-foreground hover:text-destructive p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Withdraw</h1>
        <p className="text-muted-foreground mt-2">
          Cash out your Withdrawable Earnings, Trading Wallet balance, or unlocked stake principal.
        </p>
      </div>

      {/* A. Withdrawable Earnings */}
      <Card className="border-crypto-gold/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-crypto-gold" />
            Withdrawable Earnings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="text-4xl font-bold text-crypto-gold">{earnings.total.toFixed(2)} <span className="text-base font-normal text-muted-foreground">USDT</span></div>
            <span className="text-xs text-muted-foreground">{feePercentage}% network fee on withdrawal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-crypto-purple/20 bg-card/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Staking Rewards</span>
                <TrendingUp className="h-4 w-4 text-crypto-purple" />
              </div>
              <div className="text-xl font-semibold text-crypto-purple">{earnings.staking.toFixed(2)} <span className="text-xs text-muted-foreground">USDT</span></div>
            </div>
            <div className="rounded-lg border border-crypto-gold/20 bg-card/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mining Rewards</span>
                <Pickaxe className="h-4 w-4 text-crypto-gold" />
              </div>
              <div className="text-xl font-semibold text-crypto-gold">{earnings.mining.toFixed(2)} <span className="text-xs text-muted-foreground">USDT</span></div>
            </div>
            <div className="rounded-lg border border-accent/20 bg-card/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Referral Rewards</span>
                <Users className="h-4 w-4 text-accent" />
              </div>
              <div className="text-xl font-semibold text-accent">{earnings.referral.toFixed(2)} <span className="text-xs text-muted-foreground">USDT</span></div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/50">
            <div>
              <Label htmlFor="e-amount">Amount (USDT)</Label>
              <Input id="e-amount" type="number" placeholder="Enter amount to withdraw"
                value={earningsAmount} onChange={(e) => setEarningsAmount(e.target.value)} max={earnings.total} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="e-address">USDT BEP20 Address</Label>
                {earningsAddress.trim() && !savedAddresses.includes(earningsAddress.trim()) && (
                  <button type="button" onClick={() => saveAddress(earningsAddress)} className="text-xs text-crypto-purple hover:text-crypto-purple/80 flex items-center gap-1">
                    <BookmarkPlus className="h-3 w-3" /> Save
                  </button>
                )}
              </div>
              <Input id="e-address" type="text" placeholder="0x..." value={earningsAddress} onChange={(e) => setEarningsAddress(e.target.value)} />
              <SavedAddressChips value={earningsAddress} onPick={setEarningsAddress} />
              <p className="text-xs text-muted-foreground mt-2">⚠️ Only USDT BEP20 network. Wrong network = lost funds!</p>
            </div>
            {earningsAmount && Number(earningsAmount) > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm"><span>Amount:</span><span>{Number(earningsAmount).toFixed(2)} USDT</span></div>
                <div className="flex justify-between text-sm"><span>Fee ({feePercentage}%):</span><span>{calcFee(Number(earningsAmount)).toFixed(2)} USDT</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>Net:</span><span className="text-crypto-gold">{calcNet(Number(earningsAmount)).toFixed(2)} USDT</span></div>
              </div>
            )}
            <Button onClick={() => handleWithdraw('earnings')}
              disabled={submittingEarnings || !earningsAmount || Number(earningsAmount) <= 0 || !earningsAddress.trim()}
              className="w-full">
              {submittingEarnings ? 'Processing...' : 'Withdraw Earnings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* B. Trading Wallet Balance */}
      <Card className="border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-accent" />
            Trading Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="text-3xl font-bold text-accent">{earnings.trading.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDT</span></div>
            <span className="text-xs text-muted-foreground">Compounded auto-trading profits • fully withdrawable anytime</span>
          </div>
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div>
              <Label htmlFor="t-amount">Amount (USDT)</Label>
              <Input id="t-amount" type="number" placeholder="Enter amount to withdraw"
                value={tradingAmount} onChange={(e) => setTradingAmount(e.target.value)} max={earnings.trading} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="t-address">USDT BEP20 Address</Label>
                {tradingAddress.trim() && !savedAddresses.includes(tradingAddress.trim()) && (
                  <button type="button" onClick={() => saveAddress(tradingAddress)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                    <BookmarkPlus className="h-3 w-3" /> Save
                  </button>
                )}
              </div>
              <Input id="t-address" type="text" placeholder="0x..." value={tradingAddress} onChange={(e) => setTradingAddress(e.target.value)} />
              <SavedAddressChips value={tradingAddress} onPick={setTradingAddress} />
            </div>
            {tradingAmount && Number(tradingAmount) > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm"><span>Amount:</span><span>{Number(tradingAmount).toFixed(2)} USDT</span></div>
                <div className="flex justify-between text-sm"><span>Fee ({feePercentage}%):</span><span>{calcFee(Number(tradingAmount)).toFixed(2)} USDT</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span>Net:</span><span className="text-accent">{calcNet(Number(tradingAmount)).toFixed(2)} USDT</span></div>
              </div>
            )}
            <Button onClick={() => handleWithdraw('trading')} variant="outline"
              disabled={submittingTrading || !tradingAmount || Number(tradingAmount) <= 0 || !tradingAddress.trim()}
              className="w-full border-accent text-accent hover:bg-accent/10">
              {submittingTrading ? 'Processing...' : 'Withdraw Trading Balance'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* C. Locked Balance Overview */}
      <LockedBalanceOverview userId={user?.id} />

      {/* D. Stake Principal Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Stake Principal Status
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
                            <Badge variant="outline"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>
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
                          <Input id={`addr-${stake.id}`} placeholder="0x..." value={principalAddress} onChange={(e) => setPrincipalAddress(e.target.value)} />
                        </div>
                        <div className="p-3 bg-muted/50 rounded text-sm flex justify-between">
                          <span>You will receive:</span>
                          <span className="font-semibold text-crypto-gold">{stake.amount.toFixed(2)} USDT (no fee)</span>
                        </div>
                        <Button className="w-full"
                          disabled={submittingPrincipal === stake.id || !principalAddress.trim()}
                          onClick={() => handleWithdrawPrincipal(stake)}>
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

      {/* History */}
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
              {withdrawalHistory.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(w.status)}
                    <div>
                      <p className="font-medium">{Number(w.amount).toFixed(2)} USDT</p>
                      <p className="text-sm text-muted-foreground capitalize">{w.source || w.withdrawal_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium capitalize ${getStatusColor(w.status)}`}>{w.status}</p>
                    <p className="text-sm text-muted-foreground">Net: {Number(w.net_amount).toFixed(2)} USDT</p>
                    <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
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
            <p>• A {feePercentage}% fee applies to <strong>Withdrawable Earnings</strong> (staking + mining + referral) and <strong>Trading Wallet</strong> withdrawals</p>
            <p>• Principal withdrawals are <strong>fee-free</strong> after the staking period ends</p>
            <p>• Staking & mining allocations are locked until their runtime completes</p>
            <p>• Trading Wallet is fully withdrawable anytime — profits auto-compound into it</p>
            <p>• Processing time is typically 24-48 hours</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Withdraw;
