import { createServerFn } from "@tanstack/react-start";

export type LiveCoin = {
  address: string;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  website: string;
  xUrl: string;
  telegram: string;
  marketCap: number | null;
  dex: string;
  platform: string;
};

type SocialLink = { url?: string; type?: string; label?: string };

type DexPair = {
  dexId?: string;
  pairAddress?: string;
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: {
    imageUrl?: string;
    websites?: { url?: string }[];
    socials?: SocialLink[];
  };
};

type DexProfile = {
  chainId?: string;
  tokenAddress?: string;
  description?: string;
  icon?: string;
  links?: SocialLink[];
};

type JupToken = {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  mcap?: number;
  launchpad?: string;
};

const B58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const LIST_LIMIT = 12;
const CACHE_MS = 45_000;

let profileCache: { at: number; rows: DexProfile[] } | null = null;
let listCache: { at: number; coins: LiveCoin[] } | null = null;

export function extractSolAddress(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const matches = text.match(B58);
  if (!matches?.length) return null;
  return matches[matches.length - 1] ?? null;
}

function platformOf(dex: string) {
  const d = dex.toLowerCase();
  if (d.includes("raydium")) return "Raydium";
  if (d.includes("meteora")) return "Meteora";
  return "Pump.fun";
}

function compactUsd(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function iconUrl(icon: string | undefined) {
  if (!icon) return null;
  if (icon.startsWith("http")) return icon;
  if (/^[A-Za-z0-9_-]{6,}$/.test(icon)) {
    return `https://cdn.dexscreener.com/cms/images/${icon}?width=800&height=800&quality=95&format=auto`;
  }
  return null;
}

function readLinks(links: SocialLink[] | undefined) {
  let website = "";
  let xUrl = "";
  let telegram = "";
  for (const link of links ?? []) {
    const url = (link.url ?? "").trim();
    if (!url) continue;
    const type = (link.type ?? "").toLowerCase();
    const href = url.startsWith("http") ? url : `https://${url}`;
    if (type === "twitter" || type === "x" || href.includes("x.com") || href.includes("twitter.com")) {
      if (!xUrl) xUrl = href;
    } else if (type === "telegram" || href.includes("t.me/") || href.includes("telegram.")) {
      if (!telegram) telegram = href;
    } else if (!website) {
      website = href;
    }
  }
  return { website, xUrl, telegram };
}

function mergeLinks(a: ReturnType<typeof readLinks>, b: ReturnType<typeof readLinks>) {
  return {
    website: a.website || b.website,
    xUrl: a.xUrl || b.xUrl,
    telegram: a.telegram || b.telegram,
  };
}

function describe(name: string, symbol: string, dex: string, marketCap: number | null, profile?: string) {
  const written = profile?.trim();
  if (written) return written.slice(0, 500);
  const where = dex ? ` on ${dex}` : " on Solana";
  const cap = marketCap && marketCap > 0 ? ` Market cap ${compactUsd(marketCap)}.` : "";
  return `${name} ($${symbol})${where}.${cap}`.slice(0, 500);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadProfiles() {
  if (profileCache && Date.now() - profileCache.at < CACHE_MS) return profileCache.rows;
  const [boosts, profiles] = await Promise.all([
    fetchJson<DexProfile[]>("https://api.dexscreener.com/token-boosts/top/v1"),
    fetchJson<DexProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1"),
  ]);
  const rows = [...(boosts ?? []), ...(profiles ?? [])].filter(
    (row) => row.chainId === "solana" && row.tokenAddress,
  );
  profileCache = { at: Date.now(), rows };
  return rows;
}

function profileFor(rows: DexProfile[], address: string) {
  return rows.find((row) => row.tokenAddress === address);
}

function coinFromPair(pair: DexPair, profile?: DexProfile): LiveCoin | null {
  const address = pair.baseToken?.address?.trim();
  const name = pair.baseToken?.name?.trim();
  const symbol = pair.baseToken?.symbol?.trim();
  if (!address || !name || !symbol) return null;
  const marketCap = typeof pair.marketCap === "number" ? pair.marketCap : typeof pair.fdv === "number" ? pair.fdv : null;
  const dex = pair.dexId ?? "";
  const links = mergeLinks(
    readLinks([
      ...(pair.info?.websites ?? []).map((site) => ({ url: site.url })),
      ...(pair.info?.socials ?? []),
    ]),
    readLinks(profile?.links),
  );
  return {
    address,
    name,
    symbol,
    description: describe(name, symbol, dex, marketCap, profile?.description),
    image: pair.info?.imageUrl || iconUrl(profile?.icon),
    website: links.website,
    xUrl: links.xUrl,
    telegram: links.telegram,
    marketCap,
    dex,
    platform: platformOf(dex || "pump"),
  };
}

function coinFromJup(token: JupToken, profile?: DexProfile): LiveCoin | null {
  const address = token.id?.trim();
  const name = token.name?.trim();
  const symbol = token.symbol?.trim();
  if (!address || !name || !symbol) return null;
  const marketCap = typeof token.mcap === "number" ? token.mcap : null;
  const dex = token.launchpad ?? "";
  const links = readLinks(profile?.links);
  return {
    address,
    name,
    symbol,
    description: describe(name, symbol, dex, marketCap, profile?.description),
    image: iconUrl(profile?.icon) || token.icon || null,
    website: links.website,
    xUrl: links.xUrl,
    telegram: links.telegram,
    marketCap,
    dex,
    platform: platformOf(dex),
  };
}

async function dexByMint(address: string) {
  const rows = await fetchJson<DexPair[]>(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
  return Array.isArray(rows) ? rows.find((row) => row.baseToken?.address === address) ?? rows[0] ?? null : null;
}

async function dexByPair(address: string) {
  const data = await fetchJson<{ pair?: DexPair; pairs?: DexPair[] }>(
    `https://api.dexscreener.com/latest/dex/pairs/solana/${address}`,
  );
  return data?.pair ?? data?.pairs?.[0] ?? null;
}

async function dexBySearch(address: string) {
  const data = await fetchJson<{ pairs?: DexPair[] }>(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`,
  );
  const pairs = data?.pairs ?? [];
  return (
    pairs.find((pair) => pair.baseToken?.address === address || pair.pairAddress === address) ??
    (pairs.length === 1 ? pairs[0] : null)
  );
}

async function jupByQuery(address: string) {
  const rows = await fetchJson<JupToken[]>(
    `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(address)}`,
  );
  if (!rows?.length) return null;
  return rows.find((row) => row.id === address) ?? (rows.length === 1 ? rows[0] : null);
}

async function lookupAddress(raw: string): Promise<LiveCoin | null> {
  const query = extractSolAddress(raw);
  if (!query) return null;
  const profiles = await loadProfiles();
  const pair = (await dexByMint(query)) ?? (await dexByPair(query)) ?? (await dexBySearch(query));
  if (pair?.baseToken?.address) {
    return coinFromPair(pair, profileFor(profiles, pair.baseToken.address));
  }
  const jup = await jupByQuery(query);
  if (!jup?.id) return null;
  return coinFromJup(jup, profileFor(profiles, jup.id));
}

async function listCoins(): Promise<LiveCoin[]> {
  if (listCache && Date.now() - listCache.at < CACHE_MS) return listCache.coins;
  const profiles = await loadProfiles();
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const row of profiles) {
    const address = row.tokenAddress;
    if (!address || seen.has(address)) continue;
    seen.add(address);
    addresses.push(address);
    if (addresses.length >= 24) break;
  }
  const coins: LiveCoin[] = [];
  const seenCoins = new Set<string>();
  for (let i = 0; i < addresses.length; i += 30) {
    const chunk = addresses.slice(i, i + 30);
    const pairs = await fetchJson<DexPair[]>(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
    for (const pair of pairs ?? []) {
      const address = pair.baseToken?.address;
      if (!address || !chunk.includes(address) || seenCoins.has(address)) continue;
      const coin = coinFromPair(pair, profileFor(profiles, address));
      if (!coin) continue;
      seenCoins.add(address);
      coins.push(coin);
    }
  }
  const ranked = coins
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, LIST_LIMIT);
  listCache = { at: Date.now(), coins: ranked };
  return ranked;
}

export type DeskQuote = {
  priceSol: number | null;
  priceUsd: number | null;
  marketCap: number | null;
  volume5m: number | null;
  buys: number | null;
  sells: number | null;
  progress: number | null;
  liquiditySol: number | null;
  points: number[];
};

function num(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export const loadDesk = createServerFn({ method: "POST" })
  .validator((input: { mint: string; frame?: string }) => {
    const mint = String(input?.mint ?? "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) throw new Error("That mint is not a Solana address.");
    const frame = input?.frame === "5" ? "5" : "1";
    return { mint, frame };
  })
  .handler(async ({ data }): Promise<DeskQuote> => {
    const empty: DeskQuote = {
      priceSol: null,
      priceUsd: null,
      marketCap: null,
      volume5m: null,
      buys: null,
      sells: null,
      progress: null,
      liquiditySol: null,
      points: [],
    };
    const pairs = await fetchJson<
      {
        priceNative?: string;
        priceUsd?: string;
        marketCap?: number;
        fdv?: number;
        volume?: { m5?: number };
        txns?: { m5?: { buys?: number; sells?: number } };
        liquidity?: { quote?: number };
        baseToken?: { address?: string };
      }[]
    >(`https://api.dexscreener.com/tokens/v1/solana/${data.mint}`);
    const pair = Array.isArray(pairs) ? pairs.find((row) => row.baseToken?.address === data.mint) ?? pairs[0] : null;
    const quote: DeskQuote = pair
      ? {
          ...empty,
          priceSol: num(pair.priceNative),
          priceUsd: num(pair.priceUsd),
          marketCap: pair.marketCap ?? pair.fdv ?? null,
          volume5m: pair.volume?.m5 ?? null,
          buys: pair.txns?.m5?.buys ?? null,
          sells: pair.txns?.m5?.sells ?? null,
          liquiditySol: pair.liquidity?.quote ?? null,
        }
      : { ...empty };

    const pump = await fetchJson<{ complete?: boolean; real_sol_reserves?: number | string; usd_market_cap?: number }>(
      `https://frontend-api-v3.pump.fun/coins/${data.mint}`,
    );
    if (pump) {
      if (pump.complete) quote.progress = 100;
      else {
        const raw = num(pump.real_sol_reserves);
        const solReserves = raw == null ? null : raw > 1_000 ? raw / 1e9 : raw;
        if (solReserves != null) quote.progress = Math.max(0, Math.min(100, (solReserves / 85) * 100));
      }
      if (quote.marketCap == null && pump.usd_market_cap) quote.marketCap = pump.usd_market_cap;
    }

    const pools = await fetchJson<{ data?: { attributes?: { address?: string } }[] }>(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${data.mint}/pools?page=1`,
    );
    const pool = pools?.data?.[0]?.attributes?.address;
    if (pool) {
      const candles = await fetchJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/minute?aggregate=${data.frame}&limit=48&currency=usd`,
      );
      const rows = candles?.data?.attributes?.ohlcv_list ?? [];
      quote.points = rows
        .map((row) => row[4])
        .filter((value) => typeof value === "number" && Number.isFinite(value))
        .reverse();
    }
    if (quote.points.length === 0 && quote.priceUsd) quote.points = [quote.priceUsd];
    return quote;
  });

export const listLiveCoins = createServerFn({ method: "POST" }).handler(async () => listCoins());

export const lookupLiveCoin = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => {
    const query = typeof input?.query === "string" ? input.query.trim().slice(0, 220) : "";
    if (!query) throw new Error("Paste a token address.");
    return { query };
  })
  .handler(async ({ data }) => lookupAddress(data.query));
