import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Trophy, Sparkles, CheckCircle2, Clock } from 'lucide-react';

interface Member {
  user_id: string;
  username: string | null;
  email: string;
  created_at: string;
  total_deposits: number;
  qualified: boolean;
}

const GOLD_REQ = 5;
const PLATINUM_REQ = 15;

export const StakingReferralTeam = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc('get_staking_referral_team');
      setMembers(data || []);
      setLoading(false);
    })();
  }, [user]);

  const qualified = members.filter((m) => m.qualified);
  const pending = members.filter((m) => !m.qualified);
  const goldPct = Math.min(100, (qualified.length / GOLD_REQ) * 100);
  const platinumPct = Math.min(100, (qualified.length / PLATINUM_REQ) * 100);

  return (
    <Card className="border-crypto-purple/30 bg-gradient-to-br from-card/80 to-crypto-purple/5 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="h-5 w-5 text-crypto-purple" />
          Staking Referral Team
          <Badge variant="outline" className="ml-auto border-crypto-purple/40 text-crypto-purple">
            {qualified.length} qualified
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress bars */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2 text-foreground">
                <Trophy className="h-4 w-4 text-crypto-gold" /> Gold Stake Unlock
              </span>
              <span className="font-mono text-crypto-gold">
                {Math.min(qualified.length, GOLD_REQ)}/{GOLD_REQ}
              </span>
            </div>
            <Progress value={goldPct} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-yellow-500 [&>div]:to-amber-300" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-cyan-300" /> Platinum Stake Unlock
              </span>
              <span className="font-mono text-cyan-300">
                {Math.min(qualified.length, PLATINUM_REQ)}/{PLATINUM_REQ}
              </span>
            </div>
            <Progress value={platinumPct} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-400" />
          </div>
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
              No referrals yet. Share your code to unlock Gold & Platinum!
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...qualified, ...pending].map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:border-crypto-purple/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.username || m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Deposited ${Number(m.total_deposits).toFixed(2)} • req $50
                    </p>
                  </div>
                  {m.qualified ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Qualified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300 gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          A referral qualifies for staking when their approved deposits total ≥ $50.
        </p>
      </CardContent>
    </Card>
  );
};

export default StakingReferralTeam;
