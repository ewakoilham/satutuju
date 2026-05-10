/**
 * Server-only side of the contract template module — anything that
 * needs Node's `fs` to read the markdown source from disk.
 *
 * Kept in a sibling file so `contract-template.ts` (types, helpers,
 * changelog) can be imported by client components without dragging
 * `fs`/`path` into the browser bundle.
 *
 * No `import "server-only"` directive: this file is intentionally
 * importable from one-off node scripts under `prisma/scripts/`. Real
 * server-only enforcement comes from the `fs` import below — it
 * naturally fails any browser bundler before reaching this code.
 */

import { promises as fs } from "fs";
import path from "path";

const TEMPLATE_FILE = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-templates",
  "perjanjian-mentor-2026-05.md",
);

let cachedBody: string | null = null;

export async function getContractBody(): Promise<string> {
  // Cache only in production — in dev we want template edits to show
  // up on the next request without a server restart.
  if (cachedBody && process.env.NODE_ENV === "production") return cachedBody;
  cachedBody = await fs.readFile(TEMPLATE_FILE, "utf8");
  return cachedBody;
}
