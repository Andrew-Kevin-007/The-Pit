import Link from "next/link";

const STEPS = [
  { label: "Intro", href: "/pitch" },
  { label: "Problem", href: "/pitch/problem" },
  { label: "Solution", href: "/pitch/solution" },
  { label: "How it works", href: "/pitch/how-it-works" },
];

/** Sub-nav for the 4-page pitch deck — Intro / Problem / Solution / How it works. */
export function PitchSubNav({ current }: { current: number }) {
  return (
    <div className="mx-auto mb-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {STEPS.map((s, i) => (
        <Link
          key={s.href}
          href={s.href}
          className={`font-brutal-mono text-[10px] uppercase tracking-widest ${
            i === current ? "text-brutal-fg" : "text-brutal-fg/30 hover:text-brutal-fg/60"
          }`}
        >
          {String(i + 1).padStart(2, "0")} {s.label}
        </Link>
      ))}
    </div>
  );
}
