import { Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { accountBalance, accountBlockhash, submitSignedTx } from "@/lib/solana/rpc";
import { useVeln } from "@/store/veln";

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

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
};

function provider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const sol = (window as Window & { solana?: PhantomProvider }).solana;
  return sol?.isPhantom ? sol : null;
}

export function phantomInstalled() {
  return Boolean(provider());
}

export async function connectPhantom(onlyIfTrusted = false) {
  const phantom = provider();
  if (!phantom) {
    throw new Error("Phantom isn't in this window. Install it, then open the site in its own tab. The preview frame can't see the extension.");
  }
  if (!onlyIfTrusted && useVeln.getState().signedOut) {
    await phantom.disconnect().catch(() => undefined);
  }
  const res = await phantom.connect(onlyIfTrusted ? { onlyIfTrusted: true } : undefined);
  return res.publicKey.toString();
}

export async function disconnectPhantom() {
  const phantom = provider();
  if (!phantom) return;
  await phantom.disconnect().catch(() => undefined);
}

export async function solBalance(address: string) {
  return accountBalance({ data: { address } });
}

async function sendSigned(raw: Uint8Array) {
  return submitSignedTx({ data: { tx: toBase64(raw) } });
}

export async function transferSol(from: string, to: string, sol: number) {
  if (!(sol > 0)) throw new Error("Amount must be greater than zero.");
  const phantom = provider();
  if (!phantom) throw new Error("Connect Phantom first.");
  const latest = await accountBlockhash();
  const tx = new Transaction({ feePayer: new PublicKey(from), ...latest });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(from),
      toPubkey: new PublicKey(to),
      lamports: Math.round(sol * 1e9),
    }),
  );
  const signed = await phantom.signTransaction(tx);
  return sendSigned(signed.serialize());
}

export async function signPumpTx(txBase64: string, mint?: Keypair) {
  const [signature] = await signPumpBatch([{ txBase64, mint }]);
  if (!signature) throw new Error("The transaction did not land.");
  return signature;
}

export async function signPumpBatch(items: { txBase64: string; mint?: Keypair }[]) {
  const phantom = provider();
  if (!phantom) throw new Error("Connect Phantom first.");
  if (items.length === 0) throw new Error("Nothing to sign.");
  const txs = items.map((item) => {
    const tx = VersionedTransaction.deserialize(fromBase64(item.txBase64));
    if (item.mint) tx.sign([item.mint]);
    return tx;
  });
  const signed = phantom.signAllTransactions
    ? await phantom.signAllTransactions(txs)
    : await txs.reduce<Promise<VersionedTransaction[]>>(async (acc, tx) => {
        const list = await acc;
        list.push(await phantom.signTransaction(tx));
        return list;
      }, Promise.resolve([]));
  const results = await Promise.allSettled(signed.map((tx) => sendSigned(tx.serialize())));
  return results.map((result) => (result.status === "fulfilled" ? result.value : ""));
}

export function newMint() {
  return Keypair.generate();
}

export async function submitLocalTx(txBase64: string, secretKey: string) {
  const owner = Keypair.fromSecretKey(bs58.decode(secretKey));
  const tx = VersionedTransaction.deserialize(fromBase64(txBase64));
  tx.sign([owner]);
  return sendSigned(tx.serialize());
}

export async function transferFromSecret(secretKey: string, to: string, solAmount: number) {
  if (!(solAmount > 0)) throw new Error("Amount must be greater than zero.");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKey));
  const latest = await accountBlockhash();
  const tx = new Transaction({ feePayer: owner.publicKey, ...latest });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: new PublicKey(to),
      lamports: Math.round(solAmount * 1e9),
    }),
  );
  tx.sign(owner);
  return sendSigned(tx.serialize());
}
