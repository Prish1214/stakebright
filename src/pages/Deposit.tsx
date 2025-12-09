import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Copy, QrCode, CheckCircle, Clock, XCircle, Wallet, ExternalLink } from 'lucide-react';

interface DepositHistory {
  id: string;
  amount: number;
  transaction_hash: string;
  status: string;
  created_at: string;
  admin_notes?: string;
}

interface PaymentData {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  expiration_estimate_date: string;
  payment_status: string;
}

const Deposit = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositHistory[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchDepositHistory();
    
    // Set up real-time subscription for deposit changes
    const channel = supabase
      .channel('deposit-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposits',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchDepositHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchDepositHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepositHistory(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error loading deposits",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard"
    });
  };

  const handleCreatePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const depositAmount = parseFloat(amount);

    if (depositAmount < 25) {
      toast({
        title: "Invalid amount",
        description: "Minimum deposit is 25 USDT",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { amount: depositAmount }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setPaymentData(data);
      toast({
        title: "Payment created!",
        description: "Send USDT to the address shown below"
      });

      // Reset amount
      setAmount('');
      fetchDepositHistory();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error creating payment",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'confirmed':
      case 'finished':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
      case 'waiting':
      case 'confirming':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'rejected':
      case 'failed':
      case 'expired':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'confirmed':
      case 'finished':
        return 'bg-success/10 text-success border-success/20';
      case 'pending':
      case 'waiting':
      case 'confirming':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'rejected':
      case 'failed':
      case 'expired':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deposit USDT</h1>
        <p className="text-muted-foreground">Add funds to your wallet to start staking</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Make a Deposit
            </CardTitle>
            <CardDescription>
              Enter the amount and we'll generate a payment address for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Address Display */}
            {paymentData && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Send Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Send exactly <span className="font-bold text-primary">{paymentData.pay_amount} {paymentData.pay_currency.toUpperCase()}</span> to:
                  </p>
                </div>
                
                <div className="bg-background p-3 rounded border">
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 break-all">{paymentData.pay_address}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(paymentData.pay_address)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    USDT BEP20 Only
                  </Badge>
                  <Badge variant="outline">
                    ID: {paymentData.payment_id}
                  </Badge>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Payment will be automatically confirmed once transaction is detected
                </p>
              </div>
            )}

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Deposit Amount (USDT)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="25.00"
                  min="25"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Minimum deposit: 25 USDT</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Payment...' : 'Generate Payment Address'}
              </Button>
            </form>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <h4 className="font-medium flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                How it works
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Enter the amount you want to deposit</li>
                <li>A unique payment address will be generated</li>
                <li>Send USDT (BEP20) to the address</li>
                <li>Your deposit will be automatically confirmed</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Deposit History */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
            <CardDescription>Track your deposit requests</CardDescription>
          </CardHeader>
          <CardContent>
            {depositHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No deposits yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {depositHistory.map((deposit) => (
                  <div key={deposit.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(deposit.status)}
                        <span className="font-medium">{Number(deposit.amount).toFixed(2)} USDT</span>
                      </div>
                      <Badge className={getStatusColor(deposit.status)}>
                        {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Payment ID: {deposit.transaction_hash}</p>
                      <p>{new Date(deposit.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Deposit;
