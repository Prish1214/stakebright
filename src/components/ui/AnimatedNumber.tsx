import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  glowColor?: "purple" | "cyan" | "pink" | "gold" | "green";
}

export const AnimatedNumber = ({
  value,
  duration = 1000,
  decimals = 2,
  suffix = "",
  className,
  glowColor = "purple",
}: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const current = startValue + (endValue - startValue) * easeOutQuart;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const glowClasses = {
    purple: "neon-text-purple",
    cyan: "neon-text-cyan",
    pink: "text-accent",
    gold: "neon-text-gold",
    green: "text-success",
  };

  return (
    <span className={cn("font-mono", glowClasses[glowColor], className)}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

export default AnimatedNumber;
