export function centsToEuroInput(cents: number) {
  return (Number(cents ?? 0) / 100).toFixed(2);
}
