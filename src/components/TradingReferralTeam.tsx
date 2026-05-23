import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Zap, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface Member {
  user_id: string;
  username: string | null;
  created_at: string;
  qualified: boolean;
  trading_level: number;
}

const LEVELS = [
  { level: 1, refs: 0, capital: 100 },
  { level: 2, refs: 3, capital: 500 },
  { level: 3, refs: 8, capital: 1500 },
  { level: 4, refs: 20, capital: 5000 },
  { level: 5, refs: 50, capital: 12000 },
  { level: 6, refs: 100, capital: 30000 },
];

export const TradingReferralTeam = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc('get_trading_referral_team');
      setMembers(data || []);
      setLoading(false);
    })();
  }, [user]);

  const qualified = members.filter((m) => m.qualified);
  const pending = members.filter((m) => !m.qualified);

  const nextLevel = LEVELS.find((l) => qualified.length < l.refs) || LEVELS[LEVELS.length - 1];
  const prevReq = [...LEVELS].reverse().find((l) => qualified.length >= l.refs)?.refs ?? 0;
  const progressPct =
    nextLevel.refs === prevReq
      ? 100
      : Math.min(100, ((qualified.length - prevReq) / (nextLevel.refs - prevReq)) * 100);

  return (
    <Card className="border-cyan-500/30 bg-gradient-to-br from-card/80 to-cyan-500/5 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="h-5 w-5 text-cyan-400" />
          Trading Referral Team
          <Badge variant="outline" className="ml-auto border-cyan-500/40 text-cyan-300">
            {qualified.length} qualified
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Next-level progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2 text-foreground">
              <Zap className="h-4 w-4 text-cyan-300" /> Progress to Level {nextLevel.level}
            </span>
            <span className="font-mono text-cyan-300">
              {Math.min(qualified.length, nextLevel.refs)}/{nextLevel.refs} refs
            </span>
          </div>
          <Progress
            value={progressPct}
            className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Next level also requires ≥ ${nextLevel.capital.toLocaleString()} in your Trading Wallet.
          </p>
        </div>

        {/* Level matrix */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {LEVELS.map((l) => {
            const reached = qualified.length >= l.refs;
            return (
              <div
                key={l.level}
                className={`rounded-lg border p-2 text-center text-xs transition-colors ${
                  reached
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border/40 bg-card/40 text-muted-foreground'
                }`}
              >
                <div className="font-bold text-sm">L{l.level}</div>
                <div className="opacity-80">{l.refs} refs</div>
              </div>
            );
          })}
        </div>

        {/* Members list */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Referred Members ({members.length})
          </div>
          {loading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Loading team…</div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No referrals yet. Invite traders to climb levels!
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...qualified, ...pending].map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:border-cyan-500/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.username || 'Member'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {m.qualified ? (
                      <Badge className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> L{m.trading_level}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 gap-1">
                        <Clock className="h-3 w-3" /> Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          A referral qualifies for trading when their Trading Wallet balance reaches ≥ $100 (Level 1).
        </p>
      </CardContent>
    </Card>
  );
};

export default TradingReferralTeam;
