import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NeonButton from '@/components/ui/NeonButton';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { ArrowRight, ArrowDownUp, TrendingUp, Pickaxe, LineChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type WalletKey = 'staking' | 'mining' | 'trading';

export interface WalletBalances {
  staking: number;
  mining: number;
  trading: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: WalletBalances;
  defaultFrom?: WalletKey;
  defaultTo?: WalletKey;
  onTransferred?: () => void;
}

const WALLETS: { key: WalletKey; label: string; icon: any; color: string }[] = [
  { key: 'staking', label: 'Staking Wallet', icon: TrendingUp, color: 'text-primary' },
  { key: 'mining', label: 'Mining Wallet', icon: Pickaxe, color: 'text-crypto-gold' },
  { key: 'trading', label: 'Trading Wallet', icon: LineChart, color: 'text-accent' },
];

const labelOf = (k: WalletKey) => WALLETS.find(w => w.key === k)!.label;

export const WalletTransferModal = ({ open, onOpenChange, balances, defaultFrom = 'staking', defaultTo = 'trading', onTransferred }: Props) => {
  const { user } = useAuth();
  const [from, setFrom] = useState<WalletKey>(defaultFrom);
  const [to, setTo] = useState<WalletKey>(defaultTo);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
      setTo(defaultTo);
      setAmount('');
      fetchHistory();
    }
  }, [open, defaultFrom, defaultTo]);

  const fetchHistory = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('wallet_transfers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setHistory(data || []);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleTransfer = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (from === to) { toast({ title: 'Pick two different wallets', variant: 'destructive' }); return; }
    if (amt > balances[from]) { toast({ title: 'Insufficient balance', variant: 'destructive' }); return; }

    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc('transfer_between_wallets', {
        p_from: from, p_to: to, p_amount: amt
      });
      if (error) throw error;
      toast({ title: 'Transfer complete', description: `${amt.toFixed(2)} USDT → ${labelOf(to)}` });
      onTransferred?.();
      setAmount('');
      fetchHistory();
    } catch (e: any) {
      toast({ title: 'Transfer failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg cyber-card border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-mono gradient-text flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5" /> Transfer Funds
          </DialogTitle>
          <DialogDescription>Move USDT between your wallets instantly. No fees.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* From / To */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">From</Label>
              <Select value={from} onValueChange={(v) => setFrom(v as WalletKey)}>
                <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WALLETS.map(w => (
                    <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground font-mono">
                Balance: <AnimatedNumber value={balances[from]} glowColor="cyan" suffix=" USDT" />
              </div>
            </div>

            <button
              type="button"
              onClick={swap}
              className="h-10 w-10 rounded-full border border-primary/40 flex items-center justify-center hover:rotate-180 hover:bg-primary/10 transition-all duration-500 mb-7"
              aria-label="Swap"
            >
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">To</Label>
              <Select value={to} onValueChange={(v) => setTo(v as WalletKey)}>
                <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WALLETS.map(w => (
                    <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground font-mono">
                Balance: <AnimatedNumber value={balances[to]} glowColor="purple" suffix=" USDT" />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Amount (USDT)</Label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="font-mono text-lg pr-20"
              />
              <button
                type="button"
                onClick={() => setAmount(String(balances[from]))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-primary hover:text-primary/80 px-2 py-1 rounded border border-primary/30"
              >
                MAX
              </button>
            </div>
          </div>

          <NeonButton onClick={handleTransfer} disabled={loading} className="w-full">
            {loading ? 'Processing...' : `Transfer to ${labelOf(to)}`}
          </NeonButton>

          {/* History */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-primary/10">
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Transfers</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs font-mono p-2 rounded bg-muted/20 border border-primary/10">
                    <span className="text-muted-foreground">
                      {labelOf(h.from_wallet)} <ArrowRight className="inline h-3 w-3 mx-1" /> {labelOf(h.to_wallet)}
                    </span>
                    <span className="text-success">+{Number(h.amount).toFixed(2)} USDT</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletTransferModal;
