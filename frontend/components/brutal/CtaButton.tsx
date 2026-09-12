"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/** The template's two-part black/orange CTA pill. Client-only (Framer Motion hover/tap). */
export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
      <Link
        href={href}
        className="group flex items-center gap-0 font-brutal-mono text-sm uppercase tracking-wider text-brutal-bg"
      >
        <span className="flex h-10 w-10 items-center justify-center bg-brutal-accent">
          <motion.span
            className="inline-flex"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <ArrowRight size={16} strokeWidth={2} className="text-brutal-bg" />
          </motion.span>
        </span>
        <span className="bg-brutal-fg px-5 py-2.5">{label}</span>
      </Link>
    </motion.div>
  );
}
