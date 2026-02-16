/**
 * Crypto sector/category classification mapping.
 * Maps token base symbols (e.g., "BTC", "ETH") to sector + industry.
 * Tokens not in the map are classified as "Other".
 */

export interface CryptoClassification {
  sector: string;
  industry: string;
}

const CRYPTO_MAP: Record<string, CryptoClassification> = {
  // Layer 1
  BTC:  { sector: "Layer 1", industry: "Store of Value" },
  ETH:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  SOL:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  ADA:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  AVAX: { sector: "Layer 1", industry: "Smart Contract Platform" },
  DOT:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  NEAR: { sector: "Layer 1", industry: "Smart Contract Platform" },
  SUI:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  APT:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  TON:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  ATOM: { sector: "Layer 1", industry: "Interoperability" },
  ICP:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  ALGO: { sector: "Layer 1", industry: "Smart Contract Platform" },
  XTZ:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  HBAR: { sector: "Layer 1", industry: "Enterprise DLT" },
  EOS:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  FTM:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  EGLD: { sector: "Layer 1", industry: "Smart Contract Platform" },
  KAVA: { sector: "Layer 1", industry: "Smart Contract Platform" },
  SEI:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  TIA:  { sector: "Layer 1", industry: "Modular Blockchain" },
  INJ:  { sector: "Layer 1", industry: "Smart Contract Platform" },
  KAS:  { sector: "Layer 1", industry: "PoW Layer 1" },

  // Layer 2
  ARB:   { sector: "Layer 2", industry: "Ethereum L2" },
  OP:    { sector: "Layer 2", industry: "Ethereum L2" },
  MATIC: { sector: "Layer 2", industry: "Ethereum L2" },
  POL:   { sector: "Layer 2", industry: "Ethereum L2" },
  STRK:  { sector: "Layer 2", industry: "Ethereum L2" },
  MANTA: { sector: "Layer 2", industry: "Ethereum L2" },
  IMX:   { sector: "Layer 2", industry: "Ethereum L2" },
  MNT:   { sector: "Layer 2", industry: "Ethereum L2" },
  METIS: { sector: "Layer 2", industry: "Ethereum L2" },
  ZK:    { sector: "Layer 2", industry: "Ethereum L2" },

  // DeFi
  UNI:   { sector: "DeFi", industry: "DEX" },
  AAVE:  { sector: "DeFi", industry: "Lending" },
  MKR:   { sector: "DeFi", industry: "Lending" },
  CRV:   { sector: "DeFi", industry: "DEX" },
  DYDX:  { sector: "DeFi", industry: "DEX" },
  COMP:  { sector: "DeFi", industry: "Lending" },
  SNX:   { sector: "DeFi", industry: "Derivatives" },
  SUSHI: { sector: "DeFi", industry: "DEX" },
  LDO:   { sector: "DeFi", industry: "Liquid Staking" },
  PENDLE:{ sector: "DeFi", industry: "Yield" },
  JUP:   { sector: "DeFi", industry: "DEX Aggregator" },
  CAKE:  { sector: "DeFi", industry: "DEX" },
  "1INCH":{ sector: "DeFi", industry: "DEX Aggregator" },
  YFI:   { sector: "DeFi", industry: "Yield" },
  BAL:   { sector: "DeFi", industry: "DEX" },
  RUNE:  { sector: "DeFi", industry: "Cross-chain DEX" },
  RPL:   { sector: "DeFi", industry: "Liquid Staking" },
  SSV:   { sector: "DeFi", industry: "Staking Infrastructure" },
  ENA:   { sector: "DeFi", industry: "Stablecoin" },

  // AI
  FET:    { sector: "AI", industry: "AI Agent" },
  RENDER: { sector: "AI", industry: "GPU Compute" },
  TAO:    { sector: "AI", industry: "AI Network" },
  AGIX:   { sector: "AI", industry: "AI Agent" },
  OCEAN:  { sector: "AI", industry: "Data Market" },
  WLD:    { sector: "AI", industry: "Identity" },
  AKT:    { sector: "AI", industry: "GPU Compute" },
  RNDR:   { sector: "AI", industry: "GPU Compute" },
  AI:     { sector: "AI", industry: "AI Agent" },

  // Gaming / Metaverse
  AXS:  { sector: "Gaming", industry: "GameFi" },
  SAND: { sector: "Gaming", industry: "Metaverse" },
  MANA: { sector: "Gaming", industry: "Metaverse" },
  GALA: { sector: "Gaming", industry: "GameFi" },
  ENJ:  { sector: "Gaming", industry: "NFT/Gaming" },
  ILV:  { sector: "Gaming", industry: "GameFi" },
  BEAM: { sector: "Gaming", industry: "GameFi" },
  PIXEL:{ sector: "Gaming", industry: "GameFi" },
  RONIN:{ sector: "Gaming", industry: "Gaming Chain" },
  RON:  { sector: "Gaming", industry: "Gaming Chain" },

  // Meme
  DOGE:  { sector: "Meme", industry: "Meme Coin" },
  SHIB:  { sector: "Meme", industry: "Meme Coin" },
  PEPE:  { sector: "Meme", industry: "Meme Coin" },
  FLOKI: { sector: "Meme", industry: "Meme Coin" },
  WIF:   { sector: "Meme", industry: "Meme Coin" },
  BONK:  { sector: "Meme", industry: "Meme Coin" },
  NEIRO: { sector: "Meme", industry: "Meme Coin" },
  TURBO: { sector: "Meme", industry: "Meme Coin" },
  PEOPLE:{ sector: "Meme", industry: "Meme Coin" },
  BOME:  { sector: "Meme", industry: "Meme Coin" },
  NOT:   { sector: "Meme", industry: "Meme Coin" },
  DOGS:  { sector: "Meme", industry: "Meme Coin" },
  LUNC:  { sector: "Meme", industry: "Meme Coin" },

  // Infrastructure / Oracle / Data
  LINK:  { sector: "Infrastructure", industry: "Oracle" },
  GRT:   { sector: "Infrastructure", industry: "Indexing" },
  FIL:   { sector: "Infrastructure", industry: "Storage" },
  AR:    { sector: "Infrastructure", industry: "Storage" },
  THETA: { sector: "Infrastructure", industry: "Streaming" },
  ANKR:  { sector: "Infrastructure", industry: "Node Infrastructure" },
  BAND:  { sector: "Infrastructure", industry: "Oracle" },
  API3:  { sector: "Infrastructure", industry: "Oracle" },
  PYTH:  { sector: "Infrastructure", industry: "Oracle" },
  STX:   { sector: "Infrastructure", industry: "Bitcoin L2" },
  W:     { sector: "Infrastructure", industry: "Cross-chain" },

  // Exchange Token
  BNB: { sector: "Exchange", industry: "CEX Token" },
  OKB: { sector: "Exchange", industry: "CEX Token" },
  CRO: { sector: "Exchange", industry: "CEX Token" },
  GT:  { sector: "Exchange", industry: "CEX Token" },
  LEO: { sector: "Exchange", industry: "CEX Token" },

  // Payment / Transfer
  XRP: { sector: "Payment", industry: "Cross-border Payment" },
  XLM: { sector: "Payment", industry: "Cross-border Payment" },
  LTC: { sector: "Payment", industry: "Payment" },
  BCH: { sector: "Payment", industry: "Payment" },
  DASH:{ sector: "Payment", industry: "Privacy Payment" },
  ZEC: { sector: "Payment", industry: "Privacy Payment" },

  // Privacy
  XMR: { sector: "Privacy", industry: "Privacy Coin" },

  // RWA (Real World Assets)
  ONDO: { sector: "RWA", industry: "Tokenization" },
  CFG:  { sector: "RWA", industry: "Tokenization" },
};

