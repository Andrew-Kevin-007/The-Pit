"use client";

import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, type Address } from "viem";
import { baseSepolia } from "viem/chains";

// EIP-1193 provider MetaMask (and most injected wallets) attach to window.ethereum.
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34"; // 84532

export interface MetaMaskWallet {
  address: Address | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<Address | null>;
}

/** Minimal MetaMask (or any injected EIP-1193 wallet) connect + Base Sepolia switch. */
export function useMetaMaskWallet(): MetaMaskWallet {
  const [address, setAddress] = useState<Address | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setHasProvider(!!provider);
    if (!provider) return;

    // Reflect an already-connected account without prompting.
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const a = (accounts as string[])[0];
        if (a) setAddress(a as Address);
      })
      .catch(() => {});

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress((accounts[0] as Address) ?? null);
    };
    provider.on?.("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, []);

  const connect = useCallback(async (): Promise<Address | null> => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider) {
      setError("No wallet found — install MetaMask to pick on-chain.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts[0];
      if (!account) throw new Error("no account returned");

      // Make sure we're signing against Base Sepolia, not whatever chain
      // MetaMask happened to be on.
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
        });
      } catch (switchErr) {
        const code = (switchErr as { code?: number })?.code;
        if (code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
                chainName: "Base Sepolia",
                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              },
            ],
          });
        } else {
          throw switchErr;
        }
      }

      setAddress(account as Address);
      return account as Address;
    } catch (e) {
      setError(e instanceof Error ? e.message : "wallet connection failed");
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  return { address, connecting, error, hasProvider, connect };
}

/** Wallet client for the connected account, targeting Base Sepolia. */
export function walletClientFor(address: Address) {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("no injected wallet");
  return createWalletClient({
    account: address,
    chain: baseSepolia,
    transport: custom(window.ethereum),
  });
}
