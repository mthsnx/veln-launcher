import { capitalOf } from "@/lib/plan";
import { useVeln } from "@/store/veln";
import { round } from "@/lib/utils";
import { DEFAULT_LAUNCH_FEE_BPS, DEFAULT_PROFIT_FEE_BPS, FEE_WALLET, launchFeeSol, profitFeeSol } from "@/lib/solana/fees";
import { connectPhantom, newMint, signPumpBatch, signPumpTx, solBalance, submitLocalTx, transferFromSecret, transferSol } from "@/lib/solana/phantom";
import { buildPumpTx } from "@/lib/solana/pump";
import type { Project } from "@/lib/types";

function imagePayload(image: string | null) {
  if (!image) return { imageBase64: null, imageUrl: null };
  if (image.startsWith("data:")) return { imageBase64: image, imageUrl: null };
  if (image.startsWith("https://")) return { imageBase64: null, imageUrl: image };
  return { imageBase64: null, imageUrl: null };
}

function feeWallet() {
  return FEE_WALLET;
}

export async function refreshLiveBalance() {
  const { connected, mainAddress, connectLive } = useVeln.getState();
  if (!connected || !mainAddress) return 0;
  const balance = await solBalance(mainAddress);
  connectLive(mainAddress, balance);
  return balance;
}

export async function attachPhantom(onlyIfTrusted = false) {
  const address = await connectPhantom(onlyIfTrusted);
  const balance = await solBalance(address);
  useVeln.getState().connectLive(address, balance);
  return address;
}

