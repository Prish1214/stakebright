import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import CyberCard from '@/components/ui/CyberCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

type Sym = 'BTC' | 'ETH' | 'SOL' | 'BNB';
const SYMS: { sym: Sym; pair: string; color: string }[] = [
  { sym: 'BTC', pair: 'BTCUSDT', color: '#f7931a' },
  { sym: 'ETH', pair: 'ETHUSDT', color: '#8b5cf6' },
  { sym: 'SOL', pair: 'SOLUSDT', color: '#22d3ee' },
  { sym: 'BNB', pair: 'BNBUSDT', color: '#facc15' },
];

type TF = '1m' | '5m' | '1h' | '1d';
const TF_CONFIG: Record<TF, { interval: string; limit: number; pollMs: number }> = {
  '1m': { interval: '1m', limit: 120, pollMs: 5000 },
  '5m': { interval: '5m', limit: 120, pollMs: 15000 },
  '1h': { interval: '1h', limit: 168, pollMs: 30000 },
  '1d': { interval: '1d', limit: 90, pollMs: 60000 },
};

const fetchKlines = async (pair: string, interval: string, limit: number) => {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error('klines fetch failed');
  const data: any[] = await res.json();
  return data.map(k => ({ time: Math.floor(k[0] / 1000) as UTCTimestamp, value: +(+k[4]).toFixed(2) }));
};

const ChartCard = ({ sym, pair, color, tf }: { sym: Sym; pair: string; color: string; tf: TF }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [price, setPrice] = useState(0);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: 'monospace' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: tf !== '1d', secondsVisible: false },
      crosshair: { mode: 0 },
      height: 180,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color + '55',
      bottomColor: color + '00',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: sym === 'BTC' ? 1 : 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    let cancelled = false;
    const load = async () => {
      try {
        const cfg = TF_CONFIG[tf];
        const data = await fetchKlines(pair, cfg.interval, cfg.limit);
        if (cancelled || data.length === 0) return;
        series.setData(data);
        chart.timeScale().fitContent();
        setPrice(data[data.length - 1].value);
        setOpen(data[0].value);
      } catch (e) {
        console.error('chart load', sym, e);
      }
    };
    load();

    const poll = setInterval(async () => {
      try {
        const cfg = TF_CONFIG[tf];
        const data = await fetchKlines(pair, cfg.interval, 2);
        if (cancelled || data.length === 0) return;
        data.forEach(d => series.update(d));
        setPrice(data[data.length - 1].value);
      } catch {}
    }, TF_CONFIG[tf].pollMs);

    return () => { cancelled = true; clearInterval(poll); ro.disconnect(); chart.remove(); };
  }, [sym, pair, color, tf]);

  const change = open ? ((price - open) / open) * 100 : 0;
  const up = change >= 0;

  return (
    <div className="rounded-xl border border-primary/15 bg-background/40 p-3 hover:border-primary/40 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center font-mono font-bold text-[10px]" style={{ background: color + '22', color }}>{sym}</div>
          <div>
            <div className="text-xs font-mono font-bold">{sym}/USDT</div>
            <div className="text-[10px] text-muted-foreground font-mono">Live · {tf}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-bold tabular-nums">${price ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</div>
          <Badge variant="outline" className={`text-[10px] font-mono ${up ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'}`}>
            {up ? <TrendingUp className="h-2.5 w-2.5 mr-1" /> : <TrendingDown className="h-2.5 w-2.5 mr-1" />}
            {up ? '+' : ''}{change.toFixed(2)}%
          </Badge>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 180 }} />
    </div>
  );
};

const LiveMarketCharts = () => {
  const [tf, setTf] = useState<TF>('5m');
  return (
    <CyberCard glowColor="cyan">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-mono font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-secondary" /> Live Market Feed
          </h2>
          <p className="text-xs text-muted-foreground">Real-time prices from Binance · {tf} candles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-primary/20 bg-background/40 p-1">
            {(['1m', '5m', '1h', '1d'] as TF[]).map(t => (
              <Button
                key={t}
                size="sm"
                variant="ghost"
                onClick={() => setTf(t)}
                className={`h-7 px-3 text-[11px] font-mono ${tf === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
              >
                {t}
              </Button>
            ))}
          </div>
          <Badge variant="outline" className="border-success text-success font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1.5" /> LIVE
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SYMS.map(s => <ChartCard key={s.sym} {...s} tf={tf} />)}
      </div>
    </CyberCard>
  );
};

export default LiveMarketCharts;
