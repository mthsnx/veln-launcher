export type StyleId = "bundle" | "vamp" | "cto";
export type BuyMode = "timed" | "fast" | "combo" | "dev";
export type Pair = "SOL" | "USDC" | "CUSTOM";

export type Wallet = {
  id: string;
  name: string;
  address: string;
  balance: number;
  tag?: string;
  mnemonic?: string;
  secretKey?: string;
};

export type Project = {
  id: string;
  style: StyleId;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  platform: string;
  buyMode: BuyMode;
  pnlSol: number;
  spentSol: number;
  walletCount: number;
  status: "success" | "failed";
  createdAt: number;
  source?: string;
  extras: string[];
  mint?: string;
  signature?: string;
};

export type Activity = {
  id: string;
  projectId?: string;
  title: string;
  subtitle: string;
  pnlSol: number;
  createdAt: number;
  status: "success" | "failed";
};

export type DayPoint = { date: string; pnlUsd: number };

export type Preset = {
  id: string;
  name: string;
  buyMode: BuyMode;
  slippage: number;
  jitoTip: string;
  distribution: "equal" | "custom";
  bundlePct: number;
  devWalletId: string | null;
  bundleWalletIds: string[];
  totalSol: string;
  devBudget: string;
  farmSnipers: boolean;
};

export type Automation = { id: string; kind: "bump" | "buy" | "maker"; label: string };

export type Draft = {
  phase: "setup" | "steps";
  style: StyleId;
  step: number;
  platform: string;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  website: string;
  xUrl: string;
  telegram: string;
  launchMode: "classic" | "mayhem";
  pair: Pair;
  customPair: string;
  holderRewards: boolean;
  shareCreator: boolean;
  sourceAddress: string;
  sourceName: string;
  buyMode: BuyMode;
  devWalletId: string | null;
  bundleWalletIds: string[];
  distribution: "equal" | "custom";
  bundlePct: number;
  totalSol: string;
  devBudget: string;
  amounts: Record<string, string>;
  slippage: number;
  jitoTip: string;
  farmSnipers: boolean;
  smartSell: boolean;
  autoTp: string;
  retry: boolean;
  automations: Automation[];
  targetId: string | null;
};

export type Position = {
  id: string;
  projectId: string;
  costSol: number;
  tokens: number;
  entry: number;
};

export type Charge = { walletId: string; amount: number };

export type LaunchInput = {
  style: StyleId;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  platform: string;
  buyMode: BuyMode;
  walletCount: number;
  extras?: string[];
  source?: string;
  charges: Charge[];
  failChance?: number;
};
