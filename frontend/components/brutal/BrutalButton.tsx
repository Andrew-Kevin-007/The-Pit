import type { ReactNode, MouseEventHandler } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center justify-center gap-2 border-2 border-brutal-fg px-4 py-2 font-brutal-mono text-xs uppercase tracking-wider transition-colors disabled:cursor-default disabled:opacity-50";

const VARIANT = {
  solid: "bg-brutal-fg text-brutal-bg hover:bg-brutal-fg/90",
  outline: "bg-transparent text-brutal-fg hover:bg-brutal-fg hover:text-brutal-bg",
} as const;

interface CommonProps {
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}

/** Square secondary-action button/link. Replaces shadcn Button (outline variant of choice). */
export function BrutalButton(
  props: CommonProps &
    (
      | { href: string; target?: string; rel?: string; onClick?: never; disabled?: never; type?: never }
      | {
          href?: undefined;
          onClick?: MouseEventHandler<HTMLButtonElement>;
          disabled?: boolean;
          type?: "button" | "submit";
        }
    ),
) {
  const { children, variant = "outline", className } = props;
  const classes = cn(BASE, VARIANT[variant], className);

  if (props.href) {
    return (
      <Link href={props.href} target={props.target} rel={props.rel} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled} className={classes}>
      {children}
    </button>
  );
}
