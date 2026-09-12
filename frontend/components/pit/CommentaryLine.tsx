const ACCENT = { left: "text-emerald-500", right: "text-red-500" } as const;

/** Single sanitized commentary line — reads like in-game dialogue. */
export function CommentaryLine({
  handle,
  text,
  side,
}: {
  handle: string;
  text: string;
  side: "left" | "right";
}) {
  return (
    <p className="font-brutal-mono text-sm text-brutal-fg/70">
      <span className={`font-semibold ${ACCENT[side]}`}>{handle}</span>
      {": “"}
      {text}
      {"”"}
    </p>
  );
}
