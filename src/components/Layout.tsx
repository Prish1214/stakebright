import { Navigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CryptoProfitsTicker from '@/components/CryptoProfitsTicker';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col pt-10">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>

        {/* Floating action buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform"
            asChild
          >
            <a href="https://t.me/StakeBright" target="_blank" rel="noopener noreferrer">
              <Send className="h-5 w-5" />
            </a>
          </Button>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform"
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