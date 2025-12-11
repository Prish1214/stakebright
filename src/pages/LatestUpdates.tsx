import CyberCard from '@/components/ui/CyberCard';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { Megaphone, Gift, Zap, Star } from 'lucide-react';

const updates = [
  {
    icon: Gift,
    title: "Welcome Bonus",
    description: "New users get priority processing on their first deposit. Join today!",
    color: "gold" as const,
    date: "Active"
  },
  {
    icon: Zap,
    title: "Fast Withdrawals",
    description: "We've upgraded our system for faster withdrawal processing. Most requests now processed within 24 hours.",
    color: "cyan" as const,
    date: "Dec 2024"
  },
  {
    icon: Star,
    title: "Referral Program",
    description: "Earn 5% commission on your referrals' first deposits. Share your referral link and grow your earnings!",
    color: "purple" as const,
    date: "Active"
  },
  {
    icon: Megaphone,
    title: "Platform Updates",
    description: "We continuously improve our platform with new features and security enhancements. Stay tuned for more updates!",
    color: "purple" as const,
    date: "Ongoing"
  }
];

const LatestUpdates = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-mono font-bold gradient-text mb-2">
          Latest Updates & Offers
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Stay informed about the latest news and special offers
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {updates.map((update, index) => (
          <CyberCard key={index} hoverable className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <GlowingIcon icon={update.icon} color={update.color} size="md" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-mono font-semibold text-sm sm:text-base">
                      {update.title}
                    </h3>
                    <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                      {update.date}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {update.description}
                  </p>
                </div>
              </div>
            </div>
          </CyberCard>
        ))}
      </div>
    </div>
  );
};

export default LatestUpdates;
