import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from 'lucide-react';

type Announcement = { id: string; title: string; body: string; type: string };

const STORAGE_KEY = 'dismissed_announcements_v1';

const styles: Record<string, { wrap: string; icon: JSX.Element }> = {
  info:    { wrap: 'from-cyan-600/95 to-blue-600/95 border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.4)]', icon: <Info className="w-4 h-4" /> },
  success: { wrap: 'from-emerald-600/95 to-green-600/95 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.4)]', icon: <CheckCircle2 className="w-4 h-4" /> },
  warning: { wrap: 'from-amber-500/95 to-orange-600/95 border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.4)]', icon: <AlertTriangle className="w-4 h-4" /> },
  danger:  { wrap: 'from-rose-600/95 to-red-600/95 border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.4)]', icon: <AlertOctagon className="w-4 h-4" /> },
};

export const AnnouncementsBanner = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });

  const load = async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from('announcements')
      .select('id,title,body,type')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const visible = items.filter(i => !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-3">
      {visible.map(a => {
        const s = styles[a.type] || styles.info;
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-lg border bg-gradient-to-r ${s.wrap} px-4 py-3 text-white animate-fade-in`}>
            <div className="mt-0.5">{s.icon}</div>
            <div className="flex-1">
              <div className="font-semibold text-sm leading-tight">{a.title}</div>
              <div className="text-xs opacity-95 mt-0.5">{a.body}</div>
            </div>
            <button onClick={() => dismiss(a.id)} className="opacity-80 hover:opacity-100" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
