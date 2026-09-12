"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { useMetaMaskWallet } from "@/hooks/useMetaMaskWallet";
import { submitPickOnChain } from "@/lib/pitContract";

export interface FighterOption {
  wallet: string;
  handle: string;
  side: "left" | "right";
}

type PickStatus = "idle" | "confirming" | "done" | "error";

/**
 * Pick-a-side button pair. A real MetaMask tx to MatchController.submitPick()
 * on Base Sepolia — public, ungated, moves no funds (just gas). One pick per
 * session is a UI courtesy (localStorage), not a contract rule.
 */
export function FighterSelect({
  matchId,
  agents,
  matchControllerAddress,
}: {
  matchId: string;
  agents: FighterOption[];
  matchControllerAddress: string;
}) {
  const { address, connecting, error: walletError, hasProvider, connect } = useMetaMaskWallet();
  const [pick, setPick] = useState<string | null>(null);
  const [status, setStatus] = useState<PickStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPick(localStorage.getItem(`pit_pick_${matchId}`));
      setTxHash(localStorage.getItem(`pit_pick_tx_${matchId}`));
    } catch {
      /* private-browsing etc. — picking just won't persist across reloads */
    }
  }, [matchId]);

  async function choose(side: string) {
    if (pick || status === "confirming") return;
    let account = address;
    if (!account) {
      account = await connect();
      if (!account) return;
    }
    setStatus("confirming");
    setPickError(null);
    try {
      const hash = await submitPickOnChain(
        account,
        matchControllerAddress as Address,
        matchId,
        side as Address,
      );
      setPick(side);
      setTxHash(hash);
      setStatus("done");
      try {
        localStorage.setItem(`pit_pick_${matchId}`, side);
        localStorage.setItem(`pit_pick_tx_${matchId}`, hash);
      } catch {
        /* ignore */
      }
      // best-effort mirror into Supabase so SpectatorCount can show a live
      // "N picks cast" without waiting on subgraph indexing — the on-chain
      // tx above is the real, tamper-proof pick either way.
      fetch("/api/picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, side, clientId: account }),
      }).catch(() => {});
    } catch (e) {
      setStatus("error");
      const shortMessage = (e as { shortMessage?: string })?.shortMessage;
      setPickError(shortMessage ?? (e instanceof Error ? e.message : "transaction failed"));
    }
  }

  if (pick) {
    const handle = agents.find((a) => a.wallet.toLowerCase() === pick.toLowerCase())?.handle ?? pick.slice(0, 8);
    return (
      <div className="space-y-1 text-sm text-brutal-fg/60">
        <p>You picked {handle} — good luck.</p>
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-brutal-mono text-xs text-brutal-accent underline"
          >
            view pick on-chain &rarr;
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!address ? (
        <BrutalButton onClick={connect} disabled={connecting || !hasProvider} className="w-full">
          {!hasProvider ? "install metamask to pick" : connecting ? "connecting…" : "connect wallet to pick"}
        </BrutalButton>
      ) : (
        <div className="flex gap-3">
          {agents.map((a) => (
            <BrutalButton
              key={a.wallet}
              variant="outline"
              onClick={() => choose(a.wallet)}
              disabled={status === "confirming"}
              className={
                a.side === "left"
                  ? "flex-1 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500 hover:text-brutal-bg"
                  : "flex-1 border-red-500/40 text-red-500 hover:bg-red-500 hover:text-brutal-bg"
              }
            >
              {status === "confirming" ? "confirm in wallet…" : a.handle}
            </BrutalButton>
          ))}
        </div>
      )}
      {(walletError || pickError) && (
        <p className="text-center text-xs text-red-500">{walletError ?? pickError}</p>
      )}
    </div>
  );
}
