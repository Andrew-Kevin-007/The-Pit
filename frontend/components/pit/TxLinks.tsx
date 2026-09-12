/** Etherscan (Base Sepolia) links for a round's real on-chain swap tx hashes. */
export function TxLinks({ hashes }: { hashes: string[] }) {
  if (!hashes.length) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {hashes.map((h) => (
        <a
          key={h}
          href={`https://sepolia.basescan.org/tx/${h}`}
          target="_blank"
          rel="noreferrer"
          className="text-brutal-accent hover:underline"
        >
          tx {h.slice(0, 6)}&hellip;{h.slice(-4)} &#8599;
        </a>
      ))}
    </span>
  );
}
