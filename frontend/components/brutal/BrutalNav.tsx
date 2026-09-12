"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

/** Brutalist top nav — landing page only. Real routes, not the template's placeholders. */
export function BrutalNav({ matchId }: { matchId: string }) {
  const links = [
    { label: "Arena", href: `/match/${matchId}` },
    { label: "Matches", href: "/matches" },
    { label: "Records", href: "/leaderboard" },
    { label: "Benchmark", href: "/benchmark" },
    { label: "Pitch", href: "/pitch" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="w-full px-4 pt-4 lg:px-6 lg:pt-6"
    >
      <nav className="w-full border border-brutal-fg/20 bg-brutal-bg/80 px-6 py-3 font-brutal-mono backdrop-blur-sm lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs font-bold uppercase tracking-[0.15em] text-brutal-fg">
            The Pit
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease }}
              >
                <Link
                  href={link.href}
                  className="text-xs uppercase tracking-widest text-brutal-fg/60 transition-colors duration-200 hover:text-brutal-fg"
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </nav>
    </motion.div>
  );
}
