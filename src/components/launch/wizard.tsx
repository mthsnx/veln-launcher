import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Copy,
  Crown,
  Download,
  Globe,
  Plus,
  Rocket,
  Search,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { shortAddr, sol } from "@/lib/format";
import { extractSolAddress, lookupLiveCoin } from "@/lib/live-tokens";
import {
  BUY_MODES,
  MIN_BUNDLE,
  MIN_DEV,
  buyModeLabel,
  capitalOf,
  stepBlocker,
  styleLabel,
} from "@/lib/plan";
import type { BuyMode, StyleId, Wallet as WalletT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { TokenMark } from "@/components/token-mark";
import { Button, FieldLabel, Modal, Panel, SolGlyph, Switch, fieldClass } from "@/components/ui";
import { CreateWalletModal, FundWalletModal, ImportWalletModal, exportWallets } from "@/components/wallet-dialogs";

const STYLES: { id: StyleId; title: string; kicker: string; body: string; icon: typeof Rocket }[] = [
  {
    id: "bundle",
    title: "NEW BUNDLE",
    kicker: "Create",
    body: "Create and launch a new token with bundled wallets",
    icon: Box,
  },
  {
    id: "vamp",
    title: "VAMP",
    kicker: "Copy",
    body: "Copy any token's metadata and launch your own",
    icon: Copy,
  },
  {
    id: "cto",
    title: "CTO",
    kicker: "Take over",
    body: "Take over an existing token with your own wallets",
    icon: Crown,
  },
];

const STEP_LABELS = ["Token", "Buy Mode", "Wallets", "Settings", "Review"];

export function StylePicker() {
  const draft = useVeln((s) => s.draft);
  const start = useVeln((s) => s.startDraft);
  const navigate = useNavigate();
  const dirty = Boolean(draft.name.trim() || draft.sourceAddress || draft.phase === "steps");

  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Step 1 · Launch style</p>
      <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight">Token Launch</h1>
      <p className="mt-1.5 max-w-xl text-sm text-muted">Create and bundle your token on Pump.fun.</p>
      {dirty ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium">Resume your unsaved project?</p>
            <p className="text-xs text-muted">Pick up {styleLabel(draft.style)} where you left it. A fresh contract address is reserved on review.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => start("bundle")}>Start fresh</Button>
            <Button onClick={() => void navigate({ to: "/launch/$style", params: { style: draft.style } })}>Resume</Button>
          </div>
        </div>
      ) : null}
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              start(s.id);
              void navigate({ to: "/launch/$style", params: { style: s.id } });
            }}
            className="group flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-10 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition duration-150 hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-[0_16px_40px_rgb(0_0_0/0.28)]"
          >
            <span className="grid size-16 place-items-center rounded-full border border-gold/30 bg-gold-dim text-gold">
              <s.icon className="size-5" />
            </span>
            <span className="mt-5 text-sm font-semibold tracking-[0.16em]">{s.title}</span>
            <span className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">{s.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Wizard({ style }: { style: string }) {
  const draft = useVeln((s) => s.draft);
  const start = useVeln((s) => s.startDraft);
  const patch = useVeln((s) => s.patchDraft);
  const connected = useVeln((s) => s.connected);

  useEffect(() => {
    if (style !== "bundle" && style !== "vamp" && style !== "cto") return;
    if (draft.style !== style) start(style);
  }, [style, draft.style, start]);

  useEffect(() => {
    if (!connected || draft.devWalletId) return;
    patch({ devWalletId: "main" });
  }, [connected, draft.devWalletId, patch]);

  if (style !== "bundle" && style !== "vamp" && style !== "cto") {
    return (
      <Panel className="p-6">
        <p>That launch style doesn't exist.</p>
        <Link to="/launch" className="mt-3 inline-block text-gold">Back to styles</Link>
      </Panel>
    );
  }

  if (!connected) {
    return (
      <Panel className="p-6">
        <h1 className="text-xl font-semibold">Connect a wallet first</h1>
        <p className="mt-1 text-sm text-muted">Connect Phantom. The next screen spends real SOL on Pump.fun. Nothing is custodied here.</p>
        <Button className="mt-4" onClick={() => {
          void import("@/lib/solana/run-launch")
            .then(({ attachPhantom }) => attachPhantom(false))
            .then(() => toast.success("Phantom connected"))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Phantom rejected the connection"));
        }}>
          Connect Phantom
        </Button>
      </Panel>
    );
  }

  if (draft.style !== style) return null;
  if (draft.phase === "setup") return <Setup />;
  return <Steps />;
}

