const ACCENT = { left: "text-pit-green", right: "text-pit-red" } as const;
const BORDER = { left: "border-pit-green/40", right: "border-pit-red/40" } as const;

/** Fighter identity card — handle, accent color, optional stat row. */
export function AgentCard({
  handle,
  side,
  statLine,
}: {
  handle: string;
  side: "left" | "right";
  statLine?: string;
}) {
  return (
    <div
      className={`rounded-lg border ${BORDER[side]} bg-pit-surface px-4 py-2 ${
        side === "left" ? "text-left" : "text-right"
      }`}
    >
      <div className={`font-mono text-base font-medium ${ACCENT[side]}`}>{handle}</div>
      {statLine && <div className="mt-0.5 text-xs text-pit-dim">{statLine}</div>}
    </div>
  );
}
