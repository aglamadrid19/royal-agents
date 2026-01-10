const MOVE_DECIMALS = 8;
const DECIMAL_FACTOR = 10 ** MOVE_DECIMALS;

export function parseMoveAmount(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Amount is required.");
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be numeric.");
  }
  const [wholePart, fractionalPart = ""] = trimmed.split(".");
  if (fractionalPart.length > MOVE_DECIMALS) {
    throw new Error("Amount has too many decimal places.");
  }
  const paddedFraction = (fractionalPart + "0".repeat(MOVE_DECIMALS)).slice(0, MOVE_DECIMALS);
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt(paddedFraction || "0");
  const value = whole * BigInt(DECIMAL_FACTOR) + fraction;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount is too large.");
  }
  return Number(value);
}

export function formatMoveAmount(octas: number): string {
  if (!Number.isFinite(octas)) {
    return "0";
  }
  const value = Math.trunc(octas);
  const whole = Math.floor(value / DECIMAL_FACTOR);
  const fraction = String(value % DECIMAL_FACTOR).padStart(MOVE_DECIMALS, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : String(whole);
}
