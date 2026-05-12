import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CyberCard from '@/components/ui/CyberCard';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { Pickaxe, Zap, Award, Flame, Clock, RefreshCw, Server, Activity } from 'lucide-react';

interface MiningStats {
  is_mining: boolean;
  mining_ends_at: string | null;
  mining_streak: number;
  total_mined: number;
  mining_power_multiplier: number;
}

const Mining = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<MiningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    fetchMiningStats();
  }, [user]);

  useEffect(() => {
    if (!stats?.mining_ends_at || !stats?.is_mining) {
      setTimeLeft('00:00:00');
      setIsFinished(false);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(stats.mining_ends_at!).getTime();
      const distance = end - now;

      if (distance <= 0) {
        setTimeLeft('00:00:00');
        setIsFinished(true);
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
        setIsFinished(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [stats]);

  const fetchMiningStats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_mining, mining_ends_at, mining_streak, total_mined, mining_power_multiplier')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      // Use any to bypass TS checks for the dynamically added columns
      setStats(data as any);
    } catch (error: any) {
      toast({
        title: "Error loading mining stats",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startMining = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_cloud_mining');
      if (error) throw error;
      
      toast({
        title: "Mining Started!",
        description: "Your cloud mining rig is now active for 24 hours.",
        variant: "default"
      });
      await fetchMiningStats();
    } catch (error: any) {
      toast({
        title: "Could not start mining",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const claimRewards = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('claim_mining_rewards');
      if (error) throw error;
      
      const res = data as any;
      toast({
        title: "Rewards Claimed!",
        description: `You have successfully claimed ${Number(res.reward_claimed).toFixed(2)} USDT!`,
        variant: "default"
      });
      await fetchMiningStats();
    } catch (error: any) {
      toast({
        title: "Could not claim rewards",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="cyber-card rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-primary/20 rounded w-24 mb-4"></div>
              <div className="h-8 bg-primary/10 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isMiningActive = stats?.is_mining && !isFinished;
  const multiplier = stats?.mining_power_multiplier || 1.0;
  const baseRate = 1.0; // 1 USDT per 24h
  const dailyEarning = baseRate * multiplier;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-mono font-bold gradient-text flex items-center gap-3">
            <Pickaxe className="h-8 w-8 text-primary" />
            Cloud Mining
          </h1>
          <p className="text-muted-foreground mt-1">Rent virtual hashpower to mine daily USDT rewards.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CyberCard glowColor="purple" className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Mined</span>
            <GlowingIcon icon={Zap} size="sm" color="purple" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-primary">
            <AnimatedNumber value={Number(stats?.total_mined || 0)} glowColor="purple" suffix=" USDT" />
          </div>
        </CyberCard>

        <CyberCard glowColor="cyan" className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Mining Power</span>
            <GlowingIcon icon={Server} size="sm" color="cyan" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-secondary">
            {multiplier}x
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on highest active stake</p>
        </CyberCard>

        <CyberCard glowColor="green" className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Daily Rate</span>
            <GlowingIcon icon={Activity} size="sm" color="green" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-success">
            {dailyEarning.toFixed(2)} USDT
          </div>
          <p className="text-xs text-muted-foreground mt-1">Expected 24h reward</p>
        </CyberCard>

        <CyberCard glowColor="gold" className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Mining Streak</span>
            <GlowingIcon icon={Flame} size="sm" color="gold" animated={false} />
          </div>
          <div className="text-2xl font-mono font-bold text-crypto-gold flex items-center gap-2">
            {stats?.mining_streak || 0} Days
          </div>
        </CyberCard>
      </div>

      {/* Main Mining Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        
        {/* Visual Rig Section */}
        <div className="lg:col-span-8">
          <CyberCard glowColor={isMiningActive ? "primary" : "muted"} className="h-full relative overflow-hidden flex flex-col items-center justify-center p-12">
            {/* Background effects */}
            {isMiningActive && (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
              </>
            )}

            <div className="relative z-10 text-center flex flex-col items-center">
              <div className={`relative mb-8 transition-transform duration-700 ${isMiningActive ? 'scale-110' : 'scale-100'}`}>
                {/* Outer rotating ring */}
                <div className={`absolute inset-0 rounded-full border-4 border-dashed border-primary/30 ${isMiningActive ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                {/* Inner rotating ring */}
                <div className={`absolute inset-2 rounded-full border-4 border-dotted border-secondary/40 ${isMiningActive ? 'animate-[spin_3s_linear_infinite_reverse]' : ''}`} />
                
                {/* Core Icon */}
                <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-background border border-primary/20 ${isMiningActive ? 'shadow-[0_0_40px_rgba(var(--primary),0.4)]' : ''}`}>
                  <Server className={`w-16 h-16 ${isMiningActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                </div>
              </div>

              {stats?.is_mining ? (
                isFinished ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-mono font-bold text-success">Mining Cycle Complete!</h2>
                    <p className="text-muted-foreground">Claim your rewards to start a new cycle.</p>
                    <NeonButton 
                      onClick={claimRewards} 
                      disabled={actionLoading}
                      glowColor="green"
                      className="px-8 py-6 text-lg"
                    >
                      {actionLoading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Award className="mr-2 h-5 w-5" />}
                      Claim {dailyEarning.toFixed(2)} USDT
                    </NeonButton>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-xl font-mono font-bold text-primary flex items-center justify-center gap-2">
                      <Activity className="h-5 w-5 animate-pulse" />
                      Mining Active
                    </h2>
                    <div className="font-mono text-4xl font-bold tracking-wider text-white">
                      {timeLeft}
                    </div>
                    <p className="text-muted-foreground">Until next reward</p>
                    <div className="w-full max-w-xs mx-auto bg-muted/30 h-2 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-primary animate-[pulse_2s_ease-in-out_infinite] w-full" style={{
                        transformOrigin: 'left',
                        animation: 'progress 24s linear infinite'
                      }}></div>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <h2 className="text-2xl font-mono font-bold">Rig Standby</h2>
                  <p className="text-muted-foreground max-w-md text-center">Activate your cloud mining rig to start generating USDT. Mining requires an active staking plan.</p>
                  <NeonButton 
                    onClick={startMining} 
                    disabled={actionLoading}
                    className="px-8 py-6 text-lg mt-4"
                  >
                    {actionLoading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Pickaxe className="mr-2 h-5 w-5" />}
                    Start Mining (24h)
                  </NeonButton>
                </div>
              )}
            </div>
          </CyberCard>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <CyberCard glowColor="cyan">
            <h3 className="font-mono font-bold text-lg mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              Power Tiers
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-muted/50 bg-background/50 flex justify-between items-center">
                <span className="text-sm font-semibold">Standard</span>
                <span className="font-mono text-cyan-400 font-bold">1.0x</span>
              </div>
              <div className="p-3 rounded-lg border border-crypto-gold/30 bg-crypto-gold/5 flex justify-between items-center">
                <span className="text-sm font-semibold text-crypto-gold">Gold Plan</span>
                <span className="font-mono text-crypto-gold font-bold">1.5x</span>
              </div>
              <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 flex justify-between items-center">
                <span className="text-sm font-semibold text-purple-400">Platinum Plan</span>
                <span className="font-mono text-purple-400 font-bold">2.0x</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Your mining power is automatically determined by your highest active staking plan. Higher tiers yield greater daily USDT rewards.
            </p>
          </CyberCard>

          <CyberCard glowColor="pink">
            <h3 className="font-mono font-bold text-lg mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-pink-400" />
              How it works
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="min-w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5" />
                <p>Click "Start Mining" to allocate virtual hashpower for 24 hours.</p>
              </li>
              <li className="flex items-start gap-2">
                <div className="min-w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5" />
                <p>Return after the countdown to claim your daily USDT rewards.</p>
              </li>
              <li className="flex items-start gap-2">
                <div className="min-w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5" />
                <p>Claim consecutively within 48 hours to build your mining streak!</p>
              </li>
            </ul>
          </CyberCard>
        </div>
      </div>
    </div>
  );
};

export default Mining;
