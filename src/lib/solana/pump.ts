import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";

const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fromBase64(value: string) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

type BuildInput = {
  kind: "create" | "buy" | "sell";
  publicKey: string;
  mint: string;
  name: string;
  symbol: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  amount: number | string;
  denominatedInSol: boolean;
  slippage: number;
  priorityFee: number;
  imageBase64: string | null;
  imageUrl: string | null;
};

function pubkey(value: string, label: string) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`${label} is not a Solana address.`);
  }
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

async function imageBlob(imageBase64: string | null, imageUrl: string | null) {
  if (imageBase64) {
    const match = imageBase64.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Upload a PNG, JPG, or WEBP.");
    const bytes = fromBase64(match[2]);
    if (bytes.length > 1_200_000) throw new Error("Image must be under 1.2 MB.");
    return new Blob([bytes], { type: match[1] || "image/png" });
  }
  if (imageUrl) {
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      throw new Error("Token image link is not a URL.");
    }
    if (url.protocol !== "https:") throw new Error("Token image must be https.");
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return new Blob([fromBase64(TINY_PNG_B64)], { type: "image/png" });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 1_200_000) throw new Error("Image must be under 1.2 MB.");
    const type = (res.headers.get("content-type") || "image/png").split(";")[0];
    return new Blob([bytes], { type });
  }
  return new Blob([fromBase64(TINY_PNG_B64)], { type: "image/png" });
}

async function uploadMetadata(input: BuildInput) {
  const file = await imageBlob(input.imageBase64, input.imageUrl);
  const form = new FormData();
  form.set("file", file, "logo.png");
  form.set("name", clean(input.name, 32));
  form.set("symbol", clean(input.symbol, 10));
  form.set("description", clean(input.description, 500));
  form.set("twitter", clean(input.twitter, 120));
  form.set("telegram", clean(input.telegram, 120));
  form.set("website", clean(input.website, 120));
  form.set("showName", "true");
  const res = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 180) || "Pump.fun refused the metadata upload.");
  let body: { metadataUri?: string };
  try {
    body = JSON.parse(text) as { metadataUri?: string };
  } catch {
    throw new Error("Pump.fun returned metadata we couldn't read.");
  }
  if (!body.metadataUri) throw new Error("Pump.fun did not return a metadata URI.");
  return body.metadataUri;
}

async function buildTx(input: BuildInput) {
  const owner = pubkey(input.publicKey, "Phantom wallet");
  const mint = pubkey(input.mint, "Mint");
  const slippage = Math.min(100, Math.max(1, Math.round(input.slippage)));
  const priorityFee = Math.min(0.05, Math.max(0.00001, input.priorityFee));
  const payload: Record<string, unknown> = {
    publicKey: owner,
    action: input.kind === "sell" ? "sell" : input.kind === "buy" ? "buy" : "create",
    mint,
    denominatedInSol: input.denominatedInSol ? "true" : "false",
    amount: input.kind === "sell" ? input.amount : Number(input.amount),
    slippage,
    priorityFee,
    pool: input.kind === "create" ? "pump" : "auto",
  };
  if (input.kind === "create") {
    const uri = await uploadMetadata(input);
    payload.tokenMetadata = {
      name: clean(input.name, 32),
      symbol: clean(input.symbol, 10).toUpperCase(),
      uri,
    };
  }
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 220) || "Pump rejected the transaction.");
  }
  const tx = toBase64(new Uint8Array(await res.arrayBuffer()));
  if (tx.length < 20) throw new Error("Pump returned an empty transaction.");
  return { tx, metadataUri: typeof payload.tokenMetadata === "object" ? (payload.tokenMetadata as { uri?: string }).uri ?? "" : "" };
}

export const buildPumpTx = createServerFn({ method: "POST" })
  .validator((input: BuildInput) => {
    if (!input || (input.kind !== "create" && input.kind !== "buy" && input.kind !== "sell")) {
      throw new Error("Unknown trade.");
    }
    return {
      kind: input.kind,
      publicKey: String(input.publicKey ?? "").trim(),
      mint: String(input.mint ?? "").trim(),
      name: String(input.name ?? ""),
      symbol: String(input.symbol ?? ""),
      description: String(input.description ?? ""),
      website: String(input.website ?? ""),
      twitter: String(input.twitter ?? ""),
      telegram: String(input.telegram ?? ""),
      amount: input.kind === "sell" ? String(input.amount ?? "100%").slice(0, 16) : Number(input.amount),
      denominatedInSol: Boolean(input.denominatedInSol),
      slippage: Number(input.slippage) || 10,
      priorityFee: Number(input.priorityFee) || 0.0005,
      imageBase64: typeof input.imageBase64 === "string" && input.imageBase64.length < 1_800_000 ? input.imageBase64 : null,
      imageUrl: typeof input.imageUrl === "string" ? input.imageUrl.slice(0, 400) : null,
    };
  })
  .handler(async ({ data }) => buildTx(data));
