const ACCENT = { left: "text-pit-green", right: "text-pit-red" } as const;

/** Single sanitized commentary line, slides up on entry (README Motion). */
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
    <p key={text} className="animate-slide-up font-sans text-sm italic text-pit-dim">
      <span className={`not-italic font-mono font-medium ${ACCENT[side]}`}>{handle}</span>
      {": “"}
      {text}
      {"”"}
    </p>
  );
}
