import { NavLink, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { LayoutDashboard, Wallet, TrendingUp, ArrowUpCircle, Users, History, Calculator, Settings, Shield } from 'lucide-react';
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
                      {state !== 'collapsed' && <span className="text-[#fcfcfc]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>;
}