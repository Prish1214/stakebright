import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "purple" | "cyan" | "pink" | "gold" | "green";
  animated?: boolean;
  hoverable?: boolean;
  style?: CSSProperties;
}

export const CyberCard = ({ 
  children, 
  className, 
  glowColor = "purple",
  animated = true,
  hoverable = false,
  style 
}: CyberCardProps) => {
  const glowClasses = {
    purple: "hover:neon-glow-purple border-primary/30",
    cyan: "hover:neon-glow-cyan border-secondary/30",
    pink: "hover:neon-glow-pink border-accent/30",
    gold: "hover:neon-glow-gold border-crypto-gold/30",
    green: "border-success/30",
  };

  return (
    <div 
      className={cn(
        "cyber-card rounded-xl p-6 transition-all duration-500",
        glowClasses[glowColor],
        animated && "hover-lift perspective-1000",
        hoverable && "cursor-pointer hover:scale-[1.02] hover:border-primary/50",
        className
      )}
      style={style}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default CyberCard;
