import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Square tag/pill, per the template's pricing-section idiom. Replaces shadcn Badge. */
export function BrutalBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-brutal-accent px-2 py-0.5 font-brutal-mono text-[9px] uppercase tracking-[0.15em] text-brutal-bg",
        className,
      )}
    >
      {children}
    </span>
  );
}