export async function runLiveLaunch() {
  const state = useVeln.getState();
  const draft = state.draft;
  if (!state.connected || !state.mainAddress) {
    await attachPhantom(false);
  }
  const payer = useVeln.getState().mainAddress;
  if (!payer) throw new Error("Connect Phantom first.");
  const spend = round(Math.max(capitalOf(draft), Number(draft.devBudget) || 0));
  if (spend < 0.01) throw new Error("Set a buy of at least 0.01 SOL.");
  if (draft.style !== "cto" && draft.platform !== "Pump.fun") {
    throw new Error("Live mints go through Pump.fun. Pick that pad.");
  }
  if (draft.style === "cto" && !draft.sourceAddress) {
    throw new Error("Paste the coin's contract address. A takeover buys that mint. It does not create a new one.");
  }
  if (!draft.name.trim() || !draft.symbol.trim()) throw new Error("Name and ticker are required.");

  const treasury = feeWallet();
  const fee = launchFeeSol(spend, DEFAULT_LAUNCH_FEE_BPS);
  const balance = await solBalance(payer);
  const need = spend + fee + 0.02;
  if (balance + 1e-9 < need) {
    throw new Error(`Phantom has ${balance.toFixed(3)} SOL. This needs about ${need.toFixed(3)} SOL including the ${fee} SOL fee.`);
  }

  const creating = draft.style !== "cto";
  const mintKey = creating ? newMint() : null;
  const mint = mintKey ? mintKey.publicKey.toBase58() : draft.sourceAddress;
  const priorityFee = Math.min(0.05, Math.max(0.00005, Number(draft.jitoTip) || 0.0005));
  const built = await buildPumpTx({
    data: {
      kind: creating ? "create" : "buy",
      publicKey: payer,
      mint,
      name: draft.name,
      symbol: draft.symbol,
      description: draft.description,
      website: draft.website,
      twitter: draft.xUrl,
      telegram: draft.telegram,
      amount: spend,
      denominatedInSol: true,
      slippage: draft.slippage,
      priorityFee,
      ...imagePayload(draft.image),
    },
  });

  const feeSignature = "";
  let signature = "";
  try {
    signature = await signPumpTx(built.tx, mintKey ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Launch failed.";
    throw new Error(message);
  }

  let paidFee = feeSignature;
  try {
    paidFee = await transferSol(payer, treasury, fee);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fee transfer failed.";
    const nextBalance = await solBalance(payer).catch(() => balance);
    useVeln.getState().recordLiveLaunch({
      mint,
      signature,
      feeSignature: "",
      spentSol: spend,
      balance: nextBalance,
    });
    throw new Error(`The coin is live (${mint}). The ${fee} SOL fee did not send: ${message}`);
  }

  const nextBalance = await solBalance(payer);
  const id = useVeln.getState().recordLiveLaunch({
    mint,
    signature,
    feeSignature: paidFee,
    spentSol: spend,
    balance: nextBalance,
  });
  return { id, mint, signature };
}

export async function runSpamBatch(input: {
  base: string;
  symbol: string;
  description: string;
  image: string | null;
  count: number;
  each: string;
}) {
  const state = useVeln.getState();
  if (!state.connected || !state.mainAddress) await attachPhantom(false);
  const payer = useVeln.getState().mainAddress;
  if (!payer) throw new Error("Connect Phantom first.");
  const count = Math.min(10, Math.max(1, Math.floor(input.count) || 1));
  const spend = round(Number(input.each) || 0);
  if (spend < 0.01) throw new Error("Set a buy of at least 0.01 SOL on each mint.");
  const base = input.base.trim();
  const ticker = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!base || !ticker) throw new Error("Name and ticker are required.");

  const coins = Array.from({ length: count }, (_, i) => ({
    name: `${base} ${i + 1}`.slice(0, 32),
    symbol: `${ticker}${i + 1}`.slice(0, 10),
  }));
  const settings = useVeln.getState().settings;
  const feeEach = launchFeeSol(spend, DEFAULT_LAUNCH_FEE_BPS);
  const treasury = feeWallet();
  const balance = await solBalance(payer);
  const need = count * (spend + feeEach + 0.02);
  if (balance + 1e-9 < need) {
    throw new Error(`Phantom has ${balance.toFixed(3)} SOL. ${count} mints need about ${need.toFixed(3)} SOL including fees.`);
  }

  const draft = useVeln.getState().draft;
  const priorityFee = Math.min(0.05, Math.max(0.00005, Number(draft.jitoTip) || 0.0005));
  const slippage = draft.slippage || settings.defaultSlippage || 10;
  const picture = imagePayload(input.image);
  const ready = await Promise.all(
    coins.map(async (coin) => {
      const mintKey = newMint();
      const built = await buildPumpTx({
        data: {
          kind: "create",
          publicKey: payer,
          mint: mintKey.publicKey.toBase58(),
          name: coin.name,
          symbol: coin.symbol,
          description: input.description,
          website: "",
          twitter: "",
          telegram: "",
          amount: spend,
          denominatedInSol: true,
          slippage,
          priorityFee,
          ...picture,
        },
      });
      return { ...coin, mintKey, mint: mintKey.publicKey.toBase58(), tx: built.tx };
    }),
  );

  const signatures = await signPumpBatch(ready.map((coin) => ({ txBase64: coin.tx, mint: coin.mintKey })));
  const landed = ready.filter((_, i) => signatures[i]);
  if (landed.length === 0) throw new Error("None of the mints landed. Phantom may have rejected the batch.");

  let feeSignature = "";
  const fee = round(feeEach * landed.length);
  try {
    feeSignature = await transferSol(payer, treasury, fee);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fee transfer failed.";
    const nextBalance = await solBalance(payer).catch(() => balance);
    for (let i = 0; i < ready.length; i += 1) {
      const signature = signatures[i];
      if (!signature) continue;
      useVeln.getState().recordLiveLaunch({
        mint: ready[i].mint,
        signature,
        feeSignature: "",
        spentSol: spend,
        balance: nextBalance,
        name: ready[i].name,
        symbol: ready[i].symbol,
      });
    }
    throw new Error(`${landed.length} coins are live. The ${fee} SOL fee did not send: ${message}`);
  }

  const nextBalance = await solBalance(payer);
  const ids: string[] = [];
  for (let i = 0; i < ready.length; i += 1) {
    const signature = signatures[i];
    if (!signature) continue;
    ids.push(
      useVeln.getState().recordLiveLaunch({
        mint: ready[i].mint,
        signature,
        feeSignature,
        spentSol: spend,
        balance: nextBalance,
        name: ready[i].name,
        symbol: ready[i].symbol,
      }),
    );
  }
  const missed = count - landed.length;
  return { count: landed.length, missed, ids };
}

