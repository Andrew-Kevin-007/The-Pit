import Link from "next/link";
import { getAllMatches } from "@the-pit/graph-client";
import { MOCK_MATCH } from "@the-pit/shared";
import type { MatchStatus } from "@the-pit/shared";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { BrutalTable, BrutalThead, BrutalTbody, BrutalTr, BrutalTh, BrutalTd } from "@/components/brutal/BrutalTable";
import { MatchStatusBadge } from "@/components/pit/MatchStatusBadge";
import { PickBadge } from "@/components/pit/PickBadge";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function handleFor(addr: string) {
  return MOCK_MATCH.agents.find((a) => a.wallet.toLowerCase() === addr.toLowerCase())?.handle ?? truncate(addr);
}

export default async function MatchesPage() {
  const [matchId, matches] = await Promise.all([getCurrentMatchId(), getAllMatches(50).catch(() => [])]);

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mt-6 text-center">
          <h1 className="select-none font-pixel text-4xl tracking-tight sm:text-5xl">All Matches</h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-brutal-fg/50">
            every real match run through the pit — click one to watch or review it.
          </p>
        </div>

        <div className="mt-10">
          {matches.length === 0 ? (
            <p className="text-center text-xs text-brutal-fg/50">no matches yet.</p>
          ) : (
            <BrutalTable>
              <BrutalThead>
                <BrutalTr>
                  <BrutalTh>Match</BrutalTh>
                  <BrutalTh>Status</BrutalTh>
                  <BrutalTh>Fighters</BrutalTh>
                  <BrutalTh>Winner</BrutalTh>
                  <BrutalTh>Your pick</BrutalTh>
                </BrutalTr>
              </BrutalThead>
              <BrutalTbody>
                {matches.map((m) => {
                  const href = m.status === "SETTLED" ? `/match/${m.id}/result` : `/match/${m.id}`;
                  const handles: Record<string, string> = {};
                  for (const p of m.participants) handles[p.id.toLowerCase()] = handleFor(p.id);
                  return (
                    <BrutalTr key={m.id}>
                      <BrutalTd>
                        <Link href={href} className="font-semibold hover:underline">
                          #{m.id}
                        </Link>
                      </BrutalTd>
                      <BrutalTd>
                        <MatchStatusBadge status={m.status as MatchStatus} />
                      </BrutalTd>
                      <BrutalTd>
                        {m.participants.length === 0 ? (
                          <span className="text-brutal-fg/30">—</span>
                        ) : (
                          m.participants.map((p) => handleFor(p.id)).join(" vs ")
                        )}
                      </BrutalTd>
                      <BrutalTd>
                        {m.winner ? (
                          <span className="text-emerald-600">{handleFor(m.winner.id)}</span>
                        ) : (
                          <span className="text-brutal-fg/30">—</span>
                        )}
                      </BrutalTd>
                      <BrutalTd>
                        <PickBadge matchId={m.id} handles={handles} />
                      </BrutalTd>
                    </BrutalTr>
                  );
                })}
              </BrutalTbody>
            </BrutalTable>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/leaderboard" className="text-xs uppercase tracking-widest text-brutal-fg/50 hover:text-brutal-fg">
            &larr; hall of records
          </Link>
        </div>
      </div>
    </BrutalShell>
  );
}
