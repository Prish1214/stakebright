import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Shield, TrendingUp, Mail, Zap, Lock, Users, Target, Headphones, BarChart3, Wallet, ArrowRight, CheckCircle2, MessageCircle, ChevronDown, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
import CyberCard from '@/components/ui/CyberCard';
const Auth = () => {
  const {
    user,
    signIn,
    signUp
  } = useAuth();
  const {
    toast
  } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  if (showVerificationMessage) {
    return <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{
          animationDelay: '2s'
        }} />
        </div>
        
        <Card className="w-full max-w-md cyber-card animate-scale-in">
          <CardHeader className="space-y-1 text-center">
            <GlowingIcon icon={Mail} color="cyan" size="lg" className="mx-auto mb-4" />
            <CardTitle className="text-2xl font-mono gradient-text">Check Your Email</CardTitle>
            <CardDescription>We've sent a verification link to</CardDescription>
            <p className="font-mono text-primary neon-text-purple">{userEmail}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg space-y-3 border border-primary/20">
              <p className="text-sm font-medium font-mono">Next steps:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Click the verification link sent to your email</li>
                <li>After verification, return to this page</li>
                <li>Login with your email and password</li>
              </ol>
            </div>
            <NeonButton onClick={() => setShowVerificationMessage(false)} className="w-full" variant="outline" glowColor="cyan">
              Back to Login
            </NeonButton>
          </CardContent>
        </Card>
      </div>;
  }
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    await signIn(email, password);
    setLoading(false);
  };
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const referralCode = formData.get('referralCode') as string;
    const {
      error
    } = await signUp(email, password, username, referralCode);
    setLoading(false);
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive"
      });
    } else {
      setUserEmail(email);
      setShowVerificationMessage(true);
    }
  };
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const partners = [{
    name: 'Ethereum',
    symbol: 'ETH'
  }, {
    name: 'Binance',
    symbol: 'BNB'
  }, {
    name: 'Polygon',
    symbol: 'MATIC'
  }, {
    name: 'Arbitrum',
    symbol: 'ARB'
  }, {
    name: 'Tether',
    symbol: 'USDT'
  }, {
    name: 'USD Coin',
    symbol: 'USDC'
  }];
  const tradingStats = [{
    label: 'Win Rate',
    value: '94.7%',
    color: 'text-crypto-green'
  }, {
    label: 'Avg. Monthly Return',
    value: '18.5%',
    color: 'text-crypto-gold'
  }, {
    label: 'Total Trades',
    value: '125K+',
    color: 'text-secondary'
  }, {
    label: 'Years Experience',
    value: '7+',
    color: 'text-primary'
  }];
  return <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-5 sm:left-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-5 sm:right-10 w-64 sm:w-96 h-64 sm:h-96 bg-secondary/15 rounded-full blur-3xl animate-float" style={{
        animationDelay: '2s'
      }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[400px] md:w-[600px] h-[300px] sm:h-[400px] md:h-[600px] bg-accent/10 rounded-full blur-3xl animate-float" style={{
        animationDelay: '4s'
      }} />
        {[...Array(15)].map((_, i) => <div key={i} className="absolute w-1 h-1 bg-primary/50 rounded-full animate-float hidden sm:block" style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${4 + Math.random() * 4}s`
      }} />)}
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neon-gradient flex items-center justify-center">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-background" />
            </div>
            <span className="font-mono text-base sm:text-xl font-bold gradient-text">STAKE BRIGHT</span>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <button onClick={() => scrollToSection('about')} className="text-muted-foreground hover:text-primary transition-colors font-mono text-sm">About</button>
            <button onClick={() => scrollToSection('performance')} className="text-muted-foreground hover:text-primary transition-colors font-mono text-sm">Performance</button>
            <button onClick={() => scrollToSection('partners')} className="text-muted-foreground hover:text-primary transition-colors font-mono text-sm">Partners</button>
            <button onClick={() => scrollToSection('helpdesk')} className="text-muted-foreground hover:text-primary transition-colors font-mono text-sm">Support</button>
          </div>
          <NeonButton onClick={() => scrollToSection('auth')} size="sm" className="text-xs sm:text-sm px-3 sm:px-4">
            Get Started
          </NeonButton>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-3 sm:px-4 pt-16 sm:pt-20 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left - Branding */}
          <div className="space-y-6 sm:space-y-8 text-center lg:text-left animate-fade-in-up order-2 lg:order-1">
            <div className="space-y-4 sm:space-y-6">
              <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
                <span className="text-xs sm:text-sm font-mono text-primary">🚀 Trusted by 10,000+ Investors</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-mono font-bold leading-tight">
                <span className="gradient-text">Your Funds</span>
                <br />
                <span className="text-foreground">Your Profits</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Stake your stablecoins and let our expert traders generate consistent profits for you. 
                Secure, transparent, and highly rewarding.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <NeonButton onClick={() => scrollToSection('auth')} size="lg" pulse className="group text-sm sm:text-base">
                Start Earning Now
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
              </NeonButton>
              <NeonButton onClick={() => scrollToSection('about')} variant="outline" size="lg" glowColor="cyan" className="text-sm sm:text-base">
                Learn More
              </NeonButton>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-6 sm:pt-8 border-t border-primary/20">
              <div className="text-center lg:text-left">
                <p className="text-lg sm:text-2xl md:text-3xl font-mono font-bold text-primary neon-text-purple">$2.5M+</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Total Staked</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-lg sm:text-2xl md:text-3xl font-mono font-bold text-secondary neon-text-cyan">$890K+</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Profits Paid</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-lg sm:text-2xl md:text-3xl font-mono font-bold text-crypto-gold neon-text-gold">96%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Uptime</p>
              </div>
            </div>
          </div>

          {/* Right - Auth Form */}
          <div id="auth" className="scroll-mt-20 sm:scroll-mt-24 order-1 lg:order-2">
            <Card className="w-full max-w-sm sm:max-w-md mx-auto cyber-card animate-scale-in" style={{
            animationDelay: '0.2s'
          }}>
              <CardHeader className="text-center p-4 sm:p-6">
                <CardTitle className="font-mono text-xl sm:text-2xl gradient-text">Join Now</CardTitle>
                <CardDescription className="text-sm">Start earning passive income today</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <Tabs defaultValue="signup" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/30 border border-primary/20">
                    <TabsTrigger value="signin" className="font-mono text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="font-mono text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                    <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signin-email" className="font-mono text-xs sm:text-sm">Email</Label>
                        <Input id="signin-email" name="email" type="email" placeholder="Enter your email" required className="bg-muted/30 border-primary/20 focus:border-primary focus:ring-primary/50 text-sm h-9 sm:h-10" />
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signin-password" className="font-mono text-xs sm:text-sm">Password</Label>
                        <PasswordInput id="signin-password" name="password" placeholder="Enter your password" required className="bg-muted/30 border-primary/20 focus:border-primary focus:ring-primary/50 text-sm h-9 sm:h-10" />
                      </div>
                      
                      <NeonButton type="submit" className="w-full text-sm" disabled={loading} pulse>
                        {loading ? <span className="flex items-center gap-2">
                            <Zap className="h-4 w-4 animate-pulse" />
                            Connecting...
                          </span> : <span className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Sign In
                          </span>}
                      </NeonButton>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                    <form onSubmit={handleSignUp} className="space-y-3 sm:space-y-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-username" className="font-mono text-xs sm:text-sm">Username</Label>
                        <Input id="signup-username" name="username" type="text" placeholder="Choose a username" required className="bg-muted/30 border-primary/20 focus:border-primary text-sm h-9 sm:h-10" />
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-email" className="font-mono text-xs sm:text-sm">Email</Label>
                        <Input id="signup-email" name="email" type="email" placeholder="Enter your email" required className="bg-muted/30 border-primary/20 focus:border-primary text-sm h-9 sm:h-10" />
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-password" className="font-mono text-xs sm:text-sm">Password</Label>
                        <PasswordInput id="signup-password" name="password" placeholder="Create a password" required minLength={6} className="bg-muted/30 border-primary/20 focus:border-primary text-sm h-9 sm:h-10" />
                        <p className="text-[10px] sm:text-xs text-warning">⚠️ Password cannot be changed once set</p>
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-referral" className="font-mono text-xs sm:text-sm">
                          Referral Code <span className="text-accent">*</span>
                        </Label>
                        <Input id="signup-referral" name="referralCode" type="text" placeholder="Enter referral code (required)" value={referralCode} onChange={e => setReferralCode(e.target.value)} required className="bg-muted/30 border-primary/20 focus:border-primary text-sm h-9 sm:h-10" />
                      </div>
                      
                      <NeonButton type="submit" className="w-full text-sm" disabled={loading} glowColor="cyan">
                        {loading ? <span className="flex items-center gap-2">
                            <Zap className="h-4 w-4 animate-pulse" />
                            Creating...
                          </span> : <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Create Account
                          </span>}
                      </NeonButton>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scroll Indicator - Hidden on mobile */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
          <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8 text-primary/50" />
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold gradient-text mb-3 sm:mb-4">About Stake Bright</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg px-2">
              We bridge the gap between stablecoin holders and professional crypto trading
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.1s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={Wallet} color="purple" size="md" className="sm:hidden" />
                <GlowingIcon icon={Wallet} color="purple" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Stake Your Stablecoins</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Deposit USDT, USDC, or other stablecoins. Your funds remain secure while our experts 
                  put them to work in the crypto markets.
                </p>
              </div>
            </CyberCard>

            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.2s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={BarChart3} color="cyan" size="md" className="sm:hidden" />
                <GlowingIcon icon={BarChart3} color="cyan" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Expert Trading</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Our team of seasoned traders with 7+ years of experience execute strategic trades 
                  across multiple exchanges and markets.
                </p>
              </div>
            </CyberCard>

            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.3s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={TrendingUp} color="gold" size="md" className="sm:hidden" />
                <GlowingIcon icon={TrendingUp} color="gold" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Earn Daily Profits</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Receive daily returns on your staked amount. Watch your investment grow with 
                  consistent, transparent profit distributions.
                </p>
              </div>
            </CyberCard>

            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.4s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={Shield} color="cyan" size="md" className="sm:hidden" />
                <GlowingIcon icon={Shield} color="cyan" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Secure & Transparent</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Your funds are protected with industry-leading security measures. Track every 
                  transaction and earning in real-time.
                </p>
              </div>
            </CyberCard>

            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.5s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={Users} color="purple" size="md" className="sm:hidden" />
                <GlowingIcon icon={Users} color="purple" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Referral Rewards</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Earn 5% commission on every deposit made by users you refer. Build your network 
                  and maximize your passive income.
                </p>
              </div>
            </CyberCard>

            <CyberCard hoverable className="animate-fade-in-up" style={{
            animationDelay: '0.6s'
          }}>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                <GlowingIcon icon={Target} color="gold" size="md" className="sm:hidden" />
                <GlowingIcon icon={Target} color="gold" size="lg" className="hidden sm:flex" />
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold">Flexible Plans</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Choose from multiple staking plans tailored to your investment goals. Higher 
                  stakes unlock premium return rates.
                </p>
              </div>
            </CyberCard>
          </div>
        </div>
      </section>

      {/* Trading Performance Section */}
      <section id="performance" className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative z-10 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold gradient-text mb-3 sm:mb-4">Trading Performance</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg px-2">
              Our expert traders consistently deliver outstanding results
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12 md:mb-16">
            {tradingStats.map((stat, index) => <CyberCard key={stat.label} className="animate-fade-in-up" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className="p-3 sm:p-4 md:p-6 text-center">
                  <p className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-mono font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{stat.label}</p>
                </div>
              </CyberCard>)}
          </div>

          <CyberCard glowColor="cyan" className="animate-fade-in-up">
            <div className="p-4 sm:p-6 md:p-8">
              <h3 className="text-lg sm:text-xl md:text-2xl font-mono font-bold mb-4 sm:mb-6 text-center gradient-text">Why Trade With Us?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {['Algorithmic trading strategies backed by AI', 'Risk management with strict stop-loss protocols', '24/7 market monitoring across all major exchanges', 'Diversified portfolio across 50+ trading pairs', 'Real-time profit distribution system', 'Transparent performance reporting'].map((item, i) => <div key={i} className="flex items-start sm:items-center gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-crypto-green flex-shrink-0 mt-0.5 sm:mt-0" />
                    <span className="text-muted-foreground text-sm sm:text-base">{item}</span>
                  </div>)}
              </div>
            </div>
          </CyberCard>
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold gradient-text mb-3 sm:mb-4">Blockchain Partners</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg px-2">
              We operate across multiple blockchain networks for maximum flexibility
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
            {partners.map((partner, index) => <CyberCard key={partner.name} hoverable className="animate-fade-in-up group cursor-pointer" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className="p-3 sm:p-4 md:p-6 text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 mx-auto mb-2 sm:mb-3 md:mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 group-hover:scale-110 transition-transform flex-row flex items-center justify-center">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
                  </div>
                  <h4 className="font-mono font-semibold text-xs sm:text-sm md:text-base">{partner.name}</h4>
                  <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{partner.symbol}</p>
                </div>
              </CyberCard>)}
          </div>

          <div className="mt-8 sm:mt-12 md:mt-16 text-center">
            <CyberCard glowColor="purple" className="inline-block animate-fade-in-up">
              <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6">
                <p className="text-sm sm:text-base md:text-lg font-mono">
                  <span className="text-muted-foreground">Primary Network:</span>{' '}
                  <span className="gradient-text font-bold">Binance Smart Chain (BEP-20)</span>
                </p>
              </div>
            </CyberCard>
          </div>
        </div>
      </section>

      {/* Helpdesk Section */}
      <section id="helpdesk" className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative z-10 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold gradient-text mb-3 sm:mb-4">24/7 Support</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg px-2">
              Our dedicated support team is always here to help you
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto">
            <CyberCard hoverable glowColor="cyan" className="animate-fade-in-up">
              <a href="https://t.me/StakeBright" target="_blank" rel="noopener noreferrer" className="block p-4 sm:p-6 md:p-8 text-center group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-3 sm:mb-4 md:mb-6 rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 flex items-center justify-center border border-secondary/50 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-secondary" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold mb-1 sm:mb-2">Telegram Support</h3>
                <p className="text-muted-foreground text-sm mb-2 sm:mb-4">Get instant responses from our support team</p>
                <span className="text-secondary font-mono text-sm sm:text-base">@StakeBright →</span>
              </a>
            </CyberCard>

            <CyberCard hoverable glowColor="purple" className="animate-fade-in-up" style={{
            animationDelay: '0.1s'
          }}>
              <a href="mailto:stakebright@proton.me" className="block p-4 sm:p-6 md:p-8 text-center group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-3 sm:mb-4 md:mb-6 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center border border-primary/50 group-hover:scale-110 transition-transform">
                  <Headphones className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-semibold mb-1 sm:mb-2">Email Support</h3>
                <p className="text-muted-foreground text-sm mb-2 sm:mb-4">Detailed inquiries and documentation</p>
                <span className="text-primary font-mono text-sm sm:text-base">stakebright@proton.me →</span>
              </a>
            </CyberCard>
          </div>

          <div className="mt-8 sm:mt-12 md:mt-16">
            <CyberCard className="animate-fade-in-up">
              <div className="p-4 sm:p-6 md:p-8">
                <h3 className="text-base sm:text-lg md:text-xl font-mono font-bold mb-4 sm:mb-6 text-center">Frequently Asked Questions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1 sm:space-y-2">
                    <h4 className="font-mono text-primary text-sm sm:text-base">How do I start staking?</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Simply create an account, deposit your stablecoins, and choose a staking plan that fits your goals.
                    </p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <h4 className="font-mono text-primary text-sm sm:text-base">When do I receive profits?</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Profits are calculated and added to your account daily based on your active staking plans.
                    </p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <h4 className="font-mono text-primary text-sm sm:text-base">Is my investment safe?</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      We employ multiple security measures including cold storage and strict risk management protocols.
                    </p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <h4 className="font-mono text-primary text-sm sm:text-base">How do withdrawals work?</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Request a withdrawal anytime. Earnings are processed within 24-48 hours after admin approval.
                    </p>
                  </div>
                </div>
              </div>
            </CyberCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <CyberCard glowColor="purple" className="animate-fade-in-up">
            <div className="p-6 sm:p-8 md:p-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold gradient-text mb-3 sm:mb-4">
                Ready to Start Earning?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto">
                Join thousands of investors who trust Stake Bright with their stablecoins. 
                Your journey to passive crypto income starts here.
              </p>
              <NeonButton onClick={() => scrollToSection('auth')} size="lg" pulse className="group text-sm sm:text-base">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
              </NeonButton>
            </div>
          </CyberCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-10 md:py-12 px-3 sm:px-4 border-t border-primary/20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-neon-gradient flex items-center justify-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-background" />
              </div>
              <span className="font-mono font-bold gradient-text text-sm sm:text-base">STAKE BRIGHT</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center order-3 sm:order-2">
              © 2024 Stake Bright. Your Funds - Your Profits.
            </p>
            <div className="flex items-center gap-4 order-2 sm:order-3">
              <a href="https://t.me/StakeBright" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-secondary transition-colors">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a href="mailto:stakebright@proton.me" className="text-muted-foreground hover:text-primary transition-colors">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>;
};
export default Auth;