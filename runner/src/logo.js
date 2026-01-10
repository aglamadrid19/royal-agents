import crypto from "crypto";

function toHex(value) {
  return value.toString(16).padStart(2, "0");
}

function hashBytes(seed) {
  return crypto.createHash("sha256").update(seed, "utf8").digest();
}

function colorFromSeed(seed, offset) {
  const bytes = hashBytes(seed);
  const r = bytes[offset % bytes.length];
  const g = bytes[(offset + 1) % bytes.length];
  const b = bytes[(offset + 2) % bytes.length];
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function escapeXml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function deriveName(prompt) {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "Logo";
  }
  return cleaned.slice(0, 24);
}

function deriveMonogram(name) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function generateLogoSvg({ prompt, systemPrompt }) {
  const name = deriveName(prompt);
  const monogram = deriveMonogram(name);
  const seed = `${prompt}::${systemPrompt ?? ""}`;
  const primary = colorFromSeed(seed, 0);
  const accent = colorFromSeed(seed, 4);
  const glow = colorFromSeed(seed, 8);
  const safeName = escapeXml(name);
  const safeMonogram = escapeXml(monogram || "RA");

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n` +
    "  <defs>\n" +
    `    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n` +
    `      <stop offset="0%" stop-color="#0b1222"/>\n` +
    `      <stop offset="100%" stop-color="#0f1b2d"/>\n` +
    "    </linearGradient>\n" +
    `    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.7">\n` +
    `      <stop offset="0%" stop-color="${glow}" stop-opacity="0.65"/>\n` +
    `      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>\n` +
    "    </radialGradient>\n" +
    "  </defs>\n" +
    `  <rect width="512" height="512" rx="48" fill="url(#bg)"/>\n` +
    `  <rect width="512" height="512" rx="48" fill="url(#glow)"/>\n` +
    `  <circle cx="140" cy="160" r="78" fill="${accent}" opacity="0.9"/>\n` +
    `  <path d="M310 96 L416 208 L340 316 L236 204 Z" fill="${primary}" opacity="0.9"/>\n` +
    `  <circle cx="352" cy="352" r="90" fill="${accent}" opacity="0.2"/>\n` +
    `  <text x="256" y="268" text-anchor="middle" font-family="'Space Grotesk', 'Helvetica Neue', Arial, sans-serif" font-size="96" font-weight="700" fill="#f8fafc">${safeMonogram}</text>\n` +
    `  <text x="256" y="408" text-anchor="middle" font-family="'Space Grotesk', 'Helvetica Neue', Arial, sans-serif" font-size="24" letter-spacing="2" fill="#e2e8f0">${safeName.toUpperCase()}</text>\n` +
    "</svg>\n";
}
