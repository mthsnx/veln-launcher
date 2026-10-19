import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { sol } from "@/lib/format";
import { BUY_MODES } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { Button, FieldLabel, PageIntro, Panel, fieldClass } from "@/components/ui";

function NeedWallet({ children }: { children: ReactNode }) {
  const connected = useVeln((s) => s.connected);
  if (connected) return children;
  return (
    <Panel className="p-6">
      <p className="font-medium">Connect Phantom</p>
      <p className="mt-1 text-sm text-muted">Live launches spend the SOL in your Phantom wallet.</p>
      <Button className="mt-4" onClick={() => {
        void import("@/lib/solana/run-launch")
          .then(({ attachPhantom }) => attachPhantom(false))
          .then(() => toast.success("Phantom connected"))
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Phantom rejected the connection"));
      }}>Connect Phantom</Button>
    </Panel>
  );
}

export function FundedPage() {
  const launch = useVeln((s) => s.commitLaunch);
  const [name, setName] = useState("Backed Coin");
  const [symbol, setSymbol] = useState("BACK");
  const [target, setTarget] = useState("1.2");
  const [mine, setMine] = useState("0.15");
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || progress >= 100) return;
    const id = window.setTimeout(() => setProgress((p) => Math.min(100, p + 8)), 180);
    return () => window.clearTimeout(id);
  }, [open, progress]);

  return (
    <NeedWallet>
      <PageIntro kicker="Launch" title="Funded launch" sub="Open a paper raise, then launch with the filled amount plus your own SOL." />
      <Panel className="max-w-xl space-y-3 p-5">
        <label className="block text-sm">Name
          <input className={`${fieldClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">Ticker
          <input className={`${fieldClass} mt-1`} value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Raise target
            <input className={`${fieldClass} mt-1 font-mono`} value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="text-sm">Your SOL
            <input className={`${fieldClass} mt-1 font-mono`} value={mine} onChange={(e) => setMine(e.target.value)} />
          </label>
        </div>
        {open ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{progress < 100 ? "Backers filling…" : "Raise filled."}</p>
          </div>
        ) : null}
        {!open ? (
          <Button onClick={() => { setProgress(0); setOpen(true); }}>Open raise</Button>
        ) : (
          <Button
            disabled={progress < 100}
            onClick={() => {
              const own = Number(mine) || 0;
              const raised = Number(target) || 0;
              const res = launch({
                style: "bundle",
                name,
                symbol,
                description: `Funded launch. Raised ${raised} SOL on paper, you put in ${own}.`,
                image: null,
                platform: "Pump.fun",
                buyMode: "fast",
                walletCount: 6,
                charges: [{ walletId: "main", amount: own }],
                extras: [`Raise ${raised} SOL`],
                failChance: 0.05,
              });
              if (!res.ok) toast.error(res.error);
              else toast.success(`${symbol} launched with the raise`);
            }}
          >
            Launch with the raise
          </Button>
        )}
      </Panel>
    </NeedWallet>
  );
}

export function SpamPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [base, setBase] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [each, setEach] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const total = Math.min(10, Math.max(1, count || 1));
  const names = Array.from({ length: total }, (_, i) => ({
    name: `${base.trim()} ${i + 1}`.trim(),
    symbol: `${symbol}${i + 1}`.slice(0, 10),
  }));
  const spend = (Number(each) || 0) * total;

  function onImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Use an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Use an image under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function launchAll() {
    const first = names[0];
    if (!first?.name || !symbol.trim()) {
      toast.error("Name and ticker first.");
      return;
    }
    setBusy(true);
    setStatus(`Building ${total} mints…`);
    try {
      const { runSpamBatch } = await import("@/lib/solana/run-launch");
      setStatus("Approve the batch in Phantom. They go out together.");
      const result = await runSpamBatch({
        base,
        symbol,
        description,
        image,
        count: total,
        each,
      });
      const missed = result.missed ? ` ${result.missed} did not land.` : "";
      setStatus(`${result.count} live.${missed}`);
      toast.success(`${result.count} coins created`);
      if (result.ids[0]) void navigate({ to: "/projects/$id", params: { id: result.ids[0] } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch failed";
      setStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <NeedWallet>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-faint uppercase">Pump.fun · Solana</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <Link to="/" className="grid size-9 place-items-center rounded-md border border-line" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
            SPAM LAUNCH
          </h1>
          <p className="mt-1 text-xs text-muted">Step {step} of 3 · {["Token", "Batch", "Review"][step - 1]}</p>
        </div>
        <Link to="/launch" className="hidden min-h-11 items-center rounded-md border border-line px-3 text-sm text-muted hover:text-fg sm:inline-flex">
          Token Launch
        </Link>
      </div>

      <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">
        {step === 1 ? "Same token step as a bundle" : step === 2 ? "How many mints" : "Sign them one at a time"}
      </p>
      <h2 className="mt-2 text-2xl font-semibold">
        {step === 1 ? "What are you launching?" : step === 2 ? "Batch size" : "Review the queue"}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {step === 1
          ? "One name and ticker. Each mint gets a number so Pump.fun sees a new coin."
          : step === 2
            ? "Phantom signs the whole batch once. The mints are sent together."
            : "Every row is a new Pump.fun coin. Launch creates all of them now."}
      </p>

      <div className="mx-auto mt-6 max-w-3xl">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel hint="Shown on the coin. A number is added per mint.">Name</FieldLabel>
                <input className={fieldClass} maxLength={28} value={base} placeholder="Name" onChange={(e) => setBase(e.target.value)} />
                <p className="mt-1 text-right text-xs text-faint">{base.length}/28</p>
              </label>
              <label className="block">
                <FieldLabel>Ticker</FieldLabel>
                <input
                  className={fieldClass}
                  maxLength={8}
                  value={symbol}
                  placeholder="TICKER"
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
                <p className="mt-1 text-right text-xs text-faint">{symbol.length}/8</p>
              </label>
            </div>
            <label className="block">
              <FieldLabel>Description</FieldLabel>
              <textarea
                className={`${fieldClass} min-h-24 resize-y`}
                maxLength={500}
                value={description}
                placeholder="What is this coin?"
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-faint">{description.length}/500</p>
            </label>
            <div>
              <FieldLabel>Image</FieldLabel>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface text-sm text-muted">
                {image ? (
                  <img src={image} alt="" className="size-20 rounded-md object-cover" />
                ) : (
                  <>
                    <Upload className="mb-2 size-5 text-gold" />
                    Click or drop an image
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImage(file);
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <button
              type="button"
              className="rounded-2xl border border-gold/70 bg-surface p-6 text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
            >
              <span className="grid size-14 place-items-center rounded-full border border-gold/30 bg-gold-dim text-sm font-semibold text-gold">P</span>
              <span className="mt-4 block text-sm font-semibold tracking-[0.14em]">PUMP.FUN</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted">Same venue as Token Launch. Other launchpads are still off.</span>
            </button>
            <Panel className="space-y-4 p-5">
              <label className="block text-sm">
                How many
                <input
                  className={`${fieldClass} mt-2 font-mono`}
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                SOL on the dev buy, each mint
                <input className={`${fieldClass} mt-2 font-mono`} inputMode="decimal" value={each} onChange={(e) => setEach(e.target.value)} />
              </label>
              <p className="text-sm text-muted">Up to 10. About {sol(spend, 3)} SOL in dev buys before fees.</p>
            </Panel>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
              <span className="font-medium">{base.trim() || "Untitled"}</span>
              <span className="text-xs text-faint">{total} in the queue</span>
            </div>
            <ul className="divide-y divide-line">
              {names.map((row, i) => (
                <li key={row.symbol} className="flex items-center gap-3 px-4 py-3">
                  {image ? (
                    <img src={image} alt="" className="size-10 rounded-md object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-md border border-line bg-black text-xs text-gold">{i + 1}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="font-mono text-xs text-muted">${row.symbol}</span>
                  </span>
                  <span className="text-xs text-gold">Together</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep((n) => Math.max(1, n - 1))}>Back</Button>
          {step < 3 ? (
            <Button
              className="min-w-44"
              onClick={() => {
                if (step === 1 && (!base.trim() || !symbol.trim())) {
                  toast.error("Name and ticker first.");
                  return;
                }
                if (step === 2 && !(Number(each) > 0)) {
                  toast.error("Enter the SOL for each dev buy.");
                  return;
                }
                setStep((n) => n + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button className="min-w-44" disabled={busy} onClick={() => void launchAll()}>
              {busy ? "Creating…" : `Launch ${total}`}
            </Button>
          )}
        </div>
        {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
      </div>
    </NeedWallet>
  );
}

const PRACTICE_STYLES = [
  { id: "bundle", title: "NEW BUNDLE", body: "Create and launch a new token with bundled wallets" },
  { id: "vamp", title: "VAMP", body: "Copy any token's metadata and launch your own" },
  { id: "cto", title: "CTO", body: "Take over an existing token with your own wallets" },
] as const;

type Market = "dump" | "chop" | "send";

export function PracticePage() {
  const [phase, setPhase] = useState<"style" | "token" | "mode" | "settings" | "live">("style");
  const [style, setStyle] = useState<(typeof PRACTICE_STYLES)[number]["id"]>("bundle");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<(typeof BUY_MODES)[number]["id"]>("fast");
  const [spend, setSpend] = useState("0.15");
  const [market, setMarket] = useState<Market>("send");
  const [price, setPrice] = useState(1);
  const [entry, setEntry] = useState(1);
  const [hist, setHist] = useState<number[]>([1]);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState<number | null>(null);
  const [deskTab, setDeskTab] = useState<"wallets" | "auto" | "smart" | "cleanup" | "bump">("wallets");
  const [paper, setPaper] = useState<{ id: string; name: string; role: "Dev" | "Bundle"; cost: number; tokens: number }[]>([]);

  useEffect(() => {
    if (!open) return;
    const drift = market === "dump" ? -0.035 : market === "send" ? 0.04 : 0;
    const id = window.setInterval(() => {
      setPrice((current) => {
        const next = Math.max(0.08, current * (1 + drift + (Math.random() - 0.5) * 0.02));
        setHist((rows) => [...rows.slice(-48), next]);
        return next;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [open, market]);

  const spent = Number(spend) || 0;
  const multiple = entry > 0 ? price / entry : 1;
  const bookCost = paper.reduce((sum, row) => sum + row.cost, 0);
  const bookValue = paper.reduce((sum, row) => sum + row.tokens * price, 0);
  const pnl = settled ?? (paper.length ? bookValue - bookCost : 0);

  function launchPaper() {
    if (!name.trim() || !symbol.trim()) {
      toast.error("Name and ticker first.");
      return;
    }
    if (!(spent >= 0.01)) {
      toast.error("Put at least 0.01 paper SOL on the buy.");
      return;
    }
    setPrice(1);
    setEntry(1);
    setHist([1]);
    setOpen(true);
    setSettled(null);
    setDeskTab("wallets");
    setPaper([
      { id: "dev", name: "Dev", role: "Dev", cost: spent, tokens: spent },
      { id: "b1", name: "Bundle 1", role: "Bundle", cost: 0, tokens: 0 },
      { id: "b2", name: "Bundle 2", role: "Bundle", cost: 0, tokens: 0 },
      { id: "b3", name: "Bundle 3", role: "Bundle", cost: 0, tokens: 0 },
    ]);
    setPhase("live");
    toast.success("Practice only. Phantom was not asked to sign.");
  }

  if (phase === "live") {
    const w = 720;
    const h = 280;
    const min = Math.min(...hist);
    const max = Math.max(...hist);
    const span = Math.max(max - min, 0.0001);
    const coords = hist.map((value, i) => {
      const x = (i / Math.max(1, hist.length - 1)) * (w - 24) + 12;
      const y = 16 + (1 - (value - min) / span) * (h - 40);
      return [x, y] as const;
    });
    const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
    const area = coords.length ? `${coords[0][0]},${h - 8} ${line} ${coords[coords.length - 1][0]},${h - 8}` : "";
    const up = pnl >= 0;
    const shownMultiple = bookCost > 0 ? bookValue / bookCost : multiple;
    function paperBuy(id: string, amount: number) {
      if (settled != null) return;
      setPaper((rows) =>
        rows.map((row) => (row.id === id ? { ...row, cost: row.cost + amount, tokens: row.tokens + amount / price } : row)),
      );
    }
    function paperSell(id: string, pct: number) {
      if (settled != null) return;
      setPaper((rows) =>
        rows.map((row) => (row.id === id ? { ...row, cost: row.cost * (1 - pct), tokens: row.tokens * (1 - pct) } : row)),
      );
    }
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Practice desk</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name || "Untitled"} <span className="text-muted">${symbol || "—"}</span></h1>
          </div>
          <span className="rounded-full border border-gold/40 bg-gold-dim px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">Paper · not signed</span>
        </div>
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.15fr)]">
          <section className="overflow-hidden rounded-xl border border-line bg-bg-elev">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4">
              <div>
                <p className="text-xs text-faint">{style.toUpperCase()} · {BUY_MODES.find((item) => item.id === mode)?.name}</p>
                <p className="mt-1 text-[11px] tracking-[0.14em] text-faint uppercase">Market cap</p>
                <p className="font-mono text-2xl tabular-nums">{shownMultiple.toFixed(2)}x</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Net PnL</p>
                <p className={cn("font-mono text-2xl font-medium tabular-nums", up ? "text-gain" : "text-loss")}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(3)} SOL
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
              <p className="text-xs text-muted">You choose how the market goes.</p>
              <div className="flex rounded-lg border border-line bg-black p-0.5">
                {(["dump", "chop", "send"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMarket(item)}
                    className={cn("min-h-8 rounded-md px-3 text-xs capitalize", market === item ? "bg-gold text-ink" : "text-muted")}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-64 w-full">
              {[0.25, 0.5, 0.75].map((g) => (
                <line key={g} x1="12" x2={w - 12} y1={16 + g * (h - 40)} y2={16 + g * (h - 40)} stroke="var(--color-line)" strokeWidth="1" />
              ))}
              {area ? <polygon points={area} fill={up ? "rgb(61 204 132 / 0.18)" : "rgb(255 92 92 / 0.16)"} /> : null}
              <polyline fill="none" stroke={up ? "var(--color-gain)" : "var(--color-loss)"} strokeWidth="2.5" points={line} />
            </svg>
          </section>

          <section className="min-w-0 rounded-xl border border-line bg-bg-elev">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-medium">Swap Manager <span className="text-sm font-normal text-muted">({paper.length} wallets)</span></h2>
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
                  onClick={() => setDeskTab(id)}
                  className={cn("shrink-0 rounded-md border px-2.5 py-1.5 text-xs", deskTab === id ? "border-line-strong bg-surface-3 text-fg" : "border-transparent text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              <span className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted">Market Maker</span>
              <button type="button" disabled className="rounded-md border border-line px-2.5 py-1.5 text-xs text-faint">Funded Launch</button>
              <button
                type="button"
                className="rounded-md bg-loss/20 px-2.5 py-1.5 text-xs text-loss"
                onClick={() => paper.filter((row) => row.role !== "Dev").forEach((row) => paperSell(row.id, 1))}
              >
                Sell All (Keep Dev)
              </button>
              <button
                type="button"
                className="rounded-md bg-loss/20 px-2.5 py-1.5 text-xs text-loss"
                onClick={() => {
                  const result = bookValue - bookCost;
                  setSettled(result);
                  setOpen(false);
                  toast.success(`Closed ${result >= 0 ? "+" : ""}${result.toFixed(3)} SOL on paper`);
                }}
              >
                Sell All + Dev
              </button>
            </div>
            {deskTab !== "wallets" ? (
              <p className="px-3 pb-2 text-xs text-muted">
                {deskTab === "bump" ? "Paper only. Dump, chop, or send still steers the chart." : "Paper buys stay on the wallet. Nothing is signed."}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[1.4fr_4rem_4.5rem_auto] gap-2 border-y border-line px-3 py-2 text-[10px] tracking-wide text-faint uppercase">
                  <span>Wallet</span>
                  <span>SOL</span>
                  <span>PnL</span>
                  <span className="text-right">Buy / Sell</span>
                </div>
                {(["Dev", "Bundle"] as const).map((role) => (
                  <div key={role}>
                    <div className="bg-black/40 px-3 py-1.5 text-[11px] text-muted">{role} ({paper.filter((row) => row.role === role).length})</div>
                    {paper.filter((row) => row.role === role).map((row) => {
                      const rowPnl = row.tokens * price - row.cost;
                      return (
                        <div key={row.id} className="grid grid-cols-[1.4fr_4rem_4.5rem_auto] items-center gap-2 border-b border-line px-3 py-2">
                          <div>
                            <p className="text-sm">{row.name}</p>
                            <p className="text-[11px] text-faint">{role}</p>
                          </div>
                          <span className="font-mono text-xs tabular-nums">{row.cost.toFixed(2)}</span>
                          <span className={cn("font-mono text-xs tabular-nums", rowPnl >= 0 ? "text-gain" : "text-loss")}>{rowPnl >= 0 ? "+" : ""}{rowPnl.toFixed(3)}</span>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-1">
                              {[0.1, 0.25, 0.5, 1].map((amount) => (
                                <button key={amount} type="button" disabled={settled != null} onClick={() => paperBuy(row.id, amount)} className="rounded bg-gain/20 px-1.5 py-1 font-mono text-[10px] text-gain disabled:opacity-40">{amount}</button>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              {[0.25, 0.5, 0.75, 1].map((pct) => (
                                <button key={pct} type="button" disabled={settled != null} onClick={() => paperSell(row.id, pct)} className="rounded bg-loss/20 px-1.5 py-1 font-mono text-[10px] text-loss disabled:opacity-40">{pct * 100}%</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end px-3 py-3">
              <Button
                variant="ghost"
                className="min-h-9"
                onClick={() => {
                  setOpen(false);
                  setSettled(null);
                  setPaper([]);
                  setPhase("style");
                  setHist([1]);
                  setPrice(1);
                }}
              >
                New practice
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const labels = ["Style", "Token", "Buy mode", "Market"] as const;
  const index = phase === "style" ? 0 : phase === "token" ? 1 : phase === "mode" ? 2 : 3;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">Practice</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Practice launch</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">Same steps as a real mint. You choose if it dumps, chops, or sends. Nothing is broadcast.</p>
        </div>
        <div className="flex items-center gap-2">
          {labels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={cn("grid size-8 place-items-center rounded-full text-sm", i <= index ? "bg-gold text-ink" : "bg-surface-3 text-faint")}>{i + 1}</span>
              {i < labels.length - 1 ? <span className={cn("hidden h-px w-6 sm:block", i < index ? "bg-gold" : "bg-line")} /> : null}
            </div>
          ))}
        </div>
      </div>

      {phase === "style" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {PRACTICE_STYLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStyle(item.id);
                setPhase("token");
              }}
              className="group flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-10 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition duration-150 hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-[0_16px_40px_rgb(0_0_0/0.28)]"
            >
              <span className="grid size-16 place-items-center rounded-full border border-gold/30 bg-gold-dim text-sm font-semibold tracking-widest text-gold">
                {item.title.slice(0, 1)}
              </span>
              <span className="mt-5 text-sm font-semibold tracking-[0.16em]">{item.title}</span>
              <span className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">{item.body}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-bg-elev p-5 sm:p-7">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">{labels[index]}</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {phase === "token" ? "What are you launching?" : phase === "mode" ? "Buy mode" : "How does the market go?"}
          </h2>
          {phase === "token" ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Name
                  <input className={`${fieldClass} mt-2`} maxLength={32} value={name} placeholder="Name" onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="block text-sm">
                  Ticker
                  <input
                    className={`${fieldClass} mt-2 font-mono`}
                    maxLength={10}
                    value={symbol}
                    placeholder="TICKER"
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Description
                <textarea className={`${fieldClass} mt-2 min-h-28`} maxLength={280} value={description} placeholder="What is this coin?" onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>
          ) : null}
          {phase === "mode" ? (
            <div className="mt-5 space-y-2">
              {BUY_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left",
                    mode === item.id ? "border-gold bg-gold-dim" : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{item.name}</span>
                    {item.tag ? <span className="ml-2 rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-gold">{item.tag}</span> : null}
                    <span className="mt-1 block text-sm text-muted">{item.blurb}</span>
                  </span>
                  <span className={cn("mt-1 size-4 shrink-0 rounded-full border", mode === item.id ? "border-gold bg-gold" : "border-line-strong")} />
                </button>
              ))}
            </div>
          ) : null}
          {phase === "settings" ? (
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                Paper SOL on the buy
                <input className={`${fieldClass} mt-2 font-mono`} inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ["dump", "Dump", "Price bleeds after the open."],
                  ["chop", "Chop", "It wanders and goes nowhere."],
                  ["send", "Send", "Bids lift it after the open."],
                ] as const).map(([id, title, body]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMarket(id)}
                    className={cn(
                      "min-h-40 rounded-2xl border px-4 py-5 text-left transition hover:-translate-y-0.5",
                      market === id ? "border-gold bg-gold-dim" : "border-line bg-surface",
                    )}
                  >
                    <span className="text-sm font-semibold tracking-[0.16em]">{title.toUpperCase()}</span>
                    <span className="mt-3 block text-sm leading-relaxed text-muted">{body}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setPhase(phase === "token" ? "style" : phase === "mode" ? "token" : "mode")}
            >
              Back
            </Button>
            {phase === "settings" ? (
              <Button className="min-w-44" onClick={launchPaper}>Practice launch</Button>
            ) : (
              <Button
                className="min-w-44"
                onClick={() => {
                  if (phase === "token" && (!name.trim() || !symbol.trim())) {
                    toast.error("Name and ticker first.");
                    return;
                  }
                  setPhase(phase === "token" ? "mode" : "settings");
                }}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BumpPage() {
  const wallets = useVeln((s) => s.wallets);
  const post = useVeln((s) => s.postPnl);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState("0.01");
  const [minD, setMinD] = useState(2);
  const [maxD, setMaxD] = useState(5);
  const [on, setOn] = useState(false);
  const [fires, setFires] = useState(0);
  const spent = useRef(0);
  const firesRef = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!on) return;
    let cancel = false;
    const tick = () => {
      if (cancel) return;
      const size = Number(amount) || 0;
      const ok = useVeln.getState().spend(walletId, size);
      if (!ok) {
        const loss = spent.current;
        const n = firesRef.current;
        spent.current = 0;
        firesRef.current = 0;
        setFires(0);
        setOn(false);
        if (n > 0) useVeln.getState().postPnl(-loss, "Bump bot", `${n} fires`);
        toast.error("Wallet ran dry. Bump stopped.");
        return;
      }
      spent.current += size;
      firesRef.current += 1;
      setFires(firesRef.current);
      const wait = (minD + Math.random() * Math.max(0, maxD - minD)) * 1000;
      timer.current = window.setTimeout(tick, wait);
    };
    timer.current = window.setTimeout(tick, 400);
    return () => {
      cancel = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [on, amount, walletId, minD, maxD]);

  function stop() {
    setOn(false);
    const n = firesRef.current;
    const loss = spent.current;
    firesRef.current = 0;
    spent.current = 0;
    setFires(0);
    if (n > 0 && loss > 0) {
      post(-loss, "Bump bot", `${n} fires`);
      toast.success(`Bump stopped · ${n} fires`);
    }
  }

  return (
    <NeedWallet>
      <PageIntro kicker="Trade" title="Bump bot" sub="Small buys on a delay. SOL leaves the wallet. The loss hits the book when you stop." />
      <Panel className="max-w-xl space-y-3 p-5">
        <label className="block text-sm">Wallet
          <select className={`${fieldClass} mt-1`} value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {sol(w.balance, 3)}</option>)}
          </select>
        </label>
        <label className="block text-sm">SOL per fire
          <input className={`${fieldClass} mt-1 font-mono`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Min delay (s)
            <input className={`${fieldClass} mt-1 font-mono`} type="number" min={1} value={minD} onChange={(e) => setMinD(Number(e.target.value))} />
          </label>
          <label className="text-sm">Max delay (s)
            <input className={`${fieldClass} mt-1 font-mono`} type="number" min={1} value={maxD} onChange={(e) => setMaxD(Number(e.target.value))} />
          </label>
        </div>
        <p className="font-mono text-sm tabular-nums text-muted">Fires {fires}</p>
        {on ? <Button variant="danger" onClick={stop}>Stop</Button> : <Button onClick={() => { spent.current = 0; setFires(0); setOn(true); }}>Start</Button>}
      </Panel>
    </NeedWallet>
  );
}

export function MakerPage() {
  const projects = useVeln((s) => s.projects);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [on, setOn] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [buyMin, setBuyMin] = useState("0.05");
  const [buyMax, setBuyMax] = useState("0.2");
  const [sellMin, setSellMin] = useState("0.03");
  const [sellMax, setSellMax] = useState("0.12");

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      const buy = Math.random() > 0.45;
      const lo = Number(buy ? buyMin : sellMin) || 0;
      const hi = Number(buy ? buyMax : sellMax) || lo;
      const size = (lo + Math.random() * Math.max(0, hi - lo)).toFixed(3);
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLog((l) => [`${stamp}  ${buy ? "Buy" : "Sell"}  ${size} SOL`, ...l].slice(0, 16));
    }, 1400);
    return () => window.clearInterval(id);
  }, [on, buyMin, buyMax, sellMin, sellMax]);

  return (
    <div>
      <PageIntro kicker="Trade" title="Market maker" sub="A two-sided book that quotes once a coin is live. This tape is simulated." />
      <Panel className="max-w-3xl space-y-4 p-5">
        <label className="block text-sm">Coin
          <select className={`${fieldClass} mt-1`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.symbol} · {p.name}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-gain/30 bg-gain-dim p-3">
            <p className="text-sm text-gain">Buys</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className={fieldClass} value={buyMin} onChange={(e) => setBuyMin(e.target.value)} />
              <input className={fieldClass} value={buyMax} onChange={(e) => setBuyMax(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-loss/30 bg-loss-dim p-3">
            <p className="text-sm text-loss">Sells</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className={fieldClass} value={sellMin} onChange={(e) => setSellMin(e.target.value)} />
              <input className={fieldClass} value={sellMax} onChange={(e) => setSellMax(e.target.value)} />
            </div>
          </div>
        </div>
        <Button onClick={() => setOn((v) => !v)}>{on ? "Stop book" : "Start book"}</Button>
        <ul className="min-h-24 space-y-1 font-mono text-xs text-muted">
          {log.length === 0 ? <li>No prints yet.</li> : log.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </Panel>
    </div>
  );
}

export function MixerPage() {
  const wallets = useVeln((s) => s.wallets);
  const main = useVeln((s) => s.mainBalance);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState("0.02");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const seeded = wallets.filter((w) => w.secretKey);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function run() {
    const chosen = seeded.filter((w) => picked.includes(w.id));
    if (chosen.length < 1) {
      toast.error("Pick at least one wallet that has a seed.");
      return;
    }
    const total = Number(amount);
    if (!(total > 0)) {
      toast.error("Enter how much SOL to send.");
      return;
    }
    const each = total / chosen.length;
    if (each < 0.001) {
      toast.error("Each wallet needs at least 0.001 SOL.");
      return;
    }
    setBusy(true);
    setLog([]);
    try {
      const { transferSol, solBalance } = await import("@/lib/solana/phantom");
      const payer = useVeln.getState().mainAddress;
      if (!payer) throw new Error("Connect Phantom first.");
      for (const wallet of chosen) {
        setLog((lines) => [...lines, `Sending ${each.toFixed(4)} SOL to ${wallet.name}…`]);
        const sig = await transferSol(payer, wallet.address, each);
        const dest = await solBalance(wallet.address);
        useVeln.getState().setWalletBalance(wallet.address, dest);
        setLog((lines) => [...lines, `${wallet.name} received it · ${sig.slice(0, 8)}`]);
      }
      const balance = await solBalance(payer);
      useVeln.getState().connectLive(payer, balance);
      useVeln.getState().pushActivity("Mixer", `${chosen.length} wallets funded`, 0);
      toast.success("SOL is in those wallets. Export the seeds to open them in Phantom.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mix failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NeedWallet>
      <PageIntro
        kicker="Tools"
        title="Veln mixer"
        sub="Sends real SOL from Phantom into wallets you hold the seed for. Export those seeds and import them in Phantom. This is not Whirlpool — Solana transfers stay public."
      />
      <Panel className="max-w-xl space-y-3 p-5">
        <p className="text-sm text-muted">Phantom balance {sol(main, 4)} SOL. Each selected wallet gets an equal share. Phantom asks you to sign every send.</p>
        {seeded.length === 0 ? (
          <p className="text-sm text-muted">Create a wallet first. That wallet gets a 12-word seed.</p>
        ) : (
          <ul className="space-y-2">
            {seeded.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => toggle(w.id)} className="flex w-full items-center gap-3 rounded-md border border-line px-3 py-2 text-left">
                  <span className={`size-4 rounded border ${picked.includes(w.id) ? "border-gold bg-gold" : "border-line-strong"}`} />
                  <span className="flex-1 text-sm">{w.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted">{sol(w.balance, 4)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="block text-sm">
          Total SOL from Phantom
          <input className={`${fieldClass} mt-1 font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        {log.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs text-muted">
            {log.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        ) : null}
        <Button disabled={busy || seeded.length === 0} onClick={() => void run()}>{busy ? "Waiting for Phantom…" : "Send SOL"}</Button>
      </Panel>
    </NeedWallet>
  );
}

