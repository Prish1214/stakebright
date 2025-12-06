import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "./button";
import { forwardRef } from "react";

interface NeonButtonProps extends ButtonProps {
  glowColor?: "purple" | "cyan" | "pink" | "gold";
  pulse?: boolean;
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, glowColor = "purple", pulse = false, children, ...props }, ref) => {
    const glowClasses = {
      purple: "bg-primary hover:bg-primary/90 neon-glow-purple",
      cyan: "bg-secondary hover:bg-secondary/90 neon-glow-cyan",
      pink: "bg-accent hover:bg-accent/90 neon-glow-pink",
      gold: "bg-crypto-gold hover:bg-crypto-gold/90 neon-glow-gold",
    };

    return (
      <Button
        ref={ref}
        className={cn(
          "font-mono uppercase tracking-wider transition-all duration-300",
          "hover:scale-105 active:scale-95",
          glowClasses[glowColor],
          pulse && "animate-glow-pulse",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

NeonButton.displayName = "NeonButton";

export default NeonButton;
