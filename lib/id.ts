/**
 * Wrapped in one place so v2 can switch to server-issued ids without touching
 * the reducer. Available in every target browser and in Node 18+.
 */
export function newId(): string {
  return crypto.randomUUID();
}
