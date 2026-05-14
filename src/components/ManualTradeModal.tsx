import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NeonButton from '@/components/ui/NeonButton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Sym = 'BTC' | 'ETH' | 'SOL';
type Side = 'BUY' | 'SELL';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tradingWallet: number;
  onCompleted: () => void;
}

const FEE_RATE = 0.001; // 0.1%
const MIN_PCT = -2;
const MAX_PCT = 5;

const ManualTradeModal = ({ open, onOpenChange, tradingWallet, onCompleted }: Props) => {
  const [symbol, setSymbol] = useState<Sym>('BTC');
  const [side, setSide] = useState<Side>('BUY');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<null | { fee: number; gross: number; net: number; pct: number }>(null);

  const amt = Number(amount) || 0;
  const fee = useMemo(() => +(amt * FEE_RATE).toFixed(4), [amt]);
  const minProfit = useMemo(() => +((amt * MIN_PCT) / 100 - fee).toFixed(2), [amt, fee]);
  const maxProfit = useMemo(() => +((amt * MAX_PCT) / 100 - fee).toFixed(2), [amt, fee]);
  const valid = amt > 0 && amt <= tradingWallet;

  const reset = () => {
    setAmount('');
    setConfirming(false);
    setResult(null);
    setBusy(false);
  };

  const place = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('place_manual_trade', {
        p_symbol: symbol,
        p_side: side,
        p_amount: amt,
      });
      if (error) throw error;
      const r = data as any;
      setResult({ fee: Number(r.fee), gross: Number(r.gross), net: Number(r.net), pct: Number(r.pct) });
      toast({
        title: r.net >= 0 ? 'Trade Closed in Profit' : 'Trade Closed at Loss',
        description: `${side} ${symbol} · Net ${r.net >= 0 ? '+' : ''}${Number(r.net).toFixed(2)} USDT (${r.pct}%)`,
      });
      onCompleted();
    } catch (e: any) {
      toast({ title: 'Trade failed', description: e.message, variant: 'destructive' });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="cyber-card border-primary/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono gradient-text flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Place Manual Trade
          </DialogTitle>
          <DialogDescription>
            Instant scalp trade against the live market. Fee 0.1% · expected return -2% to +5%.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Symbol</Label>
                <Select value={symbol} onValueChange={(v) => setSymbol(v as Sym)} disabled={confirming || busy}>
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC">BTC/USDT</SelectItem>
                    <SelectItem value="ETH">ETH/USDT</SelectItem>
                    <SelectItem value="SOL">SOL/USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Side</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    disabled={confirming || busy}
                    onClick={() => setSide('BUY')}
                    className={`h-10 rounded-md border font-mono text-sm flex items-center justify-center gap-1 transition ${
                      side === 'BUY'
                        ? 'border-success bg-success/10 text-success'
                        : 'border-input text-muted-foreground hover:border-success/50'
                    }`}
                  >
                    <TrendingUp className="h-3 w-3" /> BUY
                  </button>
                  <button
                    type="button"
                    disabled={confirming || busy}
                    onClick={() => setSide('SELL')}
                    className={`h-10 rounded-md border font-mono text-sm flex items-center justify-center gap-1 transition ${
                      side === 'SELL'
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-input text-muted-foreground hover:border-destructive/50'
                    }`}
                  >
                    <TrendingDown className="h-3 w-3" /> SELL
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USDT)</Label>
                <button
                  type="button"
                  className="text-[10px] font-mono text-primary hover:underline"
                  onClick={() => setAmount(String(tradingWallet))}
                  disabled={confirming || busy}
                >
                  Max: {tradingWallet.toFixed(2)}
                </button>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={confirming || busy}
                className="font-mono"
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-background/50 p-3 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trade size</span>
                <span>{amt.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (0.1%)</span>
                <span className="text-destructive">-{fee.toFixed(4)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected net P/L</span>
                <span>
                  <Badge variant="outline" className="border-destructive/40 text-destructive mr-1">
                    {minProfit.toFixed(2)}
                  </Badge>
                  <Badge variant="outline" className="border-success/40 text-success">
                    +{maxProfit.toFixed(2)}
                  </Badge>
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-primary/10">
                <span className="text-muted-foreground">Trading Wallet</span>
                <span className="text-accent">{tradingWallet.toFixed(2)} USDT</span>
              </div>
            </div>

            {amt > tradingWallet && (
              <p className="text-xs text-destructive font-mono">Amount exceeds Trading Wallet balance.</p>
            )}

            <DialogFooter className="gap-2">
              {!confirming ? (
                <NeonButton onClick={() => setConfirming(true)} disabled={!valid} className="w-full">
                  Review Trade
                </NeonButton>
              ) : (
                <>
                  <NeonButton glowColor="cyan" onClick={() => setConfirming(false)} disabled={busy} className="flex-1">
                    Cancel
                  </NeonButton>
                  <NeonButton onClick={place} disabled={busy} className="flex-1">
                    {busy ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Confirm {side}
                  </NeonButton>
                </>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-lg border p-4 text-center ${
                result.net >= 0 ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Net Result</p>
              <p
                className={`text-3xl font-mono font-bold ${
                  result.net >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {result.net >= 0 ? '+' : ''}
                {result.net.toFixed(2)} USDT
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {result.pct >= 0 ? '+' : ''}
                {result.pct}% · fee {result.fee.toFixed(4)} USDT
              </p>
            </div>
            <DialogFooter className="gap-2">
              <NeonButton glowColor="cyan" onClick={reset} className="flex-1">
                New Trade
              </NeonButton>
              <NeonButton onClick={() => onOpenChange(false)} className="flex-1">
                Close
              </NeonButton>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManualTradeModal;
