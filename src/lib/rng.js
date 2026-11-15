export function rng(seed = 1) {
  let a = seed;
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  return next;
}
