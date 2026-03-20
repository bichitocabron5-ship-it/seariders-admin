// src/lib/passes.ts
export function makePassCode() {
  // BN-1234-567
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(100 + Math.random() * 900);
  return `BN-${a}-${b}`;
}