export async function sellLive(project: Project) {
  if (!project.mint) throw new Error("This card has no on-chain mint.");
  const state = useVeln.getState();
  if (!state.connected || !state.mainAddress) await attachPhantom(false);
  const payer = useVeln.getState().mainAddress;
  const before = await solBalance(payer);
  const built = await buildPumpTx({
    data: {
      kind: "sell",
      publicKey: payer,
      mint: project.mint,
      name: project.name,
      symbol: project.symbol,
      description: "",
      website: "",
      twitter: "",
      telegram: "",
      amount: "100%",
      denominatedInSol: false,
      slippage: state.settings.defaultSlippage,
      priorityFee: 0.0005,
      imageBase64: null,
      imageUrl: null,
    },
  });
  const signature = await signPumpTx(built.tx);
  const afterSell = await solBalance(payer);
  const received = Math.max(0, afterSell - before);
  const profit = round(received - project.spentSol);
  const fee = profitFeeSol(profit, DEFAULT_PROFIT_FEE_BPS);
  let feeSignature = "";
  if (fee > 0) {
    feeSignature = await transferSol(payer, feeWallet(), fee);
  }
  const balance = await solBalance(payer);
  const pnl = round(profit - fee);
  useVeln.getState().applyLivePnl({
    projectId: project.id,
    pnlSol: pnl,
    balance,
    title: fee > 0 ? "Sold · fee taken" : "Sold",
    subtitle: fee > 0 ? `${project.symbol} · fee ${fee} SOL` : `${project.symbol} · ${signature.slice(0, 8)}`,
  });
  return { signature, feeSignature, pnl, fee };
}

export async function tradeDesk(input: {
  projectId: string;
  mint: string;
  name: string;
  symbol: string;
  side: "buy" | "sell";
  amount: number | string;
  owner: string;
  secretKey?: string;
}) {
  if (!useVeln.getState().connected) await attachPhantom(false);
  const isBuy = input.side === "buy";
  const spend = isBuy ? round(Number(input.amount) || 0) : 0;
  if (isBuy && spend < 0.01) throw new Error("Buy at least 0.01 SOL.");
  const settings = useVeln.getState().settings;
  const fee = isBuy ? launchFeeSol(spend, DEFAULT_LAUNCH_FEE_BPS) : 0;
  if (isBuy) {
    const balance = await solBalance(input.owner);
    if (balance + 1e-9 < spend + fee + 0.005) {
      throw new Error(`That wallet has ${balance.toFixed(3)} SOL. This buy needs about ${(spend + fee).toFixed(3)} SOL.`);
    }
  }
  const built = await buildPumpTx({
    data: {
      kind: input.side,
      publicKey: input.owner,
      mint: input.mint,
      name: input.name,
      symbol: input.symbol,
      description: "",
      website: "",
      twitter: "",
      telegram: "",
      amount: isBuy ? spend : String(input.amount),
      denominatedInSol: isBuy,
      slippage: settings.defaultSlippage || 15,
      priorityFee: 0.0005,
      imageBase64: null,
      imageUrl: null,
    },
  });
  const signature = input.secretKey ? await submitLocalTx(built.tx, input.secretKey) : await signPumpTx(built.tx);
  if (isBuy) {
    try {
      if (fee > 0) {
        if (input.secretKey) await transferFromSecret(input.secretKey, feeWallet(), fee);
        else await transferSol(input.owner, feeWallet(), fee);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fee transfer failed.";
      useVeln.getState().noteSpend(input.projectId, spend);
      useVeln.getState().pushActivity("Buy", `${input.symbol} · ${spend} SOL`, 0, input.projectId);
      throw new Error(`The buy landed. The ${fee} SOL fee did not send: ${message}`);
    }
    useVeln.getState().noteSpend(input.projectId, spend);
  }
  if (input.owner === useVeln.getState().mainAddress) {
    useVeln.getState().connectLive(input.owner, await solBalance(input.owner));
  } else {
    useVeln.getState().setWalletBalance(input.owner, await solBalance(input.owner));
  }
  useVeln.getState().pushActivity(
    isBuy ? "Buy" : "Sell",
    `${input.symbol} · ${isBuy ? `${spend} SOL` : input.amount} · ${signature.slice(0, 8)}`,
    0,
    input.projectId,
  );
  return signature;
}
