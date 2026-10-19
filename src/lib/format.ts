export const SOL_USD = 184.62;

export function signedUsd(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

export function plainUsd(n: number) {
  return `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sol(n: number, digits = 4) {
  return Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  });
}

export function signedSol(n: number, digits = 3) {
  const body = sol(n, digits);
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

export function shortAddr(a: string) {
  if (a.length < 10) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function relTime(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

export function pct(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return "0%";
}

export function utcDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function hoursAgo(h: number) {
  return Date.now() - h * 3_600_000;
}
