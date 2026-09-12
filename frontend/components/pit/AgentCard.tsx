import { BrutalCard } from "@/components/brutal/BrutalCard";
import { cn } from "@/lib/utils";

const ACCENT = { left: "text-emerald-500", right: "text-red-500" } as const;
const BORDER = { left: "border-emerald-500/40", right: "border-red-500/40" } as const;

/** Fighter identity card — handle, accent color, optional stat row. */
export function AgentCard({
  handle,
  side,
  statLine,
}: {
  handle: string;
  side: "left" | "right";
  statLine?: string;
}) {
  return (
    <BrutalCard className={cn(BORDER[side], side === "right" && "text-right")}>
      <div className="p-4">
        <div className={cn("font-brutal-mono text-base font-medium", ACCENT[side])}>{handle}</div>
        {statLine && <div className="mt-0.5 text-xs text-brutal-fg/50">{statLine}</div>}
      </div>
    </BrutalCard>
  );
}
