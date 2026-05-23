import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string, referralCode?: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username?: string, referralCode?: string) => {
    try {
      // Validate referral code - it's required
      if (!referralCode) {
        toast({
          title: "Referral code required",
          description: "You must enter a valid referral code to sign up.",
          variant: "destructive"
        });
        return { error: { message: "Referral code required" } };
      }

      // Use secure RPC function to validate referral code (works for anonymous users)
      const { data: isValidCode, error: validationError } = await supabase
        .rpc('validate_referral_code', { code: referralCode });

      if (validationError) {
        toast({
          title: "Validation error",
          description: "There was an error validating the referral code. Please try again.",
          variant: "destructive"
        });
        return { error: validationError };
      }

      if (!isValidCode) {
        toast({
          title: "Invalid referral code",
          description: "The referral code you entered is not valid. Please check and try again.",
          variant: "destructive"
        });
        return { error: { message: "Invalid referral code" } };
      }

      const redirectUrl = `${window.location.origin}/verify`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: username || email.split('@')[0],
            referralCode: referralCode
          }
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account."
      });
      
      return {};
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Best-effort login event log (don't block on failure)
      try {
        let ip: string | null = null;
        try {
          const r = await fetch('https://api.ipify.org?format=json');
          const j = await r.json();
          ip = j?.ip ?? null;
        } catch {}
        await (supabase as any).rpc('log_login_event', { p_ip: ip, p_ua: navigator.userAgent });
      } catch {}

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully."
      });
      
      return {};
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};