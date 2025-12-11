import CyberCard from '@/components/ui/CyberCard';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { Wallet, TrendingUp, Shield, Users, Target, BarChart3 } from 'lucide-react';

const About = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-mono font-bold gradient-text mb-2">
          About Stake Bright
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
          We bridge the gap between stablecoin holders and professional crypto trading
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <CyberCard className="mb-6">
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-mono font-bold text-primary">Our Mission</h2>
            <p className="text-muted-foreground">
              Stake Bright is a cutting-edge staking platform designed to help you maximize your stablecoin returns. 
              Our expert traders manage pooled funds to generate consistent profits while you enjoy passive income.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Your Funds - Your Profits.</strong> We believe in transparency, 
              security, and delivering real value to our community of investors.
            </p>
          </div>
        </CyberCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <CyberCard hoverable className="animate-fade-in-up">
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={Wallet} color="purple" size="md" />
              <h3 className="font-mono font-semibold">Daily Profits</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Earn up to 2.5% daily returns on your staked USDT with our expert trading strategies.
              </p>
            </div>
          </CyberCard>

          <CyberCard hoverable className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={Shield} color="cyan" size="md" />
              <h3 className="font-mono font-semibold">Bank-Grade Security</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Your funds are protected with cold storage, multi-sig wallets, and 24/7 monitoring.
              </p>
            </div>
          </CyberCard>

          <CyberCard hoverable className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={Users} color="gold" size="md" />
              <h3 className="font-mono font-semibold">Referral Rewards</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Earn 5% commission on your referrals' first deposits. Grow your network, grow your earnings.
              </p>
            </div>
          </CyberCard>

          <CyberCard hoverable className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={TrendingUp} color="purple" size="md" />
              <h3 className="font-mono font-semibold">Flexible Plans</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choose from multiple staking durations and return rates that fit your investment goals.
              </p>
            </div>
          </CyberCard>

          <CyberCard hoverable className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={Target} color="cyan" size="md" />
              <h3 className="font-mono font-semibold">Expert Traders</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Our team of professional traders with 7+ years of experience manage your funds.
              </p>
            </div>
          </CyberCard>

          <CyberCard hoverable className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="p-4 sm:p-6 space-y-3">
              <GlowingIcon icon={BarChart3} color="gold" size="md" />
              <h3 className="font-mono font-semibold">94.7% Win Rate</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Our proven trading strategies maintain a consistently high win rate for stable returns.
              </p>
            </div>
          </CyberCard>
        </div>
      </div>
    </div>
  );
};

export default About;
