/**
 * Minimal ABIs the runner needs. The event fragments MUST stay in sync with
 * packages/subgraph-match/abis. Replace the function fragments with Amalraj's
 * real MatchController ABI once it exists — signatures below are the Day-1
 * proposal (see docs/INTERFACE-FREEZE.md).
 */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** PitRouter — the only function an agent's own wallet ever calls directly. */
export const pitRouterAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "zeroForOne", type: "bool" },
      { name: "amountSpecified", type: "int256" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
    outputs: [
      { name: "amount0", type: "int256" },
      { name: "amount1", type: "int256" },
    ],
  },
] as const;

/** Uniswap SwapRouter02 on Base Sepolia — verified on-chain: factory() matches
 *  UNISWAP_V3_FACTORY_ADDRESS. Used only to top an agent's USDC back up above
 *  STAKE_USDC out of WETH it already holds (from prior matches' trading). */
export const SWAP_ROUTER02_ADDRESS = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as const;

export const swapRouter02Abi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const matchControllerAbi = [
  // ---- writes (Day-1 proposal) ----
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "commitHash", type: "bytes32" },
      { name: "stake", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "startMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lockRound",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "round", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "config", type: "string" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  // ---- events (mirror packages/subgraph-match/abis/MatchController.json) ----
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "commitHash", type: "bytes32" },
      { indexed: false, name: "stake", type: "uint256" },
      { indexed: true, name: "matchId", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchStarted",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: false, name: "startTime", type: "uint256" },
      { indexed: false, name: "agents", type: "address[]" },
    ],
  },
  {
    type: "event",
    name: "RoundLocked",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: false, name: "round", type: "uint8" },
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "usdcBalance", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchSettled",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "rebateAmounts", type: "uint256[]" },
    ],
  },
] as const;
