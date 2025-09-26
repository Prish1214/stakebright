import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Copy, QrCode, CheckCircle, Clock, XCircle } from 'lucide-react';

interface DepositHistory {
  id: string;
  amount: number;
  transaction_hash: string;
  status: string;
  created_at: string;
}

const Deposit = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositHistory[]>([]);
  const [depositAddress] = useState('0x652fdEab799Bd430038f010773CC340eAd9a6338');

  useEffect(() => {
    fetchDepositHistory();
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
    } catch (error: any) {
      toast({
        title: "Error loading deposits",
        description: error.message,
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

  const handleSubmitDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const transactionHash = formData.get('transaction_hash') as string;

    if (amount < 25) {
      toast({
        title: "Invalid amount",
        description: "Minimum deposit is 25 USDT",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('deposits')
        .insert({
          user_id: user?.id,
          amount,
          transaction_hash: transactionHash
        });

      if (error) throw error;

      toast({
        title: "Deposit submitted!",
        description: "Your deposit request has been submitted for review"
      });

      // Reset form
      (e.target as HTMLFormElement).reset();
      fetchDepositHistory();
    } catch (error: any) {
      toast({
        title: "Error submitting deposit",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success/10 text-success border-success/20';
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'rejected':
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
              <QrCode className="h-5 w-5" />
              Make a Deposit
            </CardTitle>
            <CardDescription>
              Send USDT (BEP20) to the address below and submit the transaction details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code Placeholder - In production, you'd generate an actual QR code */}
            <div className="bg-muted rounded-lg p-6 text-center space-y-4">
              <div className="w-32 h-32 bg-card border-2 border-dashed border-border rounded-lg mx-auto flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">USDT BEP20 Address</p>
                <div className="flex items-center gap-2 bg-background p-2 rounded border">
                  <code className="text-xs flex-1 break-all">{depositAddress}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(depositAddress)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  Only USDT BEP20 supported
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSubmitDeposit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Deposit Amount (USDT)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="25.00"
                  min="25"
                  step="0.01"
                  required
                />
                <p className="text-xs text-muted-foreground">Minimum deposit: 25 USDT</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_hash">Transaction Hash</Label>
                <Input
                  id="transaction_hash"
                  name="transaction_hash"
                  type="text"
                  placeholder="0x..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the transaction hash from your wallet
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Deposit'}
              </Button>
            </form>
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
              <div className="space-y-4">
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
                      <p>TX: {deposit.transaction_hash.substring(0, 20)}...</p>
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