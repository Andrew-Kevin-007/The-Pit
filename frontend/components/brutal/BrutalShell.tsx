import type { ReactNode } from "react";
import { BrutalNav } from "@/components/brutal/BrutalNav";
import { cn } from "@/lib/utils";

/** Shared page shell: nav + brutalist background. Server-safe — usable from both
 *  server page components and client components like ArenaClient. */
export function BrutalShell({
  matchId,
  children,
  className,
}: {
  matchId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen", className)}>
      <BrutalNav matchId={matchId} />
      {children}
    </main>
  );
}
