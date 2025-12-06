import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GlowingIconProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  color?: "purple" | "cyan" | "pink" | "gold" | "green";
  className?: string;
  animated?: boolean;
}

export const GlowingIcon = ({ 
  icon: Icon, 
  size = "md", 
  color = "purple",
  className,
  animated = true 
}: GlowingIconProps) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const colorClasses = {
    purple: "bg-primary/20 text-primary neon-glow-purple",
    cyan: "bg-secondary/20 text-secondary neon-glow-cyan",
    pink: "bg-accent/20 text-accent neon-glow-pink",
    gold: "bg-crypto-gold/20 text-crypto-gold neon-glow-gold",
    green: "bg-success/20 text-success",
  };

  return (
    <div 
      className={cn(
        "rounded-xl flex items-center justify-center",
        sizeClasses[size],
        colorClasses[color],
        animated && "animate-float",
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </div>
  );
};

export default GlowingIcon;
