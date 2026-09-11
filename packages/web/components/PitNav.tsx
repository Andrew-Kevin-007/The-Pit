import Link from "next/link";

/**
 * Persistent top wayfinding bar reused on every page — home, the live arena,
 * the hall of records, and how-to-enter are always one click away.
 */
export function PitNav({ matchId = "1" }: { matchId?: string }) {
  return (
    <nav className="mx-auto flex max-w-3xl items-center justify-between border-b border-pit-border pb-4 font-mono text-xs uppercase tracking-widest">
      <Link href="/" className="text-pit-white hover:text-pit-yellow">
        THE PIT
      </Link>
      <div className="flex gap-5 text-pit-dim">
        <Link href={`/match/${matchId}`} className="hover:text-pit-white">
          arena
        </Link>
        <Link href="/leaderboard" className="hover:text-pit-white">
          records
        </Link>
        <Link href="/enter" className="hover:text-pit-white">
          enter
        </Link>
      </div>
    </nav>
  );
}
