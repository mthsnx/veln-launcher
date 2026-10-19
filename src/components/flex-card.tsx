import { useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { SOL_USD, pct, signedSol, signedUsd } from "@/lib/format";
import { buyModeLabel, styleLabel } from "@/lib/plan";
import type { Project } from "@/lib/types";
import { cn, hashString } from "@/lib/utils";
import { TokenMark } from "@/components/token-mark";
import { Button } from "@/components/ui";

export function pnlPct(project: Project) {
  if (project.spentSol <= 0) return 0;
  return (project.pnlSol / project.spentSol) * 100;
}

export function FlexCard({ project, featured = false }: { project: Project; featured?: boolean }) {
  const up = project.pnlSol >= 0 && project.status !== "failed";
  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-line bg-black p-4",
        featured ? "min-h-80" : "h-full",
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-px", up ? "bg-gold" : "bg-loss")} />
      <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-faint uppercase">
        <span>VELN</span>
        <span className={up ? "text-gain" : "text-loss"}>{project.status === "failed" ? "Failed" : up ? "Profit" : "Loss"}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {project.image ? (
          <img src={project.image} alt="" className="size-12 rounded-md object-cover" />
        ) : (
          <TokenMark seed={project.symbol} className="size-12" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm text-muted">{project.name}</p>
          <p className="truncate text-lg font-semibold tracking-tight">${project.symbol}</p>
        </div>
      </div>
      <p className={cn("mt-5 font-mono text-3xl font-medium tabular-nums", featured && "text-5xl", up ? "text-gain" : "text-loss")}>
        {signedSol(project.pnlSol)} <span className="text-base">SOL</span>
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-muted">
        {signedUsd(project.pnlSol * SOL_USD)} · {pct(pnlPct(project))}
      </p>
      <div className="mt-auto flex items-end justify-between pt-6 text-xs text-faint">
        <span>
          {styleLabel(project.style)} · {buyModeLabel(project.buyMode)}
        </span>
        <span>{format(project.createdAt, "MMM d")}</span>
      </div>
    </article>
  );
}

export async function downloadFlexCard(project: Project) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts.ready.catch(() => undefined);
  const up = project.pnlSol >= 0 && project.status !== "failed";
  const accent = up ? cssColor("--color-gain", "#3dcc84") : cssColor("--color-loss", "#ff5d5d");
  const bg = cssColor("--color-bg", "#050504");
  const fg = cssColor("--color-fg", "#f6f1e8");
  const muted = cssColor("--color-muted", "#a3988c");
  const gold = cssColor("--color-gold", "#e8a23a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, 984, 1254);
  ctx.fillStyle = gold;
  ctx.font = "600 28px Outfit, sans-serif";
  ctx.fillText("VELN", 96, 140);
  ctx.fillStyle = accent;
  ctx.font = "500 22px Outfit, sans-serif";
  const tag = project.status === "failed" ? "FAILED" : up ? "PROFIT" : "LOSS";
  ctx.fillText(tag, 860, 140);
  if (project.image) {
    try {
      const img = await loadImage(project.image);
      ctx.save();
      roundRect(ctx, 96, 220, 160, 160, 24);
      ctx.clip();
      ctx.drawImage(img, 96, 220, 160, 160);
      ctx.restore();
    } catch {
      paintFallback(ctx, 96, 220, project.symbol);
    }
  } else {
    paintFallback(ctx, 96, 220, project.symbol);
  }
  ctx.fillStyle = muted;
  ctx.font = "500 32px Outfit, sans-serif";
  ctx.fillText(project.name, 96, 460);
  ctx.fillStyle = fg;
  ctx.font = "600 84px Outfit, sans-serif";
  ctx.fillText(`$${project.symbol}`, 96, 560);
  ctx.fillStyle = accent;
  ctx.font = "500 120px 'IBM Plex Mono', monospace";
  ctx.fillText(`${signedSol(project.pnlSol, 2)} SOL`, 96, 760);
  ctx.fillStyle = muted;
  ctx.font = "400 36px 'IBM Plex Mono', monospace";
  ctx.fillText(`${signedUsd(project.pnlSol * SOL_USD)}   ${pct(pnlPct(project))}`, 96, 840);
  ctx.strokeStyle = cssColor("--color-line", "#2c2823");
  ctx.beginPath();
  ctx.moveTo(96, 1120);
  ctx.lineTo(984, 1120);
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.font = "400 28px Outfit, sans-serif";
  ctx.fillText(`${styleLabel(project.style)} · ${project.walletCount} wallets · ${format(project.createdAt, "MMM d, yyyy")}`, 96, 1188);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `veln-${project.symbol.toLowerCase()}.png`;
  a.click();
  toast.success("Flex card saved");
}

function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintFallback(ctx: CanvasRenderingContext2D, x: number, y: number, seed: string) {
  const gold = cssColor("--color-gold", "#e8a23a");
  const dim = cssColor("--color-gold-dim", "#2a2112");
  ctx.fillStyle = dim;
  roundRect(ctx, x, y, 160, 160, 24);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.font = "600 54px Outfit, sans-serif";
  ctx.fillText((seed || "?").slice(0, 1), x + 58, y + 100);
  void hashString(seed);
}

export function FlexActions({ project }: { project: Project }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => void downloadFlexCard(project)}>
          <Download className="size-4" />
          Save card
        </Button>
        <Button
          variant="soft"
          className="flex-1"
          onClick={() => {
            const line = `VELN $${project.symbol} ${signedSol(project.pnlSol)} SOL (${pct(pnlPct(project))})`;
            void navigator.clipboard.writeText(line).then(
              () => toast.success("Caption copied"),
              () => toast.error("Couldn't copy"),
            );
          }}
        >
          Copy caption
        </Button>
      </div>
      {project.mint ? (
        <div className="flex gap-2">
          <a
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-line-strong text-[13px] text-fg hover:bg-surface-2"
            href={`https://pump.fun/coin/${project.mint}`}
            target="_blank"
            rel="noreferrer"
          >
            View coin
          </a>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void import("@/lib/solana/run-launch")
                .then(({ sellLive }) => sellLive(project))
                .then(() => toast.success("Sold"))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Sell failed"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Waiting for Phantom…" : "Sell"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
