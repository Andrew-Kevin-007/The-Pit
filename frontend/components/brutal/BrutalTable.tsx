import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Plain semantic table, brutalist borders. Replaces the shadcn Table family. */
export function BrutalTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full border-collapse font-brutal-mono text-xs", className)}>{children}</table>
    </div>
  );
}

export function BrutalThead({ children }: { children: ReactNode }) {
  return <thead className="border-b-2 border-brutal-fg">{children}</thead>;
}

export function BrutalTbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function BrutalTr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-brutal-fg/20 last:border-0", className)}>{children}</tr>;
}

export function BrutalTh({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-brutal-fg/60",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function BrutalTd({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2 align-middle", className)} {...props}>
      {children}
    </td>
  );
}