function compactMc(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function Setup() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const venues = [
    {
      chain: "Solana",
      unit: "SOL",
      items: [
        { id: "Pump.fun", blurb: "Fast Bundle, Timed Buys, pairs, Mayhem mode and fee sharing.", live: true },
        { id: "Paid", blurb: "Creator fees go to Paid for an X account. Payouts are paused.", live: false },
        { id: "StonkFun", blurb: "Checking launch availability. You can prepare a launch later.", live: false, pending: true },
      ],
    },
    {
      chain: "Robinhood Chain",
      unit: "ETH",
      items: [{ id: "Pons", blurb: "Fast Bundle, stock pairs and a creator tax up to 10%.", live: false }],
    },
  ];

  return (
    <div>
      <Top backTo="/launch" />
      <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Step 2 · Destination</p>
      <h1 className="mt-2 text-2xl font-semibold">Where should it launch?</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Solana, Base, Arc or Robinhood Chain. Every launchpad runs the same five steps.</p>
      <p className="mt-3 text-sm text-muted">
        Style <span className="rounded-full border border-gold/40 px-2 py-0.5 text-xs font-medium tracking-wide text-gold">{styleLabel(draft.style)}</span>
        <span className="ml-2">{draft.style === "vamp" ? "VAMP copies metadata, then launches a new mint on the venue you pick." : draft.style === "cto" ? "CTO buys an existing mint with your wallets." : "A new mint with bundled wallets."}</span>
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {venues.map((col) => (
          <div key={col.chain} className="rounded-xl border border-line bg-surface p-2">
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="font-medium">{col.chain}</span>
              <span className="text-xs text-faint">{col.unit}</span>
            </div>
            <div className="space-y-1">
              {col.items.map((item) => {
                const on = item.live && draft.platform === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!item.live) {
                        toast.error(`${item.id} is still under development.`);
                        return;
                      }
                      patch({ platform: item.id });
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left",
                      on ? "bg-gold-dim" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <span className="grid size-9 place-items-center rounded-md border border-line bg-black text-xs font-semibold text-gold">
                      {item.id.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        {item.id}
                        {"pending" in item && item.pending ? (
                          <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-faint">Status pending</span>
                        ) : null}
                        {!item.live && !("pending" in item && item.pending) ? (
                          <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-faint">Dev</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{item.blurb}</span>
                    </span>
                    <ArrowRight className="size-4 text-faint" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button disabled={draft.platform !== "Pump.fun"} onClick={() => patch({ phase: "steps", step: 1 })}>
          Continue <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Steps() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const wallets = useVeln((s) => s.wallets);
  const connected = useVeln((s) => s.connected);
  const mainBalance = useVeln((s) => s.mainBalance);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const live = connected ? { balance: mainBalance } : null;

  const err = stepBlocker(draft, wallets, draft.step, live);

  function back() {
    if (draft.step <= 1) patch({ phase: "setup" });
    else patch({ step: draft.step - 1 });
  }

  function next() {
    const block = stepBlocker(draft, wallets, draft.step, live);
    if (block) {
      toast.error(block);
      return;
    }
    patch({ step: Math.min(5, draft.step + 1) });
  }

  async function fire() {
    setBusy(true);
    try {
      const { runLiveLaunch } = await import("@/lib/solana/run-launch");
      const res = await runLiveLaunch();
      toast.success(`${draft.symbol.toUpperCase()} is live`);
      void navigate({ to: "/projects/$id", params: { id: res.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Launch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Top onBack={back} />
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const on = draft.step === n;
          const done = draft.step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!done && !on}
                onClick={() => done && patch({ step: n })}
                className={cn(
                  "grid size-8 place-items-center rounded-full text-sm",
                  on || done ? "bg-gold text-ink" : "bg-surface-3 text-faint",
                )}
                aria-label={label}
              >
                {n}
              </button>
              {i < STEP_LABELS.length - 1 ? <span className={cn("hidden h-px w-8 sm:block", done ? "bg-gold" : "bg-line")} /> : null}
            </div>
          );
        })}
      </div>
      {draft.step === 1 ? <MetaStep /> : null}
      {draft.step === 2 ? <ModeStep /> : null}
      {draft.step === 3 ? <WalletStep /> : null}
      {draft.step === 4 ? <SettingsStep /> : null}
      {draft.step === 5 ? <ReviewStep /> : null}
      {err && draft.step >= 4 ? (
        <p className="mx-auto mt-4 max-w-3xl rounded-md border border-loss/40 bg-loss-dim px-3 py-3 text-sm text-loss">{err}</p>
      ) : null}
      <div className="mt-6 flex justify-center">
        {draft.step < 5 ? (
          <Button className="min-w-56" onClick={next}>
            {draft.step === 1 && draft.style !== "bundle" ? "Continue with this token" : "Continue"}
          </Button>
        ) : (
          <Button className="min-w-44" disabled={busy} onClick={() => void fire()}>
            {busy ? "Waiting for Phantom…" : draft.style === "cto" ? "Buy on Pump.fun" : "Launch on Pump.fun"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Top({ backTo, onBack }: { backTo?: "/launch"; onBack?: () => void }) {
  const draft = useVeln((s) => s.draft);
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs tracking-widest text-faint uppercase">{draft.platform} · Solana</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          {onBack ? (
            <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-md border border-line" aria-label="Back">
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <Link to={backTo ?? "/launch"} className="grid size-9 place-items-center rounded-md border border-line" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
          )}
          {styleLabel(draft.style).toUpperCase()}
        </h1>
        {draft.phase === "steps" ? (
          <p className="mt-1 text-xs text-muted">Step {draft.step} of 5 - {STEP_LABELS[draft.step - 1]}</p>
        ) : null}
      </div>
      <Link to="/launch" className="hidden min-h-11 items-center rounded-md border border-line px-3 text-sm text-muted hover:text-fg sm:inline-flex">
        Back to launch styles
      </Link>
    </div>
  );
}

function MetaStep() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const readOnly = draft.style === "cto";
  const copying = draft.style === "vamp" || draft.style === "cto";
  const [addr, setAddr] = useState(draft.sourceAddress);
  const [pulling, setPulling] = useState(false);
  const [mc, setMc] = useState<number | null>(null);
  const [customize, setCustomize] = useState(draft.style === "bundle");

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Use an image file.");
      return;
    }
    const data = await resizeImage(file);
    patch({ image: data });
  }

  async function pull() {
    const query = addr.trim();
    if (!extractSolAddress(query)) {
      toast.error("Paste a Solana mint or pair address.");
      return;
    }
    setPulling(true);
    try {
      const hit = await lookupLiveCoin({ data: { query } });
      if (!hit) {
        toast.error("No Solana coin for that address.");
        return;
      }
      const symbol = hit.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      setMc(hit.marketCap || null);
      setAddr(hit.address);
      patch({
        sourceAddress: hit.address,
        sourceName: hit.name,
        name: hit.name.slice(0, 32),
        symbol: symbol || "COIN",
        description: hit.description.slice(0, 500),
        image: hit.image,
        website: hit.website,
        xUrl: hit.xUrl,
        telegram: hit.telegram,
        platform: "Pump.fun",
      });
      toast.success(`${hit.symbol} · ${shortAddr(hit.address)}`);
    } catch {
      toast.error("Couldn't reach the market. Try that address again.");
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {copying ? (
        <div>
          <FieldLabel>Token address</FieldLabel>
          <div className="flex gap-2">
            <input
              className={`${fieldClass} font-mono`}
              placeholder="Enter any Solana token mint address..."
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void pull();
              }}
            />
            <Button className="px-3" disabled={pulling} onClick={() => void pull()} aria-label="Look up token">
              <Search className="size-4" />
            </Button>
          </div>
          <p className="mt-3 text-center text-sm text-muted">
            Enter the token mint address to fetch metadata automatically.
            <span className="mt-1 block text-xs text-faint">Import metadata from any Solana token. {draft.style === "vamp" ? "You still deploy a new mint." : "You buy this existing mint."}</span>
          </p>
          {draft.sourceAddress ? (
            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <div className="flex gap-3">
                {draft.image ? (
                  <img src={draft.image} alt="" referrerPolicy="no-referrer" className="size-14 rounded-md object-cover" />
                ) : (
                  <TokenMark seed={draft.symbol || "X"} className="size-14" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">{draft.name} <span className="text-muted">${draft.symbol}</span></p>
                  <p className="truncate text-xs text-muted">{draft.description || draft.sourceName}</p>
                  {mc ? <p className="mt-1 text-xs text-faint">MC {compactMc(mc)}</p> : null}
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">{draft.sourceAddress}</p>
                </div>
              </div>
              <button type="button" className="mt-4 flex w-full items-center justify-between rounded-md border border-line px-3 py-3 text-sm" onClick={() => setCustomize((v) => !v)}>
                <span>Customize metadata <span className="text-xs text-faint">optional</span></span>
                <span className="text-faint">{customize ? "–" : "+"}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {(!copying || customize) ? (
      <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel hint="Shown on the coin and on your flex card.">Name</FieldLabel>
          <input
            className={fieldClass}
            maxLength={32}
            disabled={readOnly}
            value={draft.name}
            placeholder="Name"
            onChange={(e) => patch({ name: e.target.value })}
          />
          <p className="mt-1 text-right text-xs text-faint">{draft.name.length}/32</p>
        </label>
        <label className="block">
          <FieldLabel>Ticker</FieldLabel>
          <input
            className={fieldClass}
            maxLength={10}
            disabled={readOnly}
            value={draft.symbol}
            placeholder="TICKER"
            onChange={(e) => patch({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
          />
          <p className="mt-1 text-right text-xs text-faint">{draft.symbol.length}/10</p>
        </label>
      </div>
      <label className="block">
        <FieldLabel>Description</FieldLabel>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          maxLength={500}
          value={draft.description}
          placeholder={readOnly ? "Operator note" : "What is this coin?"}
          onChange={(e) => patch({ description: e.target.value })}
        />
        <p className="mt-1 text-right text-xs text-faint">{draft.description.length}/500</p>
      </label>
      {!readOnly ? (
        <div>
          <FieldLabel hint="Square images read best. We'll crop to the center.">Image</FieldLabel>
          <label
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface text-sm text-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void onFile(f);
            }}
          >
            {draft.image ? (
              <img src={draft.image} alt="Token" referrerPolicy="no-referrer" className="size-20 rounded-md object-cover" />
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
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          {draft.image ? (
            <button type="button" className="mt-2 text-xs text-muted hover:text-fg" onClick={() => patch({ image: null })}>
              Remove image and use the mark
            </button>
          ) : (
            <p className="mt-2 text-xs text-faint">No image yet. The geometric mark is used on the flex card.</p>
          )}
        </div>
      ) : null}
      {!readOnly ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-2 flex items-center gap-1 text-fg"><Globe className="size-3.5 text-faint" /> Website</span>
            <input className={fieldClass} placeholder="https://" value={draft.website} onChange={(e) => patch({ website: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block">X</span>
            <input className={fieldClass} placeholder="https://x.com/" value={draft.xUrl} onChange={(e) => patch({ xUrl: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block">Telegram</span>
            <input className={fieldClass} placeholder="https://t.me/" value={draft.telegram} onChange={(e) => patch({ telegram: e.target.value })} />
          </label>
        </div>
      ) : null}
      </>
      ) : null}
      {draft.style !== "cto" ? (
        <>
          <Choice
            label="Launch mode"
            value={draft.launchMode}
            onChange={(launchMode) => patch({ launchMode })}
            options={[
              { id: "classic", name: "Classic", blurb: "Standard 1B supply." },
              { id: "mayhem", name: "Mayhem", blurb: "High supply. Trading opens immediately." },
            ]}
          />
          <Choice
            label="Pair"
            value={draft.pair}
            onChange={(pair) => patch({ pair })}
            options={[
              { id: "SOL", name: "SOL", blurb: "Standard pair." },
              { id: "USDC", name: "USDC", blurb: "Quoted in dollars. Still funded in SOL here." },
              { id: "CUSTOM", name: "Custom", blurb: "Any ticker you type below." },
            ]}
          />
          {draft.pair === "CUSTOM" ? (
            <input className={fieldClass} placeholder="Pair ticker" value={draft.customPair} onChange={(e) => patch({ customPair: e.target.value.toUpperCase() })} />
          ) : null}
          <ToggleRow
            title="Holder rewards"
            body="Creator fees route to holders. Permanent on this mint."
            on={draft.holderRewards}
            toggle={() => patch({ holderRewards: !draft.holderRewards })}
          />
          <ToggleRow
            title="Share creator rewards"
            body="Split creator fees with the wallets you pick."
            on={draft.shareCreator}
            toggle={() => patch({ shareCreator: !draft.shareCreator })}
          />
        </>
      ) : null}
    </div>
  );
}

function ModeStep() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const presets = useVeln((s) => s.presets);
  const apply = useVeln((s) => s.applyPreset);
  const remove = useVeln((s) => s.deletePreset);
  const cto = draft.style === "cto";
  return (
    <div className="mx-auto max-w-3xl">
      <Panel className="mb-4 p-4">
        <p className="text-sm font-medium">Presets</p>
        {presets.length === 0 ? (
          <p className="mt-1 text-sm text-muted">None saved yet. Build a setup on Settings, then save it.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{p.name}</span>
                <Button variant="ghost" className="min-h-9 px-3" onClick={() => { apply(p.id); toast.success("Preset applied"); }}>Apply</Button>
                <button type="button" className="grid size-9 place-items-center text-faint hover:text-fg" aria-label="Delete preset" onClick={() => remove(p.id)}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mb-3 text-sm text-muted">
        {cto
          ? "Phantom buys the existing coin in one transaction."
          : "Phantom creates the coin and buys in the same transaction. Timed and bundle modes are saved on the card. They are not extra signers."}
      </p>
      <div className="space-y-2">
        {BUY_MODES.map((m) => {
          const on = draft.buyMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => patch({ buyMode: m.id })}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left",
                on ? "border-gold bg-gold-dim" : "border-line bg-surface",
              )}
            >
              <span className="mt-0.5 grid size-8 place-items-center rounded-md bg-surface-3 text-gold">
                <Rocket className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {m.name}
                  {m.tag ? <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-gold">{m.tag}</span> : null}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{m.blurb}</span>
              </span>
              <span className={cn("mt-1 size-4 rounded-full border", on ? "border-gold bg-gold" : "border-line-strong")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function deskWallets(rows: WalletT[], address: string, balance: number): WalletT[] {
  if (!address) return rows;
  const phantom: WalletT = { id: "main", name: "Phantom", address, balance, tag: "Connected" };
  return [phantom, ...rows.filter((w) => w.address !== address && w.id !== "main")];
}

function WalletStep() {
  const draft = useVeln((s) => s.draft);
  const stored = useVeln((s) => s.wallets);
  const mainAddress = useVeln((s) => s.mainAddress);
  const mainBalance = useVeln((s) => s.mainBalance);
  const wallets = deskWallets(stored, mainAddress, mainBalance);
  const patch = useVeln((s) => s.patchDraft);
  const [pick, setPick] = useState(false);
  const [create, setCreate] = useState(false);
  const [imp, setImp] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const dev = wallets.find((w) => w.id === draft.devWalletId);
  const bundle = wallets.filter((w) => draft.bundleWalletIds.includes(w.id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => { patch({ devWalletId: "main" }); toast.success("Phantom is the dev wallet"); }}>
          <Plus className="size-4" /> Dev
        </Button>
        <Button variant="ghost" onClick={() => setCreate(true)}><Plus className="size-4" /> Create</Button>
        <Button variant="soft" onClick={() => setPick(true)}><Wallet className="size-4" /> My wallets</Button>
        <Button variant="ghost" onClick={() => setFundOpen(true)}>Fund</Button>
        <Button variant="ghost" onClick={() => setImp(true)}>Import</Button>
        <Button variant="ghost" onClick={exportWallets}><Download className="size-4" /> Export</Button>
      </div>
      <p className="mt-4 text-sm text-muted">
        Phantom pays this buy in one transaction. Extra wallets on this page are not separate on-chain signers.
      </p>
      <div className="mt-4 rounded-lg border border-dashed border-line p-4">
        {!dev && bundle.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No wallets added yet.<span className="mt-1 block text-xs text-faint">Click + Dev or Create to add wallets.</span></p>
        ) : (
          <ul className="space-y-2">
            {dev ? <WalletLine w={dev} role="Dev" /> : <li className="text-sm text-loss">Dev wallet still required.</li>}
            {draft.buyMode === "dev" ? null : bundle.map((w) => <WalletLine key={w.id} w={w} role="Bundle" />)}
          </ul>
        )}
      </div>
      <p className="mt-2 text-right text-xs text-faint">
        {draft.buyMode === "dev" ? "Dev only" : `${bundle.length} bundle`} · {dev ? "dev set" : "no dev"}
      </p>
      <WalletPicker open={pick} onClose={() => setPick(false)} />
      <CreateWalletModal open={create} onClose={() => setCreate(false)} />
      <ImportWalletModal open={imp} onClose={() => setImp(false)} />
      <FundWalletModal open={fundOpen} walletId={dev?.id ?? null} onClose={() => setFundOpen(false)} />
    </div>
  );
}

function WalletLine({ w, role }: { w: WalletT; role: string }) {
  const hide = useVeln((s) => s.settings.hideBalances);
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-bg px-3 py-2">
      <span className="rounded bg-gold-dim px-1.5 py-0.5 text-xs text-gold">{role}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{w.name}</span>
        <span className="font-mono text-xs text-faint">{shortAddr(w.address)}</span>
      </span>
      <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
        <SolGlyph className="size-3.5 text-gold" />
        {hide ? "••••" : sol(w.balance, 4)}
      </span>
    </li>
  );
}

function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stored = useVeln((s) => s.wallets);
  const mainAddress = useVeln((s) => s.mainAddress);
  const mainBalance = useVeln((s) => s.mainBalance);
  const wallets = deskWallets(stored, mainAddress, mainBalance);
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const hide = useVeln((s) => s.settings.hideBalances);
  const [stage, setStage] = useState<1 | 2>(1);
  const [q, setQ] = useState("");
  const [dev, setDev] = useState<string | null>(draft.devWalletId);
  const [bundle, setBundle] = useState<string[]>(draft.bundleWalletIds);

  useEffect(() => {
    if (!open) return;
    setStage(1);
    setDev(draft.devWalletId);
    setBundle(draft.bundleWalletIds);
    setQ("");
  }, [open, draft.devWalletId, draft.bundleWalletIds]);

  const list = wallets.filter((w) => `${w.name} ${w.address}`.toLowerCase().includes(q.toLowerCase()));

  function commitBundles(nextDev: string | null, nextBundle: string[]) {
    patch({
      devWalletId: nextDev,
      bundleWalletIds: nextBundle.filter((id) => id !== nextDev),
    });
    onClose();
  }

  return (
    <Modal open={open} title="My wallets" onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{stage === 1 ? "Pick the dev wallet" : "Pick bundle wallets"}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center"><X className="size-4" /></button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {stage === 1 ? "This wallet creates or leads the buy. Exactly one." : "These wallets buy with the dev. Skip any you won't use."}
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-faint" />
        <input className={`${fieldClass} pl-9`} placeholder="Search wallets" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {list.map((w) => {
          const on = stage === 1 ? dev === w.id : bundle.includes(w.id);
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => {
                  if (stage === 1) setDev(w.id);
                  else setBundle((cur) => (cur.includes(w.id) ? cur.filter((id) => id !== w.id) : [...cur, w.id]));
                }}
                className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left", on ? "border-gold" : "border-line")}
              >
                <span className={cn("size-4 rounded-full border", on ? "border-gold bg-gold" : "border-line-strong")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{w.name}</span>
                  <span className="font-mono text-xs text-faint">{shortAddr(w.address)}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{hide ? "••••" : `${sol(w.balance, 4)} SOL`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {stage === 1 && draft.buyMode !== "dev" ? (
          <Button
            disabled={!dev}
            onClick={() => setStage(2)}
          >
            Next
          </Button>
        ) : (
          <Button disabled={!dev} onClick={() => commitBundles(dev, draft.buyMode === "dev" ? [] : bundle)}>
            Use wallets
          </Button>
        )}
      </div>
    </Modal>
  );
}

function SettingsStep() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const wallets = useVeln((s) => s.wallets);
  const equal = useVeln((s) => s.setEqualAmounts);
  const applyPct = useVeln((s) => s.applyBundlePct);
  const save = useVeln((s) => s.savePreset);
  const hide = useVeln((s) => s.settings.hideBalances);
  const [tab, setTab] = useState<"snipers" | "sell" | "tp" | "retry">("snipers");
  const [auto, setAuto] = useState<null | "bump" | "buy" | "maker">(null);
  const [preset, setPreset] = useState(false);
  const dev = wallets.find((w) => w.id === draft.devWalletId);
  const rows = draft.buyMode === "dev" ? [] : wallets.filter((w) => draft.bundleWalletIds.includes(w.id));

  function setAmount(id: string, value: string) {
    patch({ distribution: "custom", amounts: { ...draft.amounts, [id]: value } });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel className="flex items-center justify-between px-4 py-3 text-sm">
        <span>Wallets from the previous step</span>
        <span className="text-gold">{1 + rows.length} wallets</span>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <FieldLabel hint="Split across bundle wallets when distribution is equal.">Total SOL for the bundle</FieldLabel>
          <input
            className={`${fieldClass} font-mono`}
            inputMode="decimal"
            disabled={draft.buyMode === "dev"}
            value={draft.totalSol}
            onChange={(e) => {
              patch({ totalSol: e.target.value });
              queueMicrotask(() => useVeln.getState().setEqualAmounts());
            }}
          />
          <p className="mt-1 text-xs text-faint">Minimum {MIN_BUNDLE} SOL on each bundle wallet.</p>
        </label>
        <label>
          <FieldLabel hint={`Deploy fee sits on top of this buy. Minimum ${MIN_DEV} SOL.`}>Dev buy (SOL)</FieldLabel>
          <input
            className={`${fieldClass} font-mono`}
            inputMode="decimal"
            placeholder="0.05"
            value={draft.devBudget}
            onChange={(e) => patch({ devBudget: e.target.value })}
          />
          {dev ? <p className="mt-1 text-xs text-faint">Dev balance {hide ? "••••" : `${sol(dev.balance, 4)} SOL`}</p> : null}
        </label>
      </div>
      {draft.buyMode !== "dev" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { patch({ distribution: "equal" }); equal(); }} className={cn("min-h-11 rounded-md border", draft.distribution === "equal" ? "border-gold bg-gold text-ink" : "border-line bg-surface")}>Equal</button>
            <button type="button" onClick={() => patch({ distribution: "custom" })} className={cn("min-h-11 rounded-md border", draft.distribution === "custom" ? "border-gold bg-gold text-ink" : "border-line bg-surface")}>Custom</button>
          </div>
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">Use a percent of each bundle wallet</p>
              <div className="flex gap-1">
                {[90, 95, 100].map((n) => (
                  <button key={n} type="button" onClick={() => patch({ bundlePct: n })} className={cn("min-h-9 rounded-md px-2 text-xs", draft.bundlePct === n ? "bg-gold text-ink" : "bg-surface-3 text-muted")}>{n}%</button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <input className={`${fieldClass} font-mono`} type="number" min={1} max={100} value={draft.bundlePct} onChange={(e) => patch({ bundlePct: Number(e.target.value) })} />
              <Button variant="ghost" onClick={() => { applyPct(); toast.success("Amounts filled from balances"); }}>Apply</Button>
            </div>
          </Panel>
          <div className="space-y-2">
            {rows.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{w.name}</span>
                  <span className="text-xs text-faint">{hide ? "••••" : `${sol(w.balance, 4)} SOL`}</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-gold"
                  onClick={() => setAmount(w.id, String(Math.max(0, Math.round((w.balance - 0.001) * 10000) / 10000)))}
                >
                  Max
                </button>
                <input
                  className="w-28 rounded-md border border-line bg-surface px-2 py-2 font-mono text-sm"
                  inputMode="decimal"
                  value={draft.amounts[w.id] ?? ""}
                  onChange={(e) => setAmount(w.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <FieldLabel>Slippage {draft.slippage}%</FieldLabel>
          <input className="w-full accent-gold" type="range" min={1} max={100} value={draft.slippage} onChange={(e) => patch({ slippage: Number(e.target.value) })} />
        </label>
        <label>
          <FieldLabel hint="Priority tip, paid by the dev wallet.">Jito tip (SOL)</FieldLabel>
          <input className={`${fieldClass} font-mono`} inputMode="decimal" value={draft.jitoTip} onChange={(e) => patch({ jitoTip: e.target.value })} />
        </label>
      </div>
      <div>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1 sm:grid-cols-4">
          {(
            [
              ["snipers", "Farm snipers"],
              ["sell", "Smart sell"],
              ["tp", "Auto TP"],
              ["retry", "Retry"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("min-h-10 rounded text-sm", tab === id ? "bg-surface text-fg" : "text-muted")}>{label}</button>
          ))}
        </div>
        <div className="mt-3">
          {tab === "snipers" ? (
            <ToggleRow title="Farm snipers" body="Sell into outside buys and add the proceeds to the dev buy." on={draft.farmSnipers} toggle={() => patch({ farmSnipers: !draft.farmSnipers })} />
          ) : null}
          {tab === "sell" ? (
            <ToggleRow title="Smart sell" body="Scale out a tranche if the coin clears 2× the launch price." on={draft.smartSell} toggle={() => patch({ smartSell: !draft.smartSell })} />
          ) : null}
          {tab === "tp" ? (
            <label className="block text-sm">
              Take profit at
              <input className={`${fieldClass} mt-2 font-mono`} placeholder="200" value={draft.autoTp} onChange={(e) => patch({ autoTp: e.target.value.replace(/[^\d.]/g, "") })} />
              <span className="mt-1 block text-xs text-faint">Percent gain. Leave empty to skip.</span>
            </label>
          ) : null}
          {tab === "retry" ? (
            <ToggleRow title="Retry a failed landing" body="One more attempt if the first bundle doesn't land. Still simulated." on={draft.retry} toggle={() => patch({ retry: !draft.retry })} />
          ) : null}
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Automations</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="min-h-9" onClick={() => setAuto("bump")}>Bump bot</Button>
            <Button variant="ghost" className="min-h-9" onClick={() => setAuto("buy")}>Buy task</Button>
            <Button variant="ghost" className="min-h-9" onClick={() => setAuto("maker")}>Market maker</Button>
          </div>
        </div>
        {draft.automations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing armed. Add a task and it waits until you launch.
          </div>
        ) : (
          <ul className="space-y-2">
            {draft.automations.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                {a.label}
                <button type="button" className="text-faint hover:text-fg" aria-label="Remove" onClick={() => patch({ automations: draft.automations.filter((x) => x.id !== a.id) })}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setPreset(true)}>Save preset</Button>
      </div>
      <AutoModal kind={auto} onClose={() => setAuto(null)} />
      <PresetModal open={preset} onClose={() => setPreset(false)} onSave={(name) => { save(name); toast.success("Preset saved"); setPreset(false); }} />
    </div>
  );
}

function ReviewStep() {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const save = useVeln((s) => s.savePreset);
  const [preset, setPreset] = useState(false);
  const spent = Math.max(capitalOf(draft), Number(draft.devBudget) || 0);
  const rows = [
    ["Style", styleLabel(draft.style)],
    ["Venue", draft.style === "cto" ? "Pump.fun buy" : "Pump.fun"],
    ["Buy mode", buyModeLabel(draft.buyMode)],
    ["Slippage", `${draft.slippage}%`],
    ["Priority fee", `${draft.jitoTip || "0.0005"} SOL`],
    ["You spend", `${spent.toFixed(4)} SOL`],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <Panel className="p-5">
        <div className="flex items-center gap-3">
          {draft.image ? <img src={draft.image} alt="" referrerPolicy="no-referrer" className="size-14 rounded-md object-cover" /> : <TokenMark seed={draft.symbol || "X"} className="size-14" />}
          <div>
            <p className="text-lg font-semibold">{draft.name || "Untitled"}</p>
            <p className="text-sm text-muted">${draft.symbol || "—"}</p>
          </div>
        </div>
        {draft.description ? <p className="mt-3 text-sm text-muted">{draft.description}</p> : null}
        {draft.style === "vamp" && draft.sourceAddress ? (
          <p className="mt-3 break-all font-mono text-xs text-muted">CA {draft.sourceAddress}</p>
        ) : null}
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {draft.automations.length ? (
          <p className="mt-2 text-xs text-faint">Armed: {draft.automations.map((a) => a.label).join(" · ")}</p>
        ) : null}
        <p className="mt-4 text-xs text-muted">
          Phantom signs the Pump.fun transaction first.
        </p>
      </Panel>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => patch({ step: 4 })}>Edit settings</Button>
        <Button variant="ghost" onClick={() => setPreset(true)}>Save preset</Button>
      </div>
      <PresetModal open={preset} onClose={() => setPreset(false)} onSave={(name) => { save(name); toast.success("Preset saved"); setPreset(false); }} />
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; name: string; blurb: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn("rounded-md border px-3 py-3 text-left", value === o.id ? "border-gold bg-gold-dim" : "border-line bg-surface")}
          >
            <span className="block text-sm font-medium">{o.name}</span>
            <span className="mt-0.5 block text-xs text-muted">{o.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ title, body, on, toggle }: { title: string; body: string; on: boolean; toggle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{body}</p>
      </div>
      <Switch on={on} onClick={toggle} label={title} />
    </div>
  );
}

function PresetModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal open={open} title="Save preset" onClose={onClose}>
      <h2 className="text-lg font-semibold">Save preset</h2>
      <input className={`${fieldClass} mt-3`} placeholder="Morning bundle" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(name || "Preset")}>Save</Button>
      </div>
    </Modal>
  );
}

function AutoModal({ kind, onClose }: { kind: null | "bump" | "buy" | "maker"; onClose: () => void }) {
  const draft = useVeln((s) => s.draft);
  const patch = useVeln((s) => s.patchDraft);
  const [amount, setAmount] = useState("0.05");
  const [delay, setDelay] = useState("3");
  const title = kind === "bump" ? "Bump bot" : kind === "buy" ? "Buy task" : "Market maker";
  return (
    <Modal open={kind !== null} title={title} onClose={onClose}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        {kind === "maker"
          ? "Arms a two-sided quote that starts when the coin is live. Tune the live version later under Market Maker."
          : "It waits on this launch. Nothing fires until you press launch."}
      </p>
      {kind !== "maker" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">SOL
            <input className={`${fieldClass} mt-1 font-mono`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="text-sm">Delay (s)
            <input className={`${fieldClass} mt-1 font-mono`} value={delay} onChange={(e) => setDelay(e.target.value)} />
          </label>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Default book: buys 0.05–0.2 SOL, sells 0.03–0.12 SOL, 50% slippage.</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            const label =
              kind === "maker"
                ? "Market maker"
                : kind === "bump"
                  ? `Bump bot · ${amount} SOL`
                  : `Buy task · ${amount} SOL / ${delay}s`;
            patch({
              automations: [...draft.automations, { id: `${kind}_${Date.now()}`, kind: kind ?? "bump", label }],
            });
            toast.success("Armed for this launch");
            onClose();
          }}
        >
          Arm it
        </Button>
      </div>
    </Modal>
  );
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}
