"use client";

import type { ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Brutalist reskin of the shadcn Accordion — same Radix primitive, same animation keyframes. */
export const BrutalAccordion = AccordionPrimitive.Root;

export function BrutalAccordionItem({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AccordionPrimitive.Item value={value} className={cn("border-b-2 border-brutal-fg", className)}>
      {children}
    </AccordionPrimitive.Item>
  );
}

export function BrutalAccordionTrigger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-center justify-between py-4 font-brutal-mono text-xs uppercase tracking-wider text-brutal-fg transition-colors hover:text-brutal-accent [&[data-state=open]>svg]:rotate-180",
          className,
        )}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function BrutalAccordionContent({ children }: { children: ReactNode }) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
      <div className="pb-4 pt-0 font-brutal-mono text-xs">{children}</div>
    </AccordionPrimitive.Content>
  );
}
