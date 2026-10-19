import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#e8a23a" />
      <path fill="#1a1208" d="M8.2 9.2h3.4l4.4 8.6 4.4-8.6h3.4L16 23.4 8.2 9.2z" />
      <path fill="#1a1208" fillOpacity="0.35" d="M11.6 9.2h8.8L16 17.2 11.6 9.2z" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "soft" | "danger" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-gold text-ink hover:bg-gold-2",
        variant === "ghost" && "border border-line bg-transparent text-fg hover:bg-surface",
        variant === "soft" && "bg-surface-3 text-fg hover:bg-surface-2",
        variant === "danger" && "bg-loss/15 text-loss hover:bg-loss/25",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[13px] text-fg">
      <span>{children}</span>
      {hint ? <Tip text={hint} /> : null}
    </div>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="size-3.5 text-faint" aria-hidden />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-bg p-2.5 text-xs leading-relaxed text-muted group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-gold";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-overlay" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line-strong bg-bg-elev p-5 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-gold" : "bg-surface-3")}
    >
      <span
        className={cn(
          "absolute top-0.5 block size-5 rounded-full bg-fg shadow-sm transition-transform",
          on ? "translate-x-5 bg-ink" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function PageIntro({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <header className="mb-6">
      {kicker ? <p className="mb-1 text-sm text-muted">{kicker}</p> : null}
      <h1 className="text-[1.65rem] font-semibold tracking-tight text-fg">{title}</h1>
      {sub ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{sub}</p> : null}
    </header>
  );
}

export function SolGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M3.2 4.2h9.8L11.4 2.6H3.8L3.2 4.2zm.4 4.2h9.6L11.6 6.8H4.2l-.6 1.6zM3.2 12.4h9.8l-1.6-1.6H3.8l-.6 1.6z"
      />
    </svg>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
