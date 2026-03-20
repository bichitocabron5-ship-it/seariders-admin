import crypto from "crypto";

export function makeGiftCode() {
  const a = crypto.randomInt(1000, 10000);
  const b = crypto.randomInt(100, 1000);
  return `SR-${a}-${b}`;
}
