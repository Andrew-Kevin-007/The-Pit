# Build & run

Monorepo, npm workspaces. Node ≥ 20.

```
packages/
  shared/            match state model, leader rule, strategy-config, mock fixture
  graph-client/      typed queries + the composed cross-subgraph query
  subgraph-match/    custom match-events subgraph            (Kevin)
  subgraph-messari/  Messari Standardized DEX AMM subgraph   (Suganthan, Track 1)
  agent/             tick loop + Subgraph-MCP reasoning      (Sylesh + Suganthan)
  runner/            match lifecycle orchestrator            (Suganthan)
  web/               the public board (Next.js)              (Suganthan)
backend/             Uniswap v3 contracts — PitRouter, MatchController,
                     CommitReveal (Foundry project)          (Amalraj)
supabase/schema.sql  board_state + picks tables
.claude/skills/      vendored Graph Subgraph SKILLs
.mcp.json            Subgraph MCP server
```

## 0. Install

```bash
npm install
cp .env.example .env   # fill as you go
```

## 1. Build the TS packages (order matters)

```bash
npm -w @the-pit/shared run build
npm -w @the-pit/graph-client run build
npm -w @the-pit/agent run build
npm -w @the-pit/runner run build
```

## 2. Phase 1 — board on mock data (no chain, no keys)

```bash
# terminal A
npm -w @the-pit/web run dev            # http://localhost:3000  (renders bundled mock)

# terminal B — once Supabase env is set, push a live-updating mock match
npm -w @the-pit/runner run mock
```

Supabase: run `supabase/schema.sql` in the SQL editor, then set
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.

## 3. Contracts (`backend/`) — deploys the addresses everything else needs

```bash
cd backend
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge build
forge test                                          # 50 tests, offline
RUN_FORK_TESTS=true forge test --match-contract ForkE2E -vv   # live Base Sepolia fork

# deploy for real — needs a funded RUNNER_PRIVATE_KEY (Base Sepolia ETH +
# USDC_SEED_AMOUNT/WETH_SEED_AMOUNT of testnet USDC/WETH) — see backend/README.md
forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast -vvvv
# -> logs MATCH_CONTROLLER_ADDRESS / PIT_ROUTER_ADDRESS / POOL_ADDRESS, copy into .env
```

## 4. Subgraphs (need `backend/`'s deployed addresses first)

```bash
cd packages/subgraph-match
npm install
# put real address + startBlock in networks.json, replace abis/*.json with real ABIs
npm run codegen && npm run build
npx graph auth <STUDIO_DEPLOY_KEY>
npm run deploy -- --version-label v0.0.1
# -> copy the Development Query URL into .env as MATCH_SUBGRAPH_URL

cd ../subgraph-messari
npm install
# set startBlock to the pool-init block in networks.json
npm run codegen && npm run build
npm run deploy -- --version-label v0.0.1
# -> MESSARI_SUBGRAPH_URL
```

## 5. Phase 2 — chain mode

Fill `.env`: `RUNNER_PRIVATE_KEY`, `MATCH_CONTROLLER_ADDRESS`, `PIT_ROUTER_ADDRESS`,
`USDC_ADDRESS`, `POOL_ADDRESS`, `GRAPH_API_KEY`, `MATCH_SUBGRAPH_URL`,
`MESSARI_SUBGRAPH_URL`. Replace the function fragments in
`packages/runner/src/abis.ts` with the real `MatchController` ABI.

```bash
npm -w @the-pit/runner run build
node --env-file=.env packages/runner/dist/index.js rehearse --chain
```

## 6. Phase 4 — agent + MCP

Set `GRAPH_GATEWAY_API_KEY`, `MATCH_SUBGRAPH_DEPLOYMENT_ID`,
`MESSARI_SUBGRAPH_DEPLOYMENT_ID`. Pass a real `narrate` (LLM through the Claude
Agent SDK with `mcp.json` attached) into `reason()`. Log every `Decision.chain`.

## 7. Phase 5 — full rehearsal

```bash
node --env-file=.env packages/runner/dist/index.js rehearse --chain
# asserts: 6 rounds + MatchSettled in subgraph-match; pool swaps in subgraph-messari
```

## Typecheck everything

```bash
npm -ws run typecheck --if-present
```
