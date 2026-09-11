/** Formats a USDC base-unit BigInt/string as `+$X.XX` / `-$X.XX`, colored. */
export function PnlDisplay({ baseUnits, className = "" }: { baseUnits: string | bigint; className?: string }) {
  const value = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits);
  const up = value >= 0n;
  const abs = up ? value : -value;
  const dollars = (Number(abs) / 1e6).toFixed(2);
  return (
    <span className={`font-mono ${up ? "text-pit-green" : "text-pit-red"} ${className}`}>
      {up ? "+" : "−"}${dollars}
    </span>
  );
}
