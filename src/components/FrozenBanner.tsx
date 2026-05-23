import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertOctagon } from 'lucide-react';

export const FrozenBanner = () => {
  const { user } = useAuth();
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase.from('profiles').select('is_frozen').eq('user_id', user.id).maybeSingle();
      if (active) setFrozen(!!data?.is_frozen);
    };
    check();
    const ch = supabase
      .channel('frozen-' + user.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        (p: any) => setFrozen(!!p.new?.is_frozen))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  if (!frozen) return null;
  return (
    <div className="sticky top-10 z-40 bg-gradient-to-r from-rose-600/95 via-red-600/95 to-rose-600/95 border-b border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.5)]">
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-medium">
        <AlertOctagon className="w-4 h-4 animate-pulse" />
        <span>Your account is frozen. Deposits, withdrawals, staking, mining and trading are disabled. Please contact support.</span>
      </div>
    </div>
  );
};
