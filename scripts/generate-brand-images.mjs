// Renders the BuybackAI brand assets (profile pic + Twitter banner) to PNG.
// Run with: node scripts/generate-brand-images.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "brand");
await mkdir(outDir, { recursive: true });

// ─── Profile picture: 800×800, dark bg, big green dot, "B" wordmark ───────
// 800px so Twitter has room to downscale without blur. Square; crops to circle.
const profileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d4ff3a" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#d4ff3a" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#d4ff3a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="#08090b"/>
  <circle cx="400" cy="400" r="380" fill="url(#halo)"/>
  <circle cx="400" cy="400" r="120" fill="#d4ff3a"/>
  <text x="400" y="700"
    text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, 'Geist', Inter, sans-serif"
    font-size="68"
    font-weight="500"
    letter-spacing="-1.5"
    fill="#f7f8f8">BuybackAI</text>
</svg>
`;

await sharp(Buffer.from(profileSvg))
  .png()
  .toFile(join(outDir, "profile.png"));
console.log("✓ profile.png (800×800)");

// ─── Twitter banner: 1500×500, headline + URL, restrained ─────────────────
// Twitter crops the bottom-left for the avatar overlay (~210×210 reserved).
// Mobile clients also crop side margins, so we keep all text well inside
// the safe zone (roughly center 1300×400). Headline is left-aligned at
// horizontal center with breathing room.
const bannerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <defs>
    <radialGradient id="centerGlow" cx="50%" cy="60%" r="55%">
      <stop offset="0%" stop-color="#d4ff3a" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#d4ff3a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.045)"/>
    </pattern>
  </defs>
  <rect width="1500" height="500" fill="#08090b"/>
  <rect width="1500" height="500" fill="url(#grid)"/>
  <rect width="1500" height="500" fill="url(#centerGlow)"/>

  <!-- Top-right wordmark (away from avatar overlay area) -->
  <g transform="translate(1335, 60)">
    <circle cx="-14" cy="-6" r="8" fill="#d4ff3a"/>
    <text x="0" y="0"
      font-family="ui-sans-serif, system-ui, -apple-system, sans-serif"
      font-size="22" font-weight="500" fill="#f7f8f8" letter-spacing="-0.4"
      text-anchor="end" transform="translate(140 0)">BuybackAI</text>
  </g>

  <!-- Centered headline (two lines, well inside safe zone) -->
  <text x="750" y="225"
    text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, sans-serif"
    font-size="76" font-weight="500" letter-spacing="-2"
    fill="#f7f8f8">Hire an AI agent.</text>
  <text x="750" y="310"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic"
    font-size="76" font-weight="400" letter-spacing="-1.5"
    fill="#d4ff3a">Fire it any time.</text>

  <!-- URL beneath, monospace eyebrow -->
  <text x="750" y="395"
    text-anchor="middle"
    font-family="ui-monospace, 'Geist Mono', SFMono-Regular, Consolas, monospace"
    font-size="18" letter-spacing="3" fill="#8a8f98">BUYBACKAI.VERCEL.APP</text>
</svg>
`;

await sharp(Buffer.from(bannerSvg))
  .png()
  .toFile(join(outDir, "banner.png"));
console.log("✓ banner.png (1500×500)");

console.log("\nWritten to: " + outDir);
