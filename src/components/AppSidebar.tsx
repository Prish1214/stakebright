import { NavLink, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { LayoutDashboard, Wallet, TrendingUp, ArrowUpCircle, Users, Settings, Shield, HelpCircle, CheckCircle, BarChart3, Info, Megaphone, ExternalLink, Pickaxe, LineChart } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const menuItems = [{
  title: 'Dashboard',
  url: '/dashboard',
  icon: LayoutDashboard
}, {
  title: 'Deposit',
  url: '/deposit',
  icon: Wallet
}, {
  title: 'Staking',
  url: '/staking',
  icon: TrendingUp
}, {
  title: 'Withdraw',
  url: '/withdraw',
  icon: ArrowUpCircle
}, {
  title: 'Referrals',
  url: '/referrals',
  icon: Users
}, {
  title: 'Cloud Mining',
  url: '/mining',
  icon: Pickaxe
}, {
  title: 'AI Trading',
  url: '/trading',
  icon: LineChart
}];

const proofItems = [{
  title: 'FAQ',
  url: '/faq',
  icon: HelpCircle,
  external: false
}, {
  title: 'Withdraw Proof',
  url: 'https://t.me/+0Jj0_GyXh5RlMGJl',
  icon: CheckCircle,
  external: true
}, {
  title: 'About',
  url: '/about',
  icon: Info,
  external: false
}];

const adminItems = [{
  title: 'Admin Panel',
  url: '/admin',
  icon: Shield
}, {
  title: 'Settings',
  url: '/admin/settings',
  icon: Settings
}];
export function AppSidebar() {
  const {
    state,
    setOpenMobile
  } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useIsAdmin();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({
    isActive
  }: {
    isActive: boolean;
  }) => isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50";
  const handleMenuClick = () => {
    setOpenMobile(false);
  };
  return <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            {state !== 'collapsed' && <div>
                <h2 className="font-bold text-lg">USDT Stake</h2>
                <p className="text-xs text-muted-foreground">Staking Platform</p>
              </div>}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls} onClick={handleMenuClick}>
                      <item.icon className="w-4 h-4 mr-2" />
                      {state !== 'collapsed' && <span className="text-sidebar-foreground">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Proof of Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {proofItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.external ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:bg-accent/50 flex items-center" onClick={handleMenuClick}>
                        <item.icon className="w-4 h-4 mr-2" />
                        {state !== 'collapsed' && (
                          <>
                            <span className="text-sidebar-foreground">{item.title}</span>
                            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                          </>
                        )}
                      </a>
                    ) : (
                      <NavLink to={item.url} className={getNavCls} onClick={handleMenuClick}>
                        <item.icon className="w-4 h-4 mr-2" />
                        {state !== 'collapsed' && <span className="text-sidebar-foreground">{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/latest-updates" className={getNavCls} onClick={handleMenuClick}>
                    <Megaphone className="w-4 h-4 mr-2" />
                    {state !== 'collapsed' && <span className="text-sidebar-foreground">Latest Updates/Offers</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" className={getNavCls} onClick={handleMenuClick}>
                      <Shield className="w-4 h-4 mr-2" />
                      {state !== 'collapsed' && <span className="text-sidebar-foreground">Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
    </Sidebar>;
}