import { hoursAgo, utcDay } from "@/lib/format";
import { pnlToUsd } from "@/lib/plan";
import type { Activity, DayPoint, Project, Wallet } from "@/lib/types";
import { round } from "@/lib/utils";

export const PLATFORMS = [
  {
    id: "Pump.fun",
    blurb: "Bonding curve. Fast bundle and timed buys land in the same launch window.",
  },
  {
    id: "Raydium",
    blurb: "The dev wallet opens the pool. Bundle wallets take the first ticks.",
  },
  {
    id: "Meteora",
    blurb: "DLMM pool. Wallets buy the opening bins together.",
  },
] as const;

export const CTO_TOKENS = [
  {
    id: "comet",
    name: "Pale Comet",
    symbol: "COMET",
    mc: "$186K",
    holders: "1,204",
    age: "22d",
    liq: "38 SOL",
    note: "Dev wallet has been quiet for nine days. Holders are still in the chat.",
    description: "A slow comet. The original operator stopped posting.",
  },
  {
    id: "choir",
    name: "Rust Choir",
    symbol: "CHOIR",
    mc: "$74K",
    holders: "640",
    age: "11d",
    liq: "19 SOL",
    note: "Liquidity is thin and the telegram is abandoned. A new operator could walk it.",
    description: "Off-key on purpose. Community wants a new desk.",
  },
  {
    id: "plant",
    name: "Desk Plant",
    symbol: "PLANT",
    mc: "$310K",
    holders: "2,011",
    age: "41d",
    liq: "88 SOL",
    note: "Healthy holder base, dormant mint authority. Takeover is a buy, not a mint.",
    description: "It lives on the desk. Nobody waters it anymore.",
  },
  {
    id: "moon2",
    name: "Second Moon",
    symbol: "MOON2",
    mc: "$52K",
    holders: "418",
    age: "6d",
    liq: "14 SOL",
    note: "Early and messy. Supply is still sitting in a handful of wallets.",
    description: "The first moon was taken. This one is still in play.",
  },
];

export const TRENDING = [
  { symbol: "LINT", mc: "$94.2K", up: true },
  { symbol: "BREAD", mc: "$210K", up: true },
  { symbol: "FOG", mc: "$18.4K", up: false },
  { symbol: "COMET", mc: "$186K", up: true },
  { symbol: "KEY", mc: "$62.0K", up: false },
  { symbol: "PLANT", mc: "$310K", up: true },
  { symbol: "CHOIR", mc: "$74.1K", up: false },
  { symbol: "RENT", mc: "$41.6K", up: true },
  { symbol: "YCBL", mc: "$12.8K", up: false },
  { symbol: "MOON2", mc: "$52.4K", up: true },
  { symbol: "DUST", mc: "$8.8K", up: false },
  { symbol: "ORBT", mc: "$151K", up: true },
];

export const MAIN_ADDRESS = "FDn2rK8sQm4Vx1aLp0cYBWEHt9uN3sQe7kDBPM";

export function seedWallets(): Wallet[] {
  return [
    { id: "w1", name: "Imported 1", address: "7YKZW9kP2mQn4sLd8aHc3vR1uT6xZfB5nJrE", balance: 0.8421, tag: "Funded" },
    { id: "w2", name: "Imported 2", address: "FDn2r8Qm4Vx1aLp0cYBWEHt9uN3sQe7kAa91", balance: 0.4104, tag: "Funded" },
    { id: "w3", name: "Wallet 4", address: "68XB7a4CC4Ny9kP2mQn4sLd8aHc3vR1uT6xZ", balance: 0.186, tag: "" },
    { id: "w4", name: "Wallet 5", address: "6LpmpsZQcNyZ1aLp0cYBWEHt9uN3sQe7kBb2", balance: 0.094, tag: "" },
    { id: "w5", name: "Wallet 6", address: "BjeWDANwemP73mN2sWvR8aLd4YhC6bE1uT9x", balance: 0.018, tag: "" },
    { id: "w6", name: "Vault", address: "GeJNWYJdzJSA0cA2kMte7KqP3mN2sWvR8aLd4Y", balance: 1.24, tag: "Cold" },
  ];
}

function project(partial: Omit<Project, "extras"> & { extras?: string[] }): Project {
  return { extras: [], ...partial };
}

