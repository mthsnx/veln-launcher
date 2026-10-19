import { useState, type ReactNode } from "react";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { relTime, shortAddr, signedSol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { Button, FieldLabel, fieldClass } from "@/components/ui";

const TABS = ["Account", "General", "Presets", "Activity", "Quick actions"] as const;
type Tab = (typeof TABS)[number];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Account");
  const settings = useVeln((s) => s.settings);
  const patch = useVeln((s) => s.patchSettings);
  const address = useVeln((s) => s.mainAddress);
  const presets = useVeln((s) => s.presets);
  const activity = useVeln((s) => s.activity);
  const apply = useVeln((s) => s.applyPreset);
  const remove = useVeln((s) => s.deletePreset);
  const reset = useVeln((s) => s.resetDemo);

  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(
      () => toast.success("Address copied"),
      () => toast.error("Couldn't copy"),
    );
  }

  async function logOut() {
    const { disconnectPhantom } = await import("@/lib/solana/phantom");
    await disconnectPhantom();
    useVeln.getState().disconnect();
    toast("Logged out. Connect Phantom to get back in.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Launch defaults, saved presets, and this wallet's activity.</p>

      <div className="mt-6 flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2 text-sm",
              tab === item ? "border-gold text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Account" ? (
        <div className="mt-4 space-y-3">
          <Card title="Connected wallet" body="Phantom is the account. It pays the buys and signs the launches.">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-black/40 px-3 py-3">
              <div>
                <p className="text-[11px] text-faint">Your Phantom wallet</p>
                <p className="mt-1 font-mono text-sm">{address ? shortAddr(address) : "Not connected"}</p>
              </div>
              <button type="button" onClick={copyAddress} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted hover:text-fg">
                <Copy className="size-3.5" />
                Copy
              </button>
            </div>
          </Card>
          <Card title="Security" body="The desk never asks for a seed to sign in.">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>Never share a seed phrase. Export one only when you mean to move that wallet.</li>
              <li>Read the Phantom prompt before you approve it.</li>
              <li>Log out requires a new Phantom approval to get back in.</li>
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "General" ? (
        <Card className="mt-4" title="Launch defaults" body="Used when a new launch does not set its own number.">
          <label className="block">
            <FieldLabel>Slippage · {settings.defaultSlippage}%</FieldLabel>
            <input className="w-full accent-gold" type="range" min={1} max={100} value={settings.defaultSlippage} onChange={(e) => patch({ defaultSlippage: Number(e.target.value) })} />
          </label>
          <label className="mt-4 block">
            <FieldLabel>Priority fee (SOL)</FieldLabel>
            <input className={`${fieldClass} font-mono`} inputMode="decimal" value={settings.defaultTip} onChange={(e) => patch({ defaultTip: e.target.value })} />
          </label>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Hide balances</p>
              <p className="text-xs text-muted">Replace SOL figures with dots.</p>
            </div>
            <button
              type="button"
              onClick={() => patch({ hideBalances: !settings.hideBalances })}
              className={cn("min-h-9 rounded-md px-3 text-sm", settings.hideBalances ? "bg-gold text-ink" : "border border-line text-muted")}
            >
              {settings.hideBalances ? "Hidden" : "Shown"}
            </button>
          </div>
        </Card>
      ) : null}

      {tab === "Presets" ? (
        <Card className="mt-4" title="Presets" body="Saved from Token Launch. Applying one fills the draft you have open.">
          {presets.length === 0 ? (
            <p className="text-sm text-muted">None yet. Save one on the last step of a launch.</p>
          ) : (
            <ul className="divide-y divide-line">
              {presets.map((preset) => (
                <li key={preset.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{preset.name}</p>
                    <p className="text-xs text-faint">{preset.buyMode} · {preset.slippage}% · {preset.devBudget || preset.totalSol} SOL</p>
                  </div>
                  <Button variant="ghost" className="min-h-9" onClick={() => { apply(preset.id); toast.success("Preset applied"); }}>Apply</Button>
                  <button type="button" aria-label="Delete preset" className="grid size-9 place-items-center text-faint hover:text-loss" onClick={() => remove(preset.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "Activity" ? (
        <Card className="mt-4" title="Activity" body="Only what this wallet has actually done.">
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.slice(0, 20).map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="w-16 shrink-0 text-xs text-faint">{relTime(item.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.title}</span>
                    <span className="block truncate text-xs text-faint">{item.subtitle}</span>
                  </span>
                  <span className={cn("font-mono text-xs tabular-nums", item.pnlSol >= 0 ? "text-gain" : "text-loss")}>{signedSol(item.pnlSol)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "Quick actions" ? (
        <Card className="mt-4" title="Quick actions" body="Things you do often, without leaving settings.">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={copyAddress}>Copy wallet</Button>
            <Button
              variant="ghost"
              onClick={() => {
                void import("@/lib/solana/run-launch")
                  .then(({ refreshLiveBalance }) => refreshLiveBalance())
                  .then(() => toast.success("Balance refreshed"))
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't refresh"));
              }}
            >
              Refresh balance
            </Button>
            <Button variant="ghost" onClick={() => void logOut()}>
              <LogOut className="size-4" />
              Log out
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                toast.success("This wallet's book was cleared");
              }}
            >
              Reset this wallet
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Card({ title, body, children, className }: { title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-bg-elev p-5", className)}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