export function DispersePage() {
  const projects = useVeln((s) => s.projects);
  const wallets = useVeln((s) => s.wallets);
  const push = useVeln((s) => s.pushActivity);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [each, setEach] = useState("2.5");
  const project = projects.find((p) => p.id === projectId);

  return (
    <div>
      <PageIntro kicker="Tools" title="Token disperse" sub="Split a launched coin across wallets. The ledger here is a note, not a transfer." />
      <Panel className="max-w-xl space-y-3 p-5">
        <label className="block text-sm">Token
          <select className={`${fieldClass} mt-1`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.symbol}</option>)}
          </select>
        </label>
        <label className="block text-sm">Percent each
          <input className={`${fieldClass} mt-1 font-mono`} value={each} onChange={(e) => setEach(e.target.value)} />
        </label>
        <ul className="space-y-2">
          {wallets.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left text-sm"
                onClick={() => setPicked((cur) => (cur.includes(w.id) ? cur.filter((id) => id !== w.id) : [...cur, w.id]))}
              >
                <span className={`size-4 rounded border ${picked.includes(w.id) ? "border-gold bg-gold" : "border-line-strong"}`} />
                {w.name}
              </button>
            </li>
          ))}
        </ul>
        <Button
          disabled={!project || picked.length === 0}
          onClick={() => {
            if (!project) return;
            push("Token disperse", `${project.symbol} → ${picked.length} wallets · ${each}% each`);
            toast.success(`Dispersed ${project.symbol}`);
          }}
        >
          Disperse
        </Button>
      </Panel>
    </div>
  );
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

