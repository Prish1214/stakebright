import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Shield, TrendingUp, Mail, Zap, Lock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NeonButton from '@/components/ui/NeonButton';
import GlowingIcon from '@/components/ui/GlowingIcon';
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
  return <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/15 rounded-full blur-3xl animate-float" style={{
        animationDelay: '2s'
      }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl animate-float" style={{
        animationDelay: '4s'
      }} />
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => <div key={i} className="absolute w-1 h-1 bg-primary/50 rounded-full animate-float" style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${4 + Math.random() * 4}s`
      }} />)}
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Branding */}
        <div className="space-y-8 text-center lg:text-left animate-fade-in-up">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-mono font-bold gradient-text tracking-wider">
              STAKE BRIGHT
            </h1>
            <div className="h-1 w-32 bg-neon-gradient mx-auto lg:mx-0 rounded-full" />
            <p className="text-xl text-muted-foreground max-w-md mx-auto lg:mx-0">Secure, high-yield staking platform with competitive returns from Trading Profits and referral rewards.</p>
          </div>
          
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            <div className="space-y-2 text-center group cursor-pointer">
              <GlowingIcon icon={DollarSign} color="gold" className="mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="font-mono text-xs sm:text-sm text-crypto-gold">High Returns</h3>
            </div>
            
            <div className="space-y-2 text-center group cursor-pointer">
              <GlowingIcon icon={Shield} color="cyan" className="mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="font-mono text-xs sm:text-sm text-secondary">Secure</h3>
            </div>
            
            <div className="space-y-2 text-center group cursor-pointer">
              <GlowingIcon icon={TrendingUp} color="purple" className="mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="font-mono text-xs sm:text-sm text-primary">Referral Rewards</h3>
            </div>
          </div>

          {/* Stats Section */}
          <div className="hidden lg:grid grid-cols-3 gap-4 pt-8 border-t border-primary/20">
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-primary neon-text-purple">$2M+</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Staked</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-secondary neon-text-cyan">15K+</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Users</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-crypto-gold neon-text-gold">99.9%</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Uptime</p>
            </div>
          </div>
        </div>

        {/* Right side - Auth forms */}
        <Card className="w-full max-w-md mx-auto cyber-card animate-scale-in" style={{
        animationDelay: '0.2s'
      }}>
          <CardHeader className="text-center">
            <CardTitle className="font-mono text-2xl gradient-text">Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 border border-primary/20">
                <TabsTrigger value="signin" className="font-mono data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="font-mono data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="font-mono text-sm">Email</Label>
                    <Input id="signin-email" name="email" type="email" placeholder="Enter your email" required className="bg-muted/30 border-primary/20 focus:border-primary focus:ring-primary/50" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="font-mono text-sm">Password</Label>
                    <PasswordInput id="signin-password" name="password" placeholder="Enter your password" required className="bg-muted/30 border-primary/20 focus:border-primary focus:ring-primary/50" />
                  </div>
                  
                  <NeonButton type="submit" className="w-full" disabled={loading} pulse>
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
              
              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username" className="font-mono text-sm">Username</Label>
                    <Input id="signup-username" name="username" type="text" placeholder="Choose a username" required className="bg-muted/30 border-primary/20 focus:border-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="font-mono text-sm">Email</Label>
                    <Input id="signup-email" name="email" type="email" placeholder="Enter your email" required className="bg-muted/30 border-primary/20 focus:border-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="font-mono text-sm">Password</Label>
                    <PasswordInput id="signup-password" name="password" placeholder="Create a password" required minLength={6} className="bg-muted/30 border-primary/20 focus:border-primary" />
                    <p className="text-xs text-warning">
                      ⚠️ Password cannot be changed once set
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-referral" className="font-mono text-sm">
                      Referral Code <span className="text-accent">*</span>
                    </Label>
                    <Input id="signup-referral" name="referralCode" type="text" placeholder="Enter referral code (required)" value={referralCode} onChange={e => setReferralCode(e.target.value)} required className="bg-muted/30 border-primary/20 focus:border-primary" />
                  </div>
                  
                  <NeonButton type="submit" className="w-full" disabled={loading} glowColor="cyan">
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
    </div>;
};
export default Auth;