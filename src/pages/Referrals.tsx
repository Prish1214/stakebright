import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Users, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  referral_code: string;
}

interface ReferralEarning {
  id: string;
  amount: number;
  percentage: number;
  created_at: string;
  referred_id: string;
  profiles?: {
    username: string;
  };
}

interface ReferredUser {
  id: string;
  username: string;
  created_at: string;
}

const Referrals = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referralEarnings, setReferralEarnings] = useState<ReferralEarning[]>([]);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile with referral code
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch referral earnings with referred user info
      const { data: earningsData, error: earningsError } = await supabase
        .from('referral_earnings')
        .select(`
          *,
          profiles!referral_earnings_referred_id_fkey (
            username
          )
        `)
        .eq('referrer_id', user?.id)
        .order('created_at', { ascending: false });

      if (earningsError) throw earningsError;
      setReferralEarnings(earningsData || []);
      
      // Fetch all referred users
      const { data: referredData, error: referredError } = await supabase
        .from('profiles')
        .select('user_id, username, created_at')
        .eq('referred_by', user?.id)
        .order('created_at', { ascending: false });

      if (referredError) throw referredError;
      const referredUsersData = referredData?.map(user => ({
        id: user.user_id,
        username: user.username,
        created_at: user.created_at
      })) || [];
      setReferredUsers(referredUsersData);
      
      const total = earningsData?.reduce((sum, earning) => sum + Number(earning.amount), 0) || 0;
      setTotalEarnings(total);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Referral Program</h1>
        <p className="text-muted-foreground mt-2">
          Earn 5% commission on every deposit made by users you refer
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-crypto-purple/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-crypto-purple" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="referral-code">Share this code to earn commissions</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="referral-code"
                  value={profile?.referral_code || ''}
                  readOnly
                  className="flex-1 font-mono text-lg"
                />
                <Button onClick={copyReferralCode} size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Paste this referral code when creating a new account
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-crypto-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-crypto-gold" />
              Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-crypto-gold">
              {totalEarnings.toFixed(2)} USDT
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              From {referralEarnings.length} referral{referralEarnings.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Referred Users</CardTitle>
          </CardHeader>
          <CardContent>
            {referredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No referred users yet</p>
                <p className="text-sm">Share your referral code to start!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {referredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-card/50 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Earnings History</CardTitle>
          </CardHeader>
          <CardContent>
            {referralEarnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No referral earnings yet</p>
                <p className="text-sm">Wait for your referrals to make deposits!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {referralEarnings.map((earning) => (
                  <div
                    key={earning.id}
                    className="flex items-center justify-between p-4 bg-card/50 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-crypto-gold">
                        +{Number(earning.amount).toFixed(2)} USDT
                      </p>
                      <p className="text-sm text-muted-foreground">
                        From {earning.profiles?.username || 'Unknown user'} • {earning.percentage}% commission
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(earning.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-crypto-purple/10 to-crypto-gold/10 border-crypto-purple/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">How the Referral Program Works</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-crypto-purple text-white flex items-center justify-center text-xs font-bold">1</div>
              <p>Share your unique referral code with friends and family</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-crypto-purple text-white flex items-center justify-center text-xs font-bold">2</div>
              <p>When they sign up and make their first deposit, you earn 5% commission</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-crypto-purple text-white flex items-center justify-center text-xs font-bold">3</div>
              <p>Commissions are added to your withdrawable balance immediately</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Referrals;