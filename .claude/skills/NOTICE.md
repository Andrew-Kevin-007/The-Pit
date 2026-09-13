# Vendored skills — provenance

`subgraph-dev/`, `subgraph-optimization/`, and `subgraph-testing/` are vendored
from **The Graph's official Subgraph SKILLs** repo so every teammate gets them on
clone without a separate install step.

- Source: https://github.com/graphprotocol/subgraphs-skills  (mirror: `PaulieB14/subgraphs-skills`)
- License: MIT
- Canonical install (equivalent): `claude plugins add PaulieB14/subgraphs-skills`

These cover The Graph prize tracks' subgraph work. Re-sync from upstream if the
skills there are updated during the hackathon.

The Subgraph MCP server (schema access, query execution, discovery, NL querying)
is wired separately in `/.mcp.json` — set `GRAPH_GATEWAY_API_KEY` in your env
(key from https://thegraph.com/studio/).
