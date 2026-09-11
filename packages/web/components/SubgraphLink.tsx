/**
 * "Permanent record" badge — deep-links to the live Subgraph Studio query.
 * README UX principle #4: the Graph proof is a feature, not a backend detail.
 */
export function SubgraphLink({ label = "ON-CHAIN RECORD — TAMPER-PROOF", href }: { label?: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-pit-border bg-pit-surface px-3 py-2 font-mono text-xs uppercase tracking-wider text-pit-yellow hover:border-pit-yellow"
    >
      <span aria-hidden>&#9670;</span> {label}
    </a>
  );
}
