/** How many events each animation sport/platform suite should sample. */
export const ANIMATION_EVENTS_PER_SPORT = 2;

/**
 * Pick up to `take` distinct random indices from `0..total-1`.
 * Returns indices sorted ascending so list traversal stays stable.
 */
export function pickRandomIndices(total: number, take = ANIMATION_EVENTS_PER_SPORT): number[] {
  if (total <= 0 || take <= 0) return [];
  const n = Math.min(take, total);
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).sort((a, b) => a - b);
}
