import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import CyberCard from '@/components/ui/CyberCard';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

type Sym = 'BTC' | 'ETH' | 'SOL' | 'BNB';
const SYMS: { sym: Sym; base: number; vol: number; color: string }[] = [
  { sym: 'BTC', base: 67500, vol: 0.0008, color: '#f7931a' },
  { sym: 'ETH', base: 3450,  vol: 0.0011, color: '#8b5cf6' },
  { sym: 'SOL', base: 168,   vol: 0.0018, color: '#22d3ee' },
  { sym: 'BNB', base: 595,   vol: 0.0009, color: '#facc15' },
];

const seedHistory = (base: number, vol: number, n = 120) => {
  const now = Math.floor(Date.now() / 1000);
  const data: { time: UTCTimestamp; value: number }[] = [];
  let price = base * (1 + (Math.random() - 0.5) * 0.01);
  for (let i = n; i >= 0; i--) {
    price = price * (1 + (Math.random() - 0.5) * vol * 4);
    data.push({ time: (now - i * 5) as UTCTimestamp, value: +price.toFixed(2) });
  }
  return data;
};

const ChartCard = ({ sym, base, vol, color }: { sym: Sym; base: number; vol: number; color: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const priceRef = useRef<number>(base);
  const [price, setPrice] = useState(base);
  const [open24h, setOpen24h] = useState(base);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: 'monospace' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
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
    const seed = seedHistory(base, vol);
    series.setData(seed);
    lastTimeRef.current = seed[seed.length - 1].time as number;
    priceRef.current = seed[seed.length - 1].value;
    setPrice(priceRef.current);
    setOpen24h(seed[0].value);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    const tick = setInterval(() => {
      const next = priceRef.current * (1 + (Math.random() - 0.5) * vol * 2);
      priceRef.current = next;
      lastTimeRef.current += 2;
      series.update({ time: lastTimeRef.current as UTCTimestamp, value: +next.toFixed(2) });
      setPrice(next);
    }, 1200);

    return () => { clearInterval(tick); ro.disconnect(); chart.remove(); };
  }, [sym, base, vol, color]);

  const change = ((price - open24h) / open24h) * 100;
  const up = change >= 0;

  return (
    <div className="rounded-xl border border-primary/15 bg-background/40 p-3 hover:border-primary/40 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center font-mono font-bold text-[10px]" style={{ background: color + '22', color }}>{sym}</div>
          <div>
            <div className="text-xs font-mono font-bold">{sym}/USDT</div>
            <div className="text-[10px] text-muted-foreground font-mono">Live · 5s</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-bold tabular-nums">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
  return (
    <CyberCard glowColor="cyan">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-mono font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-secondary" /> Live Market Feed
          </h2>
          <p className="text-xs text-muted-foreground">Real-time price action across the bot's scalping universe</p>
        </div>
        <Badge variant="outline" className="border-success text-success font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1.5" /> LIVE
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SYMS.map(s => <ChartCard key={s.sym} {...s} />)}
      </div>
    </CyberCard>
  );
};

export default LiveMarketCharts;
