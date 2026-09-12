import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Square-cornered bordered panel. Replaces shadcn Card/CardContent. */
export function BrutalCard({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight";
}) {
  return (
    <div
      className={cn(
        "border-2 border-brutal-fg",
        variant === "highlight" ? "bg-brutal-fg text-brutal-bg" : "bg-brutal-bg text-brutal-fg",
        className,
      )}
    >
      {children}
    </div>
  );
}
