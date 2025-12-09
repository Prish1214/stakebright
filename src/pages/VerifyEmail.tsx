import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CyberCard } from '@/components/ui/CyberCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { CheckCircle2, Loader2, XCircle, Shield } from 'lucide-react';

const VerifyEmail = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Check for hash fragments (Supabase uses hash-based tokens)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (type === 'signup' || type === 'email_change' || type === 'recovery') {
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              setStatus('error');
              setErrorMessage(error.message);
              return;
            }

            // Sign out after verification so user can log in fresh
            await supabase.auth.signOut();
            setStatus('success');
          } else {
            // Check URL params for token_hash (alternative flow)
            const tokenHash = searchParams.get('token_hash');
            const verifyType = searchParams.get('type');

            if (tokenHash && verifyType) {
              const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: verifyType as any,
              });

              if (error) {
                setStatus('error');
                setErrorMessage(error.message);
                return;
              }

              await supabase.auth.signOut();
              setStatus('success');
            } else {
              // No tokens found, check if already verified
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                await supabase.auth.signOut();
                setStatus('success');
              } else {
                setStatus('error');
                setErrorMessage('Invalid or expired verification link');
              }
            }
          }
        } else if (accessToken) {
          // Direct token verification
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
            return;
          }

          await supabase.auth.signOut();
          setStatus('success');
        } else {
          // Fallback: check for existing session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setStatus('success');
          } else {
            setStatus('error');
            setErrorMessage('No verification token found');
          }
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Verification failed');
      }
    };

    // Small delay to ensure hash is available
    setTimeout(handleVerification, 500);
  }, [searchParams]);

  const handleLoginClick = () => {
    navigate('/auth?tab=signin');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-72 h-48 sm:h-72 bg-secondary/30 rounded-full blur-2xl animate-float" />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/60 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <CyberCard className="p-8 sm:p-12 text-center">
          {status === 'loading' && (
            <div className="space-y-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Verifying Your Email
                </h1>
                <p className="text-muted-foreground">
                  Please wait while we confirm your account...
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-8">
              {/* Success Icon with Glow */}
              <div className="relative inline-block">
                <div className="w-28 h-28 rounded-full bg-green-500/20 flex items-center justify-center relative">
                  <CheckCircle2 className="w-16 h-16 text-green-400 animate-bounce-slow" />
                  <div className="absolute inset-0 rounded-full border-2 border-green-400/50 animate-pulse" />
                  <div className="absolute inset-0 rounded-full bg-green-400/20 blur-xl animate-pulse" />
                </div>
                {/* Shield Icon */}
                <div className="absolute -right-2 -top-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-400 via-primary to-green-400 bg-clip-text text-transparent animate-gradient">
                  YOU ARE VERIFIED!
                </h1>
                <p className="text-lg text-muted-foreground">
                  Your email has been successfully verified.
                </p>
                <p className="text-sm text-muted-foreground/80">
                  Welcome to USDT Stake! You can now log in and start earning.
                </p>
              </div>

              {/* Decorative Line */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

              {/* Login Button */}
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Go back to login page to access your account
                </p>
                <NeonButton
                  onClick={handleLoginClick}
                  className="w-full py-4 text-lg font-semibold"
                  glowColor="cyan"
                >
                  Login Now
                </NeonButton>
              </div>

              {/* Confetti-like particles animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-confetti"
                    style={{
                      left: `${10 + (i * 7)}%`,
                      backgroundColor: i % 3 === 0 ? 'hsl(var(--primary))' : i % 3 === 1 ? 'hsl(142 76% 36%)' : 'hsl(var(--accent))',
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="w-14 h-14 text-destructive" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-destructive/30 animate-pulse" />
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Verification Failed
                </h1>
                <p className="text-muted-foreground">
                  {errorMessage || 'Something went wrong during verification.'}
                </p>
              </div>

              <NeonButton
                onClick={handleLoginClick}
                variant="secondary"
                className="w-full"
              >
                Back to Login
              </NeonButton>
            </div>
          )}
        </CyberCard>
      </div>
    </div>
  );
};

export default VerifyEmail;