// Stablecoins & wrapped tokens to exclude from heatmaps
const EXCLUDED_TOKENS = new Set([
  "USDT", "USDC", "DAI", "BUSD", "TUSD", "USDP", "FDUSD", "USDD",
  "WBTC", "WETH", "STETH", "CBETH", "RETH",
  "PAXG", // gold-backed
]);

/**
 * Get classification for a crypto symbol.
 * @param baseSymbol Base token symbol without quote (e.g., "BTC" from "BTCUSDT")
 */
export function getCryptoClassification(baseSymbol: string): CryptoClassification {
  const upper = baseSymbol.toUpperCase();
  return CRYPTO_MAP[upper] || { sector: "Other", industry: "Other" };
}

/**
 * Check if a token should be excluded from heatmaps (stablecoins, wrapped tokens).
 */
export function isExcludedToken(baseSymbol: string): boolean {
  return EXCLUDED_TOKENS.has(baseSymbol.toUpperCase());
}

/**
 * Extract base symbol from a USDT trading pair.
 * @param pair e.g., "BTCUSDT" → "BTC"
 */
export function extractBaseSymbol(pair: string): string {
  const upper = pair.toUpperCase();
  if (upper.endsWith("USDT")) return upper.slice(0, -4);
  if (upper.endsWith("USD")) return upper.slice(0, -3);
  if (upper.endsWith("BUSD")) return upper.slice(0, -4);
  return upper;
}

/**
 * Get all known sectors.
 */
export function getKnownSectors(): string[] {
  const sectors = new Set(Object.values(CRYPTO_MAP).map(c => c.sector));
  return [...sectors].sort();
}

/**
 * Get the full classification map (for testing).
 */
export function getClassificationMap(): Record<string, CryptoClassification> {
  return { ...CRYPTO_MAP };
}
