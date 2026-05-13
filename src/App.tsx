import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Staking from "./pages/Staking";
import Referrals from "./pages/Referrals";
import Mining from "./pages/Mining";
import Trading from "./pages/Trading";
import Withdraw from "./pages/Withdraw";
import VerifyEmail from "./pages/VerifyEmail";
import FAQ from "./pages/FAQ";
import About from "./pages/About";
import LatestUpdates from "./pages/LatestUpdates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/deposit" element={<Layout><Deposit /></Layout>} />
            <Route path="/staking" element={<Layout><Staking /></Layout>} />
            <Route path="/referrals" element={<Layout><Referrals /></Layout>} />
            <Route path="/mining" element={<Layout><Mining /></Layout>} />
            <Route path="/withdraw" element={<Layout><Withdraw /></Layout>} />
            <Route path="/faq" element={<Layout><FAQ /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/latest-updates" element={<Layout><LatestUpdates /></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
