/**
 * Background-removal helper for hand-drawn signatures.
 *
 * Reads `public/signatures/razak-original.png` (or any input passed via
 * --in), maps each pixel's luminance to alpha so the white paper turns
 * transparent and the ink stays opaque, then writes the result to
 * `public/signatures/razak.png` (or --out).
 *
 * Run:
 *   npx tsx prisma/scripts/remove-signature-bg.ts
 *   npx tsx prisma/scripts/remove-signature-bg.ts --in foo.png --out bar.png
 */

import path from "path";
import sharp from "sharp";

const args = process.argv.slice(2);
function arg(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const root = process.cwd();
const inputPath = path.resolve(
  root,
  arg("in", "public/signatures/razak-original.png"),
);
const outputPath = path.resolve(
  root,
  arg("out", "public/signatures/razak.png"),
);

// Pixels brighter than this stay fully transparent. Pixels darker than
// `inkCutoff` stay fully opaque. Between the two we ramp linearly so
// edges feather smoothly instead of jagged.
const bgCutoff = 235; // 0–255: anything ≥ this is treated as background
const inkCutoff = 90; // 0–255: anything ≤ this is treated as ink

async function main() {
  console.log(`Reading: ${inputPath}`);
  const src = sharp(inputPath).ensureAlpha();
  const { data, info } = await src
    .raw()
    .toBuffer({ resolveWithObject: true });
  console.log(`  ${info.width}×${info.height}, ${info.channels} channels`);

  const out = Buffer.from(data); // copy
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    // Perceptual luminance (Rec. 709). Pure white ≈ 255, ink ≈ low.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let alpha: number;
    if (lum >= bgCutoff) {
      alpha = 0;
    } else if (lum <= inkCutoff) {
      alpha = 255;
    } else {
      // Linear ramp from inkCutoff (opaque) to bgCutoff (transparent).
      alpha = Math.round(((bgCutoff - lum) / (bgCutoff - inkCutoff)) * 255);
    }
    out[i] = 0; // force ink colour to pure black for crisp on white paper
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = alpha;
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log(`✓ Wrote: ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
