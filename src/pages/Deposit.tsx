import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  Copy, QrCode, CheckCircle, Clock, XCircle, Wallet, ExternalLink, Timer,
  Layers, TrendingUp, Cpu, ChevronLeft, ChevronRight, IndianRupee, ArrowRight, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepositHistory {
  id: string;
  amount: number;
  transaction_hash: string;
  status: string;
  created_at: string;
  admin_notes?: string;
  target_wallet?: string;
  network?: string;
}

interface DepositCredit {
  id: string;
  deposit_id: string;
  target_wallet: string;
  amount_received: number;
  amount_credited: number;
  source: string;
  notes: string | null;
  created_at: string;
}

interface PaymentData {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  network: string;
  target_wallet: string;
  expiration_estimate_date: string;
  payment_status: string;
  deposit_id?: string;
}

type WalletType = 'staking' | 'trading' | 'mining';
type NetworkType = 'bep20' | 'trc20' | 'upi';

const TIMER_DURATION = 180;

const WALLETS: { id: WalletType; title: string; desc: string; icon: React.ElementType; gradient: string }[] = [
  { id: 'staking', title: 'Stake Wallet', desc: 'Fund staking plans (Silver / Gold / Platinum)', icon: Layers, gradient: 'from-purple-500/20 to-pink-500/20' },
  { id: 'trading', title: 'AI Trading Wallet', desc: 'Power AI-driven trading sessions', icon: TrendingUp, gradient: 'from-cyan-500/20 to-blue-500/20' },
  { id: 'mining',  title: 'Mining Wallet',     desc: 'Buy miners and earn daily rewards',  icon: Cpu, gradient: 'from-amber-500/20 to-orange-500/20' },
];

const NETWORKS: { id: NetworkType; title: string; desc: string; badge: string; disabled?: boolean; soon?: boolean }[] = [
  { id: 'bep20', title: 'USDT • BEP20', desc: 'Binance Smart Chain — fast & low fee', badge: 'Recommended' },
  { id: 'trc20', title: 'USDT • TRC20', desc: 'Tron network — ultra low fees', badge: 'Popular' },
  { id: 'upi',   title: 'INR • UPI',     desc: 'Pay in INR via UPI — powered by Transak',  badge: 'New' },
];

