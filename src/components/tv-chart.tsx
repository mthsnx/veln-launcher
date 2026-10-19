import { useState } from "react";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1h" },
  { id: "240", label: "4h" },
  { id: "D", label: "1D" },
] as const;

/** Official TradingView chart. A mint uses Birdeye's TradingView chart for that Solana pair. */
export function TradingViewChart({ mint, className }: { mint?: string; className?: string }) {
  const [interval, setInterval] = useState<(typeof RANGES)[number]["id"]>("15");
  const src = mint
    ? `https://embed.birdeye.so/tv-widget/${mint}?chain=solana&viewMode=pair&chartInterval=${interval}&chartType=Candle&chartLeftToolbar=show&theme=dark`
    : `https://s.tradingview.com/widgetembed/?symbol=BINANCE%3ASOLUSDT&interval=${interval === "D" ? "D" : interval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0b0b0b&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&locale=en`;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/10 bg-black", className)}>
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="mr-2 text-[11px] text-white/40">{mint ? "Pair" : "SOL / USDT"}</span>
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setInterval(item.id)}
            className={cn(
              "rounded px-2 py-1 text-xs",
              interval === item.id ? "bg-white text-black" : "text-white/50 hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <iframe
        key={src}
        title="TradingView chart"
        src={src}
        className="h-[560px] w-full bg-black md:h-[680px]"
        allow="fullscreen"
        loading="lazy"
      />
    </div>
  );
}
