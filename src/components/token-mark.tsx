import { hashString } from "@/lib/utils";

export function TokenMark({ seed, className }: { seed: string; className?: string }) {
  const h = hashString(seed || "veln");
  const v = h % 6;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--color-gold-dim)" />
      <g fill="none" stroke="var(--color-gold)" strokeWidth="2.4" strokeLinejoin="round">
        {v === 0 && <path d="M32 12 50 32 32 52 14 32Z" />}
        {v === 1 && (
          <>
            <circle cx="32" cy="32" r="16" />
            <circle cx="32" cy="32" r="5" fill="var(--color-gold)" stroke="none" />
          </>
        )}
        {v === 2 && (
          <>
            <path d="M16 22h32M16 32h32M16 42h32" />
          </>
        )}
        {v === 3 && <path d="M18 42 32 16l14 26" />}
        {v === 4 && (
          <>
            <rect x="16" y="16" width="14" height="14" />
            <rect x="34" y="34" width="14" height="14" />
            <path d="M34 22h14v8H34zM16 34h14v8H16z" fill="var(--color-gold)" stroke="none" />
          </>
        )}
        {v === 5 && (
          <>
            <circle cx="32" cy="32" r="14" />
            <path d="M32 18v28M18 32h28" />
          </>
        )}
      </g>
    </svg>
  );
}
