import { NavLink, useLocation } from 'react-router-dom';
import { Coins, Pickaxe, LineChart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/staking', label: 'Staking', icon: Coins },
  { to: '/mining', label: 'Mining', icon: Pickaxe },
  { to: '/trading', label: 'Trading', icon: LineChart },
  { to: '/profile', label: 'Profile', icon: User },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4 max-w-2xl mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors relative',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
                )}
                <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
