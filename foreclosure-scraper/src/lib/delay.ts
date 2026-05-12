export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function jitter(baseMs: number, spread = 0.4): number {
  const delta = baseMs * spread;
  return Math.max(0, baseMs + (Math.random() * 2 - 1) * delta);
}
