# Submission — The Graph ($15,000, two tracks)

## Track 1 — Best Use of Composable or Standardized Graph Products ($5,000)

Requirement → where it's met:

- [ ] **Compose 2+ products OR build on a standardized schema** → both:
  `subgraph-messari` is the Messari DEX AMM standard; `graph-client/composed.ts`
  joins it with `subgraph-match`; Subgraph MCP layered over both.
- [ ] **Live data from a Graph provider** → Subgraph Studio Development Query
  URLs, API key. No mock/local/static.
- [ ] **Not "just querying one subgraph"** → composition + standardization, stated.
- [ ] **Standards leverage made explicit** → the "repoint `MESSARI_SUBGRAPH_URL`"
  paragraph in `docs/the-graph/README.md` and the demo.
- [ ] **Public repo + 2–4 min demo video** → `docs/DEMO-SCRIPT.md`.

## Track 2 — Best AI Tooling or AI Use Case with The Graph (From Scratch) ($5,000)

- [ ] **The Graph is load-bearing** → the agent's decisions come from Graph data
  (own history + Messari pool state) via the Subgraph MCP.
- [ ] **Live data** → same Studio endpoints + `GRAPH_GATEWAY_API_KEY`.
- [ ] **Meaningful reasoning/decisions, not a raw dump** → `Decision.chain`
  logged every tick; `graphReasoning.ts`.
- [ ] **Open source + README/SKILL.md** → `packages/agent/SKILL.md` (reusable),
  package READMEs, this repo.
- [ ] **2–4 min demo video** → `docs/DEMO-SCRIPT.md`.
- [ ] **Pool: Start Fresh** (net-new, built during the hackathon). State it in
  the submission form and the video.
- [ ] **Stretch: x402** → `packages/agent/src/x402.ts` + spend meter.

## "No mock data" audit — run before submitting

- [ ] `web` board in the demo is sourced from Supabase (runner-pushed) or the
  live subgraph — not the bundled `MOCK_MATCH`
- [ ] `graph-client` `MATCH_SUBGRAPH_URL` / `MESSARI_SUBGRAPH_URL` point at
  Studio Development Query URLs
- [ ] `runner` ran with `--chain` for the recorded rehearsal
- [ ] agent `reason()` queried the live MCP (chain log shows real responses)
- [ ] no `packages/*/src/**` import of `mock-match.json` on the demo path
- [ ] subgraphs deployed from `network: base-sepolia`, synced to chainhead

## Shared repo requirements (also gate the Uniswap track)

- [ ] Public GitHub repo, top-level runnable README (`docs/BUILD.md` linked)
- [ ] Amalraj: `FEEDBACK.md` + Uniswap Developer Feedback Form + contract
  line-number pointers in README
- [ ] `SKILL.md` linked from the top-level README
