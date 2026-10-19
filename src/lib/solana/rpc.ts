import { createServerFn } from "@tanstack/react-start";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last = "Solana RPC refused the request.";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await res.json()) as { result?: T; error?: { message?: string } };
      if (!res.ok || body.error || body.result === undefined) {
        throw new Error(body.error?.message || `RPC ${res.status}`);
      }
      return body.result;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

export const accountBalance = createServerFn({ method: "POST" })
  .validator((input: { address: string }) => {
    const address = String(input?.address ?? "").trim();
    if (address.length < 32 || address.length > 48) throw new Error("That is not a Solana address.");
    return { address };
  })
  .handler(async ({ data }) => {
    const result = await rpc<{ value: number }>("getBalance", [data.address, { commitment: "confirmed" }]);
    return result.value / 1e9;
  });

export const accountBlockhash = createServerFn({ method: "POST" }).handler(async () => {
  const result = await rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [
    { commitment: "confirmed" },
  ]);
  return result.value;
});

export const submitSignedTx = createServerFn({ method: "POST" })
  .validator((input: { tx: string }) => {
    const tx = String(input?.tx ?? "").trim();
    if (tx.length < 20 || tx.length > 20_000) throw new Error("Signed transaction is empty.");
    return { tx };
  })
  .handler(async ({ data }) => {
    const signature = await rpc<string>("sendTransaction", [
      data.tx,
      { encoding: "base64", skipPreflight: false, maxRetries: 3, preflightCommitment: "confirmed" },
    ]);
    for (let i = 0; i < 20; i += 1) {
      const status = await rpc<{ value: [{ err: unknown; confirmationStatus?: string } | null] }>("getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: false },
      ]);
      const row = status.value?.[0];
      if (row?.err) throw new Error("The transaction landed but failed on Solana.");
      if (row?.confirmationStatus === "confirmed" || row?.confirmationStatus === "finalized") return signature;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return signature;
  });
