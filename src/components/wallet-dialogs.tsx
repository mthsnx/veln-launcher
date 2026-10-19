import { useState } from "react";
import { toast } from "sonner";
import { sol } from "@/lib/format";
import { useVeln } from "@/store/veln";
import { Button, Modal, fieldClass } from "@/components/ui";

export function CreateWalletModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const createWallet = useVeln((s) => s.createWallet);
  return (
    <Modal open={open} title="Create wallets" onClose={onClose}>
      <h2 className="text-lg font-semibold">Create wallets</h2>
      <p className="mt-1 text-sm text-muted">A real Solana wallet. The 12-word seed stays in this browser and is included when you export.</p>
      <label className="mt-4 block text-sm">
        Name prefix
        <input className={`${fieldClass} mt-2`} value={name} placeholder="Wallet" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        How many
        <input className={`${fieldClass} mt-2 font-mono`} type="number" min={1} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            const n = Math.min(12, Math.max(1, count || 1));
            let last = "";
            for (let i = 0; i < n; i++) {
              const label = n === 1 ? name || "Wallet" : `${name || "Wallet"} ${i + 1}`;
              last = createWallet(label).id;
            }
            toast.success(n === 1 ? "Wallet created" : `${n} wallets created`);
            if (last) onCreated?.(last);
            setName("");
            onClose();
          }}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
}

export function ImportWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [material, setMaterial] = useState("");
  const importKey = useVeln((s) => s.importKey);
  return (
    <Modal open={open} title="Import wallet" onClose={onClose}>
      <h2 className="text-lg font-semibold">Import a seed or private key</h2>
      <p className="mt-1 text-sm text-muted">Paste a 12-word seed or a Phantom private key. It stays in this browser. Don't paste a seed you don't control.</p>
      <label className="mt-4 block text-sm">
        Label
        <input className={`${fieldClass} mt-2`} value={name} placeholder="Imported" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        Seed phrase or private key
        <textarea className={`${fieldClass} mt-2 min-h-24 font-mono`} value={material} placeholder="word word word …" onChange={(e) => setMaterial(e.target.value)} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            const res = importKey(name, material);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Wallet imported. The seed is saved on this desk.");
              setMaterial("");
              setName("");
              onClose();
            }
          }}
        >
          Import
        </Button>
      </div>
    </Modal>
  );
}

export function FundWalletModal({ open, onClose, walletId }: { open: boolean; onClose: () => void; walletId: string | null }) {
  const wallets = useVeln((s) => s.wallets);
  const main = useVeln((s) => s.mainBalance);
  const hide = useVeln((s) => s.settings.hideBalances);
  const [id, setId] = useState(walletId ?? wallets[0]?.id ?? "");
  const [amount, setAmount] = useState("0.1");
  const selected = walletId ?? id;
  return (
    <Modal open={open} title="Fund wallet" onClose={onClose}>
      <h2 className="text-lg font-semibold">Send SOL</h2>
      <p className="mt-1 text-sm text-muted">
        Available {hide ? "••••" : `${sol(main, 4)} SOL`}. Phantom signs a real transfer to that address.
      </p>
      {!walletId ? (
        <label className="mt-4 block text-sm">
          Wallet
          <select className={`${fieldClass} mt-2`} value={id} onChange={(e) => setId(e.target.value)}>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {sol(w.balance, 4)} SOL
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="mt-3 block text-sm">
        Amount (SOL)
        <input className={`${fieldClass} mt-2 font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            const target = useVeln.getState().wallets.find((w) => w.id === selected);
            if (!target) {
              toast.error("Pick a wallet with a real address.");
              return;
            }
            const solAmount = Number(amount);
            void (async () => {
              try {
                const { transferSol, solBalance } = await import("@/lib/solana/phantom");
                const payer = useVeln.getState().mainAddress;
                if (!payer) throw new Error("Connect Phantom first.");
                const sig = await transferSol(payer, target.address, solAmount);
                const balance = await solBalance(payer);
                useVeln.getState().connectLive(payer, balance);
                const dest = await solBalance(target.address);
                useVeln.getState().setWalletBalance(target.address, dest);
                toast.success(`Sent · ${sig.slice(0, 8)}`);
                onClose();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Transfer failed");
              }
            })();
          }}
        >
          Transfer
        </Button>
      </div>
    </Modal>
  );
}

export function exportWallets() {
  const wallets = useVeln.getState().wallets.map(({ name, address, balance, mnemonic, secretKey }) => ({
    name,
    address,
    balance,
    mnemonic: mnemonic || null,
    secretKey: secretKey || null,
  }));
  const withSeed = wallets.filter((w) => w.mnemonic || w.secretKey).length;
  const blob = new Blob(
    [JSON.stringify({ warning: "This file controls the SOL in these wallets. Import the seed phrase in Phantom.", wallets }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "veln-wallets.json";
  a.click();
  URL.revokeObjectURL(url);
  toast.success(withSeed ? `Exported ${withSeed} seed${withSeed === 1 ? "" : "s"}` : "No seeds to export yet");
}