export function seedProjects(): Project[] {
  return [
    project({
      id: "p_dust",
      style: "bundle",
      name: "Dust Cat",
      symbol: "DUST",
      description: "A cat made of pocket lint and exit liquidity.",
      image: null,
      platform: "Pump.fun",
      buyMode: "fast",
      pnlSol: -1.08,
      spentSol: 0.62,
      walletCount: 4,
      status: "success",
      createdAt: hoursAgo(38),
    }),
    project({
      id: "p_marb",
      style: "vamp",
      name: "Marble Kid",
      symbol: "MARB",
      description: "Copied from a quiet marble market and relaunched clean.",
      image: null,
      platform: "Pump.fun",
      buyMode: "timed",
      pnlSol: -0.22,
      spentSol: 0.31,
      walletCount: 3,
      status: "success",
      createdAt: hoursAgo(44),
      source: "Marble",
    }),
    project({
      id: "p_moth",
      style: "bundle",
      name: "Glass Moth",
      symbol: "MOTH",
      description: "It flies into the candle and somehow prints.",
      image: null,
      platform: "Raydium",
      buyMode: "combo",
      pnlSol: 3.42,
      spentSol: 0.48,
      walletCount: 5,
      status: "success",
      createdAt: hoursAgo(55),
    }),
    project({
      id: "p_knife",
      style: "cto",
      name: "Knife Swap",
      symbol: "KNIFE",
      description: "Took the book after the old desk went dark.",
      image: null,
      platform: "Pump.fun",
      buyMode: "fast",
      pnlSol: -0.64,
      spentSol: 0.7,
      walletCount: 4,
      status: "success",
      createdAt: hoursAgo(76),
    }),
    project({
      id: "p_bell",
      style: "bundle",
      name: "Tiny Bell",
      symbol: "BELL",
      description: "The deploy never cleared.",
      image: null,
      platform: "Meteora",
      buyMode: "dev",
      pnlSol: -0.021,
      spentSol: 0.021,
      walletCount: 1,
      status: "failed",
      createdAt: hoursAgo(100),
    }),
    project({
      id: "p_orbt",
      style: "bundle",
      name: "Soda Orbit",
      symbol: "ORBT",
      description: "A canned drink with a gravity problem.",
      image: null,
      platform: "Pump.fun",
      buyMode: "fast",
      pnlSol: 6.12,
      spentSol: 0.55,
      walletCount: 6,
      status: "success",
      createdAt: hoursAgo(150),
    }),
    project({
      id: "p_pudl",
      style: "vamp",
      name: "Puddle",
      symbol: "PUDL",
      description: "Shallow on purpose.",
      image: null,
      platform: "Pump.fun",
      buyMode: "timed",
      pnlSol: 0.91,
      spentSol: 0.28,
      walletCount: 3,
      status: "success",
      createdAt: hoursAgo(220),
    }),
    project({
      id: "p_soot",
      style: "cto",
      name: "Soot",
      symbol: "SOOT",
      description: "Community takeover of a coin that had already burned once.",
      image: null,
      platform: "Raydium",
      buyMode: "combo",
      pnlSol: -0.15,
      spentSol: 0.22,
      walletCount: 2,
      status: "success",
      createdAt: hoursAgo(420),
    }),
  ];
}

export function seedActivity(projects: Project[]): Activity[] {
  return projects.map((p) => ({
    id: `a_${p.id}`,
    projectId: p.id,
    title:
      p.status === "failed"
        ? "Launch failed · Solana"
        : p.style === "cto"
          ? "Takeover · Solana"
          : p.style === "vamp"
            ? "Vamp launched · Solana"
            : "Token launched · Solana",
    subtitle: `${p.name} (${p.symbol})`,
    pnlSol: p.pnlSol,
    createdAt: p.createdAt,
    status: p.status,
  }));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDays(projects: Project[]): DayPoint[] {
  const days: DayPoint[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), pnlUsd: 0 });
  }
  const rnd = mulberry32(20261015);
  for (let i = 0; i < days.length - 1; i++) {
    const r = rnd();
    if (r > 0.8) days[i].pnlUsd = round(28 + rnd() * 180, 2);
    else if (r > 0.5) days[i].pnlUsd = -round(10 + rnd() * 70, 2);
  }
  for (const p of projects) {
    const key = utcDay(p.createdAt);
    const day = days.find((d) => d.date === key);
    if (day) day.pnlUsd = round(day.pnlUsd + pnlToUsd(p.pnlSol), 2);
  }
  const today = utcDay();
  const last = days[days.length - 1];
  if (last && last.date === today) {
    const seededToday = projects.some((p) => utcDay(p.createdAt) === today);
    if (!seededToday) last.pnlUsd = 0;
  }
  return days;
}
