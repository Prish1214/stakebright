import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-cyan-500/10 bg-[#0d1322]/60 backdrop-blur', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cyan-500/10">
          <h3 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h3>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
