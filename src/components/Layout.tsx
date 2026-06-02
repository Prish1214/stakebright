import { Navigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CryptoProfitsTicker from '@/components/CryptoProfitsTicker';
import { FrozenBanner } from '@/components/FrozenBanner';
import { AnnouncementsBanner } from '@/components/AnnouncementsBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto neon-glow-purple"></div>
          <p className="text-muted-foreground font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <CryptoProfitsTicker />
      <div className="min-h-screen flex w-full bg-background grid-bg">
        <AppSidebar />
        <div className="flex-1 flex flex-col pt-10">
          <FrozenBanner />
          <Header />
          <AnnouncementsBanner />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>

        {/* Floating action buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform neon-glow-cyan bg-secondary hover:bg-secondary/90"
            asChild
          >
            <a href="https://t.me/StakeBright" target="_blank" rel="noopener noreferrer">
              <Send className="h-5 w-5" />
            </a>
          </Button>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform neon-glow-purple"
            asChild
          >
            <a href="mailto:stakebright@proton.me">
              <Mail className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </SidebarProvider>
  );
};
