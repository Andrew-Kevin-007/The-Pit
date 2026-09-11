import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"

export const ZERO_BI = BigInt.zero()
export const ZERO_BD = BigDecimal.zero()
export const SECONDS_PER_DAY = 86400

export const SCHEMA_VERSION = "1.3.0-subset"
export const SUBGRAPH_VERSION = "0.0.1"
export const METHODOLOGY_VERSION = "1.0.0"
export const PROTOCOL_NAME = "Uniswap v3"
export const PROTOCOL_SLUG = "uniswap-v3-base-sepolia"

// v3 has no singleton — every pool is its own contract. The "protocol" entity
// is keyed by the Factory address (Messari convention), which is a constant
// across every pool this subgraph might one day index (currently exactly
// one). Base Sepolia Uniswap v3 Factory — see .env.example.
export const FACTORY: Address = Address.fromString(
  "0x4752bA5DBc23f44D87826276BF6Fd6b1C372aD24"
)

export function feeTierId(poolAddr: Bytes): Bytes {
  return poolAddr.concatI32(0)
}

/**
 * Static token metadata for Base Sepolia so we never issue an extra eth_call
 * beyond the declared token0()/token1()/fee() on Initialize.
 * Add real symbols here as pools get indexed; harmless as "Unknown" until then.
 */
export function knownToken(addr: Address): string[] | null {
  const a = addr.toHexString()
  if (a == "0x0000000000000000000000000000000000000000") {
    return ["Ether", "ETH", "18"]
  }
  if (a == "0x036cbd53842c5426634e7929541ec2318f3dcf7e") {
    return ["USD Coin", "USDC", "6"]
  }
  if (a == "0x4200000000000000000000000000000000000006") {
    return ["Wrapped Ether", "WETH", "18"]
  }
  return null
}
