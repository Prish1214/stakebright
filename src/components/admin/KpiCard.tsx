import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';
  className?: string;
}

const ACCENT: Record<string, string> = {
  cyan: 'from-cyan-500/20 to-cyan-500/0 border-cyan-500/30 text-cyan-300',
  violet: 'from-violet-500/20 to-violet-500/0 border-violet-500/30 text-violet-300',
  emerald: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-300',
  amber: 'from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-300',
  rose: 'from-rose-500/20 to-rose-500/0 border-rose-500/30 text-rose-300',
};

export function KpiCard({ label, value, hint, icon, accent = 'cyan', className }: KpiCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 backdrop-blur',
      'bg-[#0d1322]/60',
      ACCENT[accent],
      className
    )}>
      <div className="absolute inset-0 opacity-30 pointer-events-none [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
          <div className="mt-1 text-2xl md:text-3xl font-bold tabular-nums text-white">{value}</div>
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
    </div>
  );
}
