import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border/80 bg-card text-card-foreground shadow-[0_1px_0_oklch(1_0_0/0.04)_inset,0_30px_60px_-30px_oklch(0_0_0/0.7)]",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
