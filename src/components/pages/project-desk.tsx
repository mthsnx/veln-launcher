import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { loadDesk, type DeskQuote } from "@/lib/live-tokens";
import { relTime, shortAddr, signedSol, sol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { TokenMark } from "@/components/token-mark";
import { TradingViewChart } from "@/components/tv-chart";
import { Button, fieldClass } from "@/components/ui";

const BUYS = [0.1, 0.25, 0.5, 1];
const SELLS = ["25%", "50%", "75%", "100%"];

function money(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function ProjectDesk({ id }: { id: string }) {
  const project = useVeln((s) => s.projects.find((item) => item.id === id));
  const wallets = useVeln((s) => s.wallets);
  const main = useVeln((s) => s.mainAddress);
  const mainBalance = useVeln((s) => s.mainBalance);
  const activity = useVeln((s) => s.activity);
  const [quote, setQuote] = useState<DeskQuote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tool, setTool] = useState<"wallets" | "maker" | "bump" | "auto" | "smart" | "cleanup">("wallets");
  const [picked, setPicked] = useState<string[]>(["main"]);
  const [eachSol, setEachSol] = useState("0.05");
  const [times, setTimes] = useState(4);
  const [gap, setGap] = useState(8);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!project?.mint) return;
    let stop = false;
    const mint = project.mint;
    async function pull() {
      try {
        const next = await loadDesk({ data: { mint, frame: "1" } });
        if (!stop) setQuote(next);
      } catch {
        if (!stop) setQuote(null);
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 20_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [project?.mint]);

  if (!project) {
    return (
      <div>
        <Link to="/projects" className="text-sm text-gold">Back to projects</Link>
        <p className="mt-4 text-sm text-muted">That project isn't on this wallet.</p>
      </div>
    );
  }

  const coin = project;

  const mint = coin.mint ?? "";
  const trades = activity.filter((item) => item.projectId === coin.id || (mint && item.subtitle.includes(mint.slice(0, 6))));
  const buys = quote?.buys ?? null;
  const sells = quote?.sells ?? null;
  const buyPct = buys != null && sells != null && buys + sells > 0 ? Math.round((buys / (buys + sells)) * 100) : null;
  const rows = [
    { id: "main", name: "Dev", address: main, balance: mainBalance, secretKey: undefined as string | undefined, role: "Dev" },
    ...wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      address: wallet.address,
      balance: wallet.balance,
      secretKey: wallet.secretKey,
      role: "Bundle",
    })),
  ].filter((row) => row.address);

  async function trade(rowId: string, side: "buy" | "sell", amount: number | string, quiet = false) {
    if (!mint) {
      toast.error("This project has no mint.");
      return false;
    }
    const row = rows.find((item) => item.id === rowId);
    if (!row?.address) return false;
    if (row.id !== "main" && !row.secretKey) {
      toast.error("Import that wallet's seed before it can trade.");
      return false;
    }
    if (!quiet) setBusy(`${rowId}-${side}-${amount}`);
    try {
      const { tradeDesk } = await import("@/lib/solana/run-launch");
      const signature = await tradeDesk({
        projectId: coin.id,
        mint,
        name: coin.name,
        symbol: coin.symbol,
        side,
        amount,
        owner: row.address,
        secretKey: row.secretKey,
      });
      if (!quiet) toast.success(`${side === "buy" ? "Bought" : "Sold"} · ${signature.slice(0, 8)}`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade failed");
      return false;
    } finally {
      if (!quiet) setBusy(null);
    }
  }

  async function sellGroup(keepDev: boolean) {
    const targets = rows.filter((row) => (keepDev ? row.id !== "main" : true) && (row.id === "main" || row.secretKey));
    if (targets.length === 0) {
      toast.error(keepDev ? "No bundle wallet has a seed." : "Nothing to sell.");
      return;
    }
    for (const row of targets) {
      await trade(row.id, "sell", "100%");
    }
  }

  async function runBuys(kind: "maker" | "bump") {
    const chosen = rows.filter((row) => picked.includes(row.id));
    if (chosen.length === 0) {
      toast.error("Select at least one wallet.");
      return;
    }
    const size = Number(eachSol);
    if (!(size >= 0.01)) {
      toast.error("Each buy needs at least 0.01 SOL.");
      return;
    }
    const loops = kind === "bump" ? Math.min(12, Math.max(1, Math.floor(times) || 1)) : 1;
    const wait = Math.max(2, Math.floor(gap) || 2) * 1000;
    stopRef.current = false;
    setBusy("batch");
    let filled = 0;
    try {
      for (let i = 0; i < loops && !stopRef.current; i += 1) {
        for (const row of chosen) {
          if (stopRef.current) break;
          const ok = await trade(row.id, "buy", size, true);
          if (!ok) {
            stopRef.current = true;
            break;
          }
          filled += 1;
          if (kind === "bump" || chosen.length > 1) {
            await new Promise((resolve) => window.setTimeout(resolve, wait));
          }
        }
      }
      toast.success(stopRef.current ? `Stopped after ${filled} buys` : `${filled} buys filled`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="-mx-2 sm:-mx-4">
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.15fr)]">
        <section className="rounded-xl border border-line bg-bg-elev">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
              <ArrowLeft className="size-4" />
              Token details
            </Link>
            <Link to="/flex" search={{ id: coin.id }} className="rounded-md border border-line px-2.5 py-1 text-[11px] tracking-widest text-muted uppercase hover:text-fg">
              Flex PnL
            </Link>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {coin.image ? (
                <img src={coin.image} alt="" className="size-12 rounded-lg object-cover" />
              ) : (
                <TokenMark seed={coin.symbol} className="size-12" />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{coin.name} <span className="text-muted">${coin.symbol}</span></h1>
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-faint hover:text-fg"
                  onClick={() => {
                    if (!mint) return;
                    void navigator.clipboard.writeText(mint).then(
                      () => toast.success("Mint copied"),
                      () => toast.error("Couldn't copy"),
                    );
                  }}
                >
                  {mint ? shortAddr(mint) : "No mint"}
                  <Copy className="size-3" />
                </button>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {mint ? (
                    <a className="text-gold hover:underline" href={`https://pump.fun/coin/${mint}`} target="_blank" rel="noreferrer">Pump.fun</a>
                  ) : null}
                  {mint ? (
                    <a className="text-muted hover:text-fg" href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer">Chart</a>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-medium tabular-nums">{money(quote?.marketCap ?? null)}</p>
              <p className={cn("mt-1 font-mono text-sm tabular-nums", coin.pnlSol >= 0 ? "text-gain" : "text-loss")}>
                Net PnL {signedSol(coin.pnlSol)} SOL
              </p>
              <p className="text-xs text-faint">Spent {sol(coin.spentSol, 3)} SOL</p>
            </div>
          </div>

          <div className="px-3 pb-3">
            {mint ? (
              <TradingViewChart mint={mint} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">This project has no mint, so there is no chart.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
            <Stat label="Trades 5m" value={buys != null && sells != null ? String(buys + sells) : "—"} />
            <Stat label="Buy %" value={buyPct == null ? "—" : `${buyPct}%`} tone={buyPct != null && buyPct >= 50 ? "up" : "down"} />
            <Stat label="Vol 5m" value={quote?.volume5m != null ? money(quote.volume5m) : "—"} />
            <Stat label="Holders" value="—" />
            <Stat label="Dev held" value="—" />
            <Stat label="Top 10" value="—" />
          </div>

          <div className="px-4 py-4">
            <div className="mb-1 flex items-center justify-between text-xs text-faint">
              <span>Bonding curve</span>
              <span>{quote?.progress == null ? "—" : `${quote.progress.toFixed(1)}%`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-gold" style={{ width: `${quote?.progress ?? 0}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Pair label="Bought" value={`${sol(coin.spentSol, 3)} SOL`} tone="up" />
              <Pair label="Sold" value={trades.some((item) => item.title.startsWith("Sell")) ? "See trades" : "0 SOL"} tone="down" />
              <Pair label="Value" value={quote?.liquiditySol != null ? `${sol(quote.liquiditySol, 3)} SOL` : "—"} />
              <Pair label="Supply" value="—" />
            </div>
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">Recent trades</h2>
              <span className="text-xs text-faint">{trades.length}</span>
            </div>
            {trades.length === 0 ? (
              <p className="pb-2 text-sm text-muted">No trades from this desk yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {trades.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-14 text-xs text-faint">{relTime(item.createdAt)}</span>
                    <span className={cn("w-12", item.title.startsWith("Sell") ? "text-loss" : "text-gain")}>{item.title}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{item.subtitle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-line bg-bg-elev">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-medium">Swap Manager <span className="text-sm font-normal text-muted">({rows.length} wallets)</span></h2>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 py-2">
            {([
              ["wallets", "Wallets"],
              ["auto", "Trade Automation"],
              ["smart", "Smart Sell"],
              ["cleanup", "Cleanup"],
              ["bump", "Bump Bot"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1.5 text-xs",
                  tool === id ? "border-line-strong bg-surface-3 text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
            <button type="button" onClick={() => setTool("maker")} className={cn("rounded-md border px-2.5 py-1.5 text-xs", tool === "maker" ? "border-gold/50 bg-gold-dim text-gold" : "border-line text-muted")}>Market Maker</button>
            <button type="button" disabled title="Funded launch is still in development." className="rounded-md border border-line px-2.5 py-1.5 text-xs text-faint">Funded Launch</button>
            <button type="button" onClick={() => void sellGroup(true)} className="rounded-md bg-loss/20 px-2.5 py-1.5 text-xs text-loss">Sell All (Keep Dev)</button>
            <button type="button" onClick={() => void sellGroup(false)} className="rounded-md bg-loss/20 px-2.5 py-1.5 text-xs text-loss">Sell All + Dev</button>
          </div>
          {tool === "maker" || tool === "bump" || tool === "auto" ? (
            <div className="grid gap-2 px-3 pb-3 sm:grid-cols-[1fr_5rem_6rem_auto]">
              <label className="text-[11px] text-faint">
                SOL each buy
                <input className={`${fieldClass} mt-1 font-mono`} inputMode="decimal" value={eachSol} onChange={(e) => setEachSol(e.target.value)} />
              </label>
              <label className="text-[11px] text-faint">
                Rounds
                <input className={`${fieldClass} mt-1 font-mono`} type="number" min={1} max={12} disabled={tool !== "bump"} value={times} onChange={(e) => setTimes(Number(e.target.value))} />
              </label>
              <label className="text-[11px] text-faint">
                Gap (s)
                <input className={`${fieldClass} mt-1 font-mono`} type="number" min={2} max={120} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
              </label>
              <div className="flex items-end gap-2">
                <Button className="min-h-10" disabled={busy !== null} onClick={() => void runBuys(tool === "bump" ? "bump" : "maker")}>
                  {busy === "batch" ? "Buying…" : "Run"}
                </Button>
                {busy === "batch" ? <Button variant="ghost" className="min-h-10" onClick={() => { stopRef.current = true; }}>Stop</Button> : null}
              </div>
            </div>
          ) : null}
          {tool === "smart" ? <p className="px-3 pb-2 text-xs text-muted">Sell from a row. Nothing here sells by itself.</p> : null}
          {tool === "cleanup" ? <p className="px-3 pb-2 text-xs text-muted">Sell All closes the wallets that can sign. Dev stays if you keep it.</p> : null}
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1.4rem_1.5fr_4.5rem_4.5rem_5rem] items-center gap-2 border-y border-line px-3 py-2 text-[10px] tracking-wide text-faint uppercase">
                <span />
                <span>Wallet</span>
                <span>SOL</span>
                <span>PnL</span>
                <span className="text-right">Buy / Sell</span>
              </div>
              <GroupLabel title="Dev" count={rows.filter((row) => row.role === "Dev").length} />
              {rows.filter((row) => row.role === "Dev").map((row) => (
                <WalletRow key={row.id} row={row} picked={picked.includes(row.id)} busy={busy} onPick={() => setPicked((cur) => (cur.includes(row.id) ? cur.filter((item) => item !== row.id) : [...cur, row.id]))} onTrade={(side, amount) => void trade(row.id, side, amount)} />
              ))}
              <GroupLabel title="Bundle" count={rows.filter((row) => row.role !== "Dev").length} />
              {rows.filter((row) => row.role !== "Dev").map((row) => (
                <WalletRow key={row.id} row={row} picked={picked.includes(row.id)} busy={busy} onPick={() => setPicked((cur) => (cur.includes(row.id) ? cur.filter((item) => item !== row.id) : [...cur, row.id]))} onTrade={(side, amount) => void trade(row.id, side, amount)} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function GroupLabel({ title, count }: { title: string; count: number }) {
  return (
    <div className="bg-black/40 px-3 py-1.5 text-[11px] text-muted">
      {title} <span className="text-faint">({count})</span>
    </div>
  );
}

function WalletRow({
  row,
  picked,
  busy,
  onPick,
  onTrade,
}: {
  row: { id: string; name: string; address: string; balance: number; role: string };
  picked: boolean;
  busy: string | null;
  onPick: () => void;
  onTrade: (side: "buy" | "sell", amount: number | string) => void;
}) {
  return (
    <div className="grid grid-cols-[1.4rem_1.5fr_4.5rem_4.5rem_5rem] items-center gap-2 border-b border-line px-3 py-2">
      <button type="button" aria-label={`Select ${row.name}`} onClick={onPick} className={cn("size-3.5 rounded border", picked ? "border-gold bg-gold" : "border-line-strong")} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-gold">{row.role}</span>
          <span className="truncate text-sm">{row.name}</span>
        </div>
        <p className="font-mono text-[11px] text-faint">{shortAddr(row.address)}</p>
      </div>
      <span className="font-mono text-xs tabular-nums">{sol(row.balance, 2)}</span>
      <span className="font-mono text-xs text-faint">0.00</span>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          {BUYS.map((amount) => (
            <button key={amount} type="button" disabled={busy !== null} onClick={() => onTrade("buy", amount)} className="rounded bg-gain/20 px-1.5 py-1 font-mono text-[10px] text-gain disabled:opacity-40">{amount}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {SELLS.map((amount) => (
            <button key={amount} type="button" disabled={busy !== null} onClick={() => onTrade("sell", amount)} className="rounded bg-loss/20 px-1.5 py-1 font-mono text-[10px] text-loss disabled:opacity-40">{amount}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-3">
      <p className="text-[11px] text-faint">{label}</p>
      <p className={cn("mt-1 font-mono text-lg tabular-nums", tone === "up" && "text-gain", tone === "down" && "text-loss")}>{value}</p>
    </div>
  );
}

function Pair({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className={cn("font-mono text-sm tabular-nums", tone === "up" && "text-gain", tone === "down" && "text-loss")}>{value}</p>
    </div>
  );
}