const Deposit = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositHistory[]>([]);
  const [auditLog, setAuditLog] = useState<DepositCredit[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentDepositId, setCurrentDepositId] = useState<string | null>(null);

  // Step flow
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [amount, setAmount] = useState('');
  const [minDeposit, setMinDeposit] = useState<number | null>(null);
  const [minLoading, setMinLoading] = useState(false);

  // INR/Transak state
  const [inrAmount, setInrAmount] = useState('');
  const [quote, setQuote] = useState<{ usdt_amount: number; rate: number; fees_inr: number; fallback?: boolean } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const cancelDeposit = useCallback(async (depositId: string) => {
    try {
      await supabase
        .from('deposits')
        .update({ status: 'canceled', admin_notes: 'Payment expired - 3 minute timer ran out' })
        .eq('id', depositId)
        .eq('status', 'pending');
      toast({ title: 'Payment Expired', description: 'The 3-minute window expired. Please try again.', variant: 'destructive' });
    } catch (e) { console.error(e); }
    setPaymentData(null); setTimeLeft(null); setCurrentDepositId(null);
    fetchDepositHistory();
  }, []);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(t);
          if (currentDepositId) cancelDeposit(currentDepositId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft, currentDepositId, cancelDeposit]);

  const fetchDepositHistory = async () => {
    if (!user) return;
    const [{ data: dep }, { data: cred }] = await Promise.all([
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('deposit_credits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setDepositHistory(dep || []);
    setAuditLog((cred as DepositCredit[]) || []);
  };

  useEffect(() => {
    fetchDepositHistory();
    const channel = supabase
      .channel('deposit-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          fetchDepositHistory();
          if (payload.new && (payload.new as DepositHistory).status === 'approved') {
            setPaymentData(null); setTimeLeft(null); setCurrentDepositId(null);
            toast({ title: 'Deposit Confirmed!', description: 'Funds credited to your selected wallet.' });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Address copied to clipboard' });
  };

  // Fetch live minimum when entering step 3 or changing network
  useEffect(() => {
    if (step !== 3 || !network || network === 'upi') { setMinDeposit(null); return; }
    let cancelled = false;
    setMinLoading(true);
    setMinDeposit(null);
    supabase.functions.invoke('get-min-deposit', { body: { network } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.min_usd) setMinDeposit(Number(data.min_usd));
      })
      .finally(() => { if (!cancelled) setMinLoading(false); });
    return () => { cancelled = true; };
  }, [step, network]);

  const handleCreatePayment = async () => {
    if (!wallet || !network) return;
    const depositAmount = parseFloat(amount);
    const effectiveMin = minDeposit ?? 1;
    if (!depositAmount || depositAmount < effectiveMin) {
      toast({ title: 'Amount too low', description: `Minimum deposit for USDT (${network.toUpperCase()}) is ${effectiveMin} USDT`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { amount: depositAmount, target_wallet: wallet, network }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPaymentData(data);
      setCurrentDepositId(data.deposit_id);
      setTimeLeft(TIMER_DURATION);
      toast({ title: 'Payment created', description: 'Send the exact amount within 3 minutes' });
      fetchDepositHistory();
    } catch (error: unknown) {
      toast({
        title: 'Error creating payment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep(1); setWallet(null); setNetwork(null); setAmount('');
    setPaymentData(null); setTimeLeft(null); setCurrentDepositId(null);
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const getStatusIcon = (status: string) => {
    if (['approved','confirmed','finished'].includes(status)) return <CheckCircle className="h-4 w-4 text-success" />;
    if (['pending','waiting','confirming'].includes(status)) return <Clock className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };
  const getStatusColor = (status: string) => {
    if (['approved','confirmed','finished'].includes(status)) return 'bg-success/10 text-success border-success/20';
    if (['pending','waiting','confirming'].includes(status)) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };
  const walletLabel = (w?: string) =>
    w === 'staking' ? 'Stake' : w === 'trading' ? 'AI Trading' : w === 'mining' ? 'Mining' : '—';

  // Stepper UI
  const Stepper = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
      {[1,2,3].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
            step === s ? "border-primary bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
              : step > s ? "border-success bg-success text-success-foreground"
              : "border-muted-foreground/30 text-muted-foreground"
          )}>
            {step > s ? <CheckCircle className="h-4 w-4" /> : s}
          </div>
          <span className={cn("text-xs sm:text-sm font-medium hidden sm:inline", step >= s ? "text-foreground" : "text-muted-foreground")}>
            {s === 1 ? 'Wallet' : s === 2 ? 'Network' : 'Amount'}
          </span>
          {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deposit Funds</h1>
        <p className="text-muted-foreground">Choose your destination wallet and network — funds are credited directly, no manual transfer needed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main flow card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {paymentData ? 'Complete Your Payment' : 'New Deposit'}
            </CardTitle>
            <CardDescription>
              {paymentData ? `${walletLabel(paymentData.target_wallet)} Wallet • ${paymentData.network.toUpperCase()}` : 'Modern, step-by-step deposit'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!paymentData && <Stepper />}

            {/* STEP 1 — Wallet */}
            {!paymentData && step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Choose Where You Want To Grow Your Funds</h3>
                  <p className="text-sm text-muted-foreground">Your deposit will be credited directly to this wallet.</p>
                </div>
                <div className="grid gap-3">
                  {WALLETS.map((w) => {
                    const Icon = w.icon;
                    const selected = wallet === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWallet(w.id)}
                        className={cn(
                          "group text-left p-4 rounded-xl border-2 transition-all bg-gradient-to-br",
                          w.gradient,
                          selected ? "border-primary shadow-[0_0_25px_hsl(var(--primary)/0.4)] scale-[1.01]"
                                   : "border-border hover:border-primary/50 hover:scale-[1.005]"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center bg-background/60 border",
                            selected ? "border-primary text-primary" : "border-border"
                          )}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{w.title}</div>
                            <div className="text-xs text-muted-foreground">{w.desc}</div>
                          </div>
                          {selected && <CheckCircle className="h-5 w-5 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button className="w-full" disabled={!wallet} onClick={() => setStep(2)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* STEP 2 — Network */}
            {!paymentData && step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Select Deposit Network</h3>
                  <p className="text-sm text-muted-foreground">Pick the network you'll send funds from.</p>
                </div>
                <div className="grid gap-3">
                  {NETWORKS.map((n) => {
                    const selected = network === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        disabled={n.disabled}
                        onClick={() => !n.disabled && setNetwork(n.id)}
                        className={cn(
                          "text-left p-4 rounded-xl border-2 transition-all",
                          n.disabled ? "opacity-60 cursor-not-allowed border-dashed border-border"
                            : selected ? "border-primary shadow-[0_0_25px_hsl(var(--primary)/0.4)] bg-primary/5"
                                       : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-background/60 border flex items-center justify-center">
                            {n.id === 'upi' ? <IndianRupee className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold flex items-center gap-2">
                              {n.title}
                              <Badge variant="outline" className={cn("text-[10px]",
                                n.soon ? "border-muted-foreground/30 text-muted-foreground" : "border-primary/30 text-primary")}>
                                {n.badge}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">{n.desc}</div>
                          </div>
                          {selected && <CheckCircle className="h-5 w-5 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button className="flex-1" disabled={!network} onClick={() => setStep(3)}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3 — Amount */}
            {!paymentData && step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Enter Deposit Amount</h3>
                  <p className="text-sm text-muted-foreground">
                    {minLoading
                      ? 'Checking minimum amount…'
                      : minDeposit
                        ? <>Minimum <span className="text-primary font-semibold">{minDeposit} USDT</span> for {network?.toUpperCase()} • Credited to <span className="text-primary font-medium">{walletLabel(wallet || undefined)} Wallet</span></>
                        : <>Funds credited to <span className="text-primary font-medium">{walletLabel(wallet || undefined)} Wallet</span></>}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USDT)</Label>
                  <Input id="amount" type="number" placeholder="10.00" min="1" step="0.01"
                    value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <div className="flex gap-2 flex-wrap">
                    {[10, 50, 100, 500, 1000].map(v => (
                      <button key={v} type="button" onClick={() => setAmount(String(v))}
                        className="px-3 py-1 text-xs rounded-full border border-border hover:border-primary hover:bg-primary/10 transition">
                        ${v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 text-xs space-y-1 bg-muted/30">
                  <div className="flex justify-between"><span>Wallet</span><span className="font-medium">{walletLabel(wallet || undefined)}</span></div>
                  <div className="flex justify-between"><span>Network</span><span className="font-medium">{network?.toUpperCase()}</span></div>
                  <div className="flex justify-between"><span>Amount</span><span className="font-medium">{amount || '0'} USDT</span></div>
                </div>
                {minDeposit && amount && parseFloat(amount) < minDeposit && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs p-3">
                    Amount is below the minimum. Please enter at least <span className="font-bold">{minDeposit} USDT</span> for {network?.toUpperCase()}.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button className="flex-1"
                    disabled={loading || !amount || minLoading || (minDeposit !== null && parseFloat(amount) < minDeposit)}
                    onClick={handleCreatePayment}>
                    {loading ? 'Generating…' : minLoading ? 'Checking minimum…' : 'Generate Payment Address'}
                  </Button>
                </div>
              </div>
            )}

            {/* PAYMENT DISPLAY */}
            {paymentData && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
                {timeLeft !== null && timeLeft > 0 && (
                  <div className={cn("flex items-center justify-center gap-2 p-3 rounded-lg",
                    timeLeft <= 60 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
                    <Timer className="h-5 w-5" />
                    <span className="font-bold text-xl">{formatTime(timeLeft)}</span>
                    <span className="text-sm">remaining</span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-1">Send Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Send exactly <span className="font-bold text-primary">{paymentData.pay_amount} {paymentData.pay_currency}</span>
                  </p>
                </div>
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentData.pay_address)}`}
                      alt="QR" className="w-[180px] h-[180px]" />
                  </div>
                </div>
                <div className="bg-background p-3 rounded border">
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 break-all">{paymentData.pay_address}</code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentData.pay_address)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {walletLabel(paymentData.target_wallet)} Wallet
                  </Badge>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    {paymentData.network.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">ID: {paymentData.payment_id}</Badge>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Funds will be credited automatically to your {walletLabel(paymentData.target_wallet)} Wallet once confirmed.
                </p>
                <Button variant="outline" className="w-full" onClick={resetFlow}>Start a New Deposit</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
            <CardDescription>Track all your deposits and where they were credited</CardDescription>
          </CardHeader>
          <CardContent>
            {depositHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No deposits yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {depositHistory.map((d) => (
                  <div key={d.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(d.status)}
                        <span className="font-medium">{Number(d.amount).toFixed(2)} USDT</span>
                      </div>
                      <Badge className={getStatusColor(d.status)}>
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{walletLabel(d.target_wallet)} Wallet</Badge>
                      {d.network && <Badge variant="outline" className="text-[10px]">{d.network.toUpperCase()}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="break-all">ID: {d.transaction_hash}</p>
                      <p>{new Date(d.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium flex items-center gap-2 mb-2">
            <ExternalLink className="h-4 w-4" /> How it works
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Pick the wallet you want to fund (Stake, AI Trading, or Mining)</li>
            <li>Choose your network — USDT BEP20 or TRC20 (INR/UPI coming soon)</li>
            <li>Send the exact amount within 3 minutes</li>
            <li>Funds are credited directly to your chosen wallet — no manual transfer required</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Deposit;
