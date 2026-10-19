/** Every launch fee and profit fee is sent here. Not editable in the desk. */
export const FEE_WALLET = "B4t3JQkuXrGdfSDeH3vFDFbzpm5SFjbxuLiumCQasqEg";

export const DEFAULT_LAUNCH_FEE_BPS = 100;
export const DEFAULT_PROFIT_FEE_BPS = 1000;
export const MIN_LAUNCH_FEE_SOL = 0.005;

export function launchFeeSol(spendSol: number, bps = DEFAULT_LAUNCH_FEE_BPS) {
  const raw = (Math.max(0, spendSol) * bps) / 10_000;
  const fee = Math.max(MIN_LAUNCH_FEE_SOL, raw);
  return Math.round(fee * 1e6) / 1e6;
}

export function profitFeeSol(profitSol: number, bps = DEFAULT_PROFIT_FEE_BPS) {
  if (profitSol <= 0) return 0;
  return Math.round(((profitSol * bps) / 10_000) * 1e6) / 1e6;
}