function looksLikeMint(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function BuyPage() {
  const projects = useVeln((s) => s.projects).filter((p) => p.mint && p.status === "success");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pasted, setPasted] = useState("");
  const picked = projects.find((p) => p.id === projectId);
  const mint = looksLikeMint(pasted) ? pasted.trim() : picked?.mint ?? "";
  const jupiter = mint ? `https://jup.ag/swap/${SOL_MINT}-${mint}` : "";
  const pump = mint ? `https://pump.fun/coin/${mint}` : "";
  const chart = mint ? `https://dexscreener.com/solana/${mint}` : "";

  return (
    <NeedWallet>
      <PageIntro
        kicker="Tools"
        title="Buy DEX"
        sub="Opens Jupiter with this coin set as the token you buy. Phantom signs the swap there, not on this desk."
      />
      <Panel className="max-w-xl space-y-4 p-5">
        {projects.length > 0 ? (
          <label className="block text-sm">
            Your launches
            <select className={`${fieldClass} mt-1`} value={projectId} onChange={(e) => { setProjectId(e.target.value); setPasted(""); }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.symbol})</option>)}
            </select>
          </label>
        ) : (
          <p className="text-sm text-muted">No launched coins on this wallet yet. Paste any Solana mint below.</p>
        )}
        <label className="block text-sm">
          Or paste a contract address
          <input
            className={`${fieldClass} mt-1 font-mono`}
            value={pasted}
            placeholder="Mint address"
            spellCheck={false}
            onChange={(e) => setPasted(e.target.value)}
          />
        </label>
        {mint ? (
          <p className="break-all font-mono text-xs text-faint">{mint}</p>
        ) : (
          <p className="text-sm text-loss">Enter a real mint, or launch a coin first.</p>
        )}
        <a
          href={jupiter || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!jupiter}
          className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-gold px-4 text-[13px] font-semibold text-ink ${jupiter ? "hover:bg-gold-2" : "pointer-events-none opacity-40"}`}
          onClick={(e) => {
            if (!jupiter) e.preventDefault();
          }}
        >
          Buy on Jupiter
        </a>
        <div className="flex flex-wrap gap-4 text-sm">
          {pump ? <a className="text-gold hover:underline" href={pump} target="_blank" rel="noreferrer">Pump.fun</a> : null}
          {chart ? <a className="text-muted hover:text-fg" href={chart} target="_blank" rel="noreferrer">Chart on DexScreener</a> : null}
        </div>
      </Panel>
    </NeedWallet>
  );
}

const SOON: Record<string, { title: string; body: string }> = {
  funded: {
    title: "Funded Launch",
    body: "Still in development. A shared raise isn't available yet — use Token Launch to mint with your own Phantom wallet.",
  },
  snipe: {
    title: "Snipe",
    body: "A watcher for new mints. It isn't wired yet — use timed buys on a launch if you want entries after the dev.",
  },
  radar: {
    title: "Radar",
    body: "Wallet clusters and holder maps. Coming once the desk has a real feed. The flex cards already show who won.",
  },
  marketplace: {
    title: "Marketplace",
    body: "Presets and wallet packs from other desks. Save a preset on a launch in the meantime.",
  },
};

export function SoonPage({ slug }: { slug: string }) {
  const item = SOON[slug] ?? { title: "Soon", body: "This tool isn't on the desk yet." };
  return (
    <div>
      <PageIntro kicker="Soon" title={item.title} sub={item.body} />
      <Panel className="max-w-lg p-6 text-sm text-muted">Nothing to configure. The rest of the desk is live.</Panel>
    </div>
  );
}
