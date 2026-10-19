import { SOL_USD, shortAddr } from "@/lib/format";
import type { BuyMode, Draft, Wallet } from "@/lib/types";
import { num, round } from "@/lib/utils";

export const DEPLOY_FEE = 0.021;
export const MIN_DEV = 0.05;
export const MIN_BUNDLE = 0.0225;

export const BUY_MODES: { id: BuyMode; name: string; blurb: string; tag?: string }[] = [
  {
    id: "timed",
    name: "Timed Buys",
    tag: "Avoid BubbleMap",
    blurb: "The dev launches first. Every Timed Buy wallet then buys automatically in a separate transaction using your delay range.",
  },
  {
    id: "fast",
    name: "Fast Bundle",
    blurb: "Selected wallets buy together for the fastest entry. Holder maps may group them.",
  },
  {
    id: "combo",
    name: "Fast Bundle + Timed Buys",
    blurb: "Dev and the fast group buy together. The remaining wallets follow on a delay.",
  },
  {
    id: "dev",
    name: "Dev Buy Only",
    blurb: "Only the dev wallet buys. No extra bundle and no follow-up wallets.",
  },
];

export function emptyDraft(style: Draft["style"]): Draft {
  return {
    phase: "setup",
    style,
    step: 1,
    platform: "Pump.fun",
    name: "",
    symbol: "",
    description: "",
    image: null,
    website: "",
    xUrl: "",
    telegram: "",
    launchMode: "classic",
    pair: "SOL",
    customPair: "",
    holderRewards: false,
    shareCreator: false,
    sourceAddress: "",
    sourceName: "",
    buyMode: "fast",
    devWalletId: null,
    bundleWalletIds: [],
    distribution: "custom",
    bundlePct: 95,
    totalSol: "0.15",
    devBudget: "0.05",
    amounts: {},
    slippage: 50,
    jitoTip: "0.001",
    farmSnipers: false,
    smartSell: false,
    autoTp: "",
    retry: true,
    automations: [],
    targetId: null,
  };
}

export function buyModeLabel(id: BuyMode) {
  return BUY_MODES.find((m) => m.id === id)?.name ?? id;
}

export function styleLabel(style: Draft["style"]) {
  if (style === "bundle") return "New bundle";
  if (style === "vamp") return "Vamp";
  return "CTO";
}

export function draftCharges(draft: Draft) {
  const devBuy = num(draft.devBudget);
  const tip = num(draft.jitoTip);
  const charges: { walletId: string; amount: number }[] = [];
  if (draft.devWalletId) {
    charges.push({ walletId: draft.devWalletId, amount: round(devBuy + DEPLOY_FEE + tip) });
  }
  if (draft.buyMode !== "dev") {
    for (const id of draft.bundleWalletIds) {
      charges.push({ walletId: id, amount: round(num(draft.amounts[id])) });
    }
  }
  return charges;
}

export function capitalOf(draft: Draft) {
  return round(draftCharges(draft).reduce((s, c) => s + c.amount, 0));
}

export function launchBlocker(draft: Draft, wallets: Wallet[], live?: { balance: number } | null) {
  if (!draft.name.trim()) return "Name the token.";
  if (!draft.symbol.trim()) return "Add a ticker.";
  if (draft.symbol.trim().length > 10) return "Ticker must be 10 characters or fewer.";
  const devBuy = num(draft.devBudget);
  const spend = Math.max(capitalOf(draft), devBuy);
  if (live) {
    if (spend < 0.01) return "Set a buy of at least 0.01 SOL. Phantom pays it.";
    if (draft.style === "cto" && !draft.sourceAddress) return "Paste the coin's contract address before a live buy.";
    if (draft.style !== "cto" && draft.platform !== "Pump.fun") return "Live mints go through Pump.fun.";
    const need = round(spend + 0.03);
    if (live.balance + 1e-9 < need) {
      return `Phantom has ${live.balance.toFixed(3)} SOL. Keep about ${need.toFixed(3)} for the buy, the fee, and network.`;
    }
    return null;
  }
  if (!draft.devWalletId) return "Pick a dev wallet.";
  const dev = wallets.find((w) => w.id === draft.devWalletId);
  if (!dev) return "That dev wallet is gone.";
  if (devBuy < MIN_DEV) return `Dev buy must be at least ${MIN_DEV} SOL.`;
  const tip = num(draft.jitoTip);
  if (tip < 0) return "Tip can't be negative.";
  const need = round(devBuy + DEPLOY_FEE + tip);
  if (dev.balance + 1e-9 < need) {
    return `Dev wallet ${shortAddr(dev.address)} needs at least ${need.toFixed(3)} SOL. Fund it before continuing.`;
  }
  if (draft.buyMode !== "dev") {
    if (draft.bundleWalletIds.length === 0) return "Add at least one bundle wallet, or switch to dev buy only.";
    for (const id of draft.bundleWalletIds) {
      if (id === dev.id) return "The dev wallet can't also sit in the bundle.";
      const w = wallets.find((x) => x.id === id);
      if (!w) return "A bundle wallet is missing.";
      const amt = num(draft.amounts[id]);
      if (amt < MIN_BUNDLE) return `${w.name} needs at least ${MIN_BUNDLE} SOL.`;
      if (w.balance + 1e-9 < amt) return `${w.name} only has ${w.balance.toFixed(4)} SOL.`;
    }
  }
  return null;
}

export function stepBlocker(draft: Draft, wallets: Wallet[], step: number, live?: { balance: number } | null) {
  if (draft.phase === "setup") return null;
  if (step === 1) {
    if ((draft.style === "vamp" || draft.style === "cto") && !draft.sourceAddress) return "Enter the token mint address.";
    if (!draft.name.trim()) return "Name the token.";
    if (!draft.symbol.trim()) return "Add a ticker.";
    return null;
  }
  if (step === 2) return null;
  if (step === 3) {
    if (!draft.devWalletId) return "Pick a dev wallet.";
    if (!live && draft.buyMode !== "dev" && draft.bundleWalletIds.length === 0) {
      return "Add at least one bundle wallet.";
    }
    if (draft.devWalletId && draft.bundleWalletIds.includes(draft.devWalletId)) {
      return "The dev wallet can't also sit in the bundle.";
    }
    return null;
  }
  return launchBlocker(draft, wallets, live);
}

export function pnlToUsd(sol: number) {
  return round(sol * SOL_USD, 2);
}
