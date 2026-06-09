/**
 * Phase 18 — server-only side of the mentee contract template module.
 * Reads the markdown source from disk. Mirror of
 * `contract-template-server.ts` for the mentor side.
 *
 * No `import "server-only"` directive: importable from one-off node
 * scripts under `prisma/scripts/`. The `fs` import below naturally
 * fails any browser bundler.
 */

import { promises as fs } from "fs";
import path from "path";

const TEMPLATE_FILE = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-templates",
  "perjanjian-mentee-2026-05.md",
);

let cachedBody: string | null = null;

export async function getMenteeContractBody(): Promise<string> {
  // Cache only in production — in dev we want template edits to show
  // up on the next request without a server restart.
  if (cachedBody && process.env.NODE_ENV === "production") return cachedBody;
  cachedBody = await fs.readFile(TEMPLATE_FILE, "utf8");
  return cachedBody;
}
