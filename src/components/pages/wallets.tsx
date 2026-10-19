import { useState } from "react";
import { toast } from "sonner";
import { shortAddr, sol } from "@/lib/format";
import { useVeln } from "@/store/veln";
import { Button, PageIntro, SolGlyph } from "@/components/ui";
import { CreateWalletModal, FundWalletModal, ImportWalletModal, exportWallets } from "@/components/wallet-dialogs";

export function WalletsPage() {
  const wallets = useVeln((s) => s.wallets);
  const hide = useVeln((s) => s.settings.hideBalances);
  const remove = useVeln((s) => s.removeWallet);
  const main = useVeln((s) => s.mainBalance);
  const [create, setCreate] = useState(false);
  const [imp, setImp] = useState(false);
  const [fund, setFund] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const list = wallets.filter((w) => `${w.name} ${w.address}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageIntro kicker="Account" title="Wallets" sub="Create gives a real seed. Export downloads that seed so you can open the same wallet in Phantom." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setCreate(true)}>Create</Button>
        <Button variant="ghost" onClick={() => setImp(true)}>Import seed</Button>
        <Button variant="ghost" onClick={exportWallets}>Export</Button>
        <span className="ml-auto text-sm text-muted">Connected {hide ? "••••" : `${sol(main, 4)} SOL`}</span>
      </div>
      <input
        className="mb-3 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-gold"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-2">
        {list.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{w.name}</p>
              <p className="font-mono text-xs text-faint">{shortAddr(w.address)}{w.mnemonic || w.secretKey ? " · seed saved" : " · no seed"}</p>
            </div>
            <p className="flex items-center gap-1 font-mono text-sm tabular-nums">
              <SolGlyph className="size-3.5 text-gold" />
              {hide ? "••••" : `${sol(w.balance, 4)} SOL`}
            </p>
            <Button variant="ghost" className="min-h-9" onClick={() => setFund(w.id)}>Fund</Button>
            <Button
              variant="ghost"
              className="min-h-9"
              onClick={() => {
                void navigator.clipboard.writeText(w.address).then(
                  () => toast.success("Address copied"),
                  () => toast.error("Couldn't copy"),
                );
              }}
            >
              Copy
            </Button>
            <Button
              variant="danger"
              className="min-h-9"
              onClick={() => {
                remove(w.id);
                toast("Wallet removed from the desk");
              }}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <CreateWalletModal open={create} onClose={() => setCreate(false)} />
      <ImportWalletModal open={imp} onClose={() => setImp(false)} />
      <FundWalletModal open={fund !== null} walletId={fund} onClose={() => setFund(null)} />
    </div>
  );
}
