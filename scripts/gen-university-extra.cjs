/* Generates src/data/university-extra.json by joining the partner directory
 * (universities.json) to:
 *   - QS World University Rankings 2026  (rank)
 *   - Hipolabs university-domains-list   (authoritative website backfill)
 *
 * Inputs (downloaded to /tmp):
 *   /tmp/qs2026.csv  — QS 2026 rankings CSV
 *   /tmp/hipo.json   — Hipolabs dataset
 * Run: node scripts/gen-university-extra.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = require(path.join(__dirname, "../src/data/universities.json"));
const HIPO = require("/tmp/hipo.json");

function parseCSV(text) {
  const rows = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function norm(name) {
  let s = String(name || "").toLowerCase();
  s = s.split(" - ")[0];
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(
    /\b(into|kaplan|navitas|study group|oncampus|study centre|international pathway college|international college|international study centre|international|pathway|academy|global|foundation|online)\b/g,
    " ",
  );
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/^the\s+/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// QS names that differ from how the directory spells them.
const ALIASES = {
  "university of new south wales": "unsw sydney",
  "unsw": "unsw sydney",
};

const csv = parseCSV(fs.readFileSync("/tmp/qs2026.csv", "utf8").replace(/^﻿/, ""));
// header: [0]=2026 Rank, [2]=Institution Name, [3]=Country
const qsByKey = new Map();
for (let r = 1; r < csv.length; r++) {
  const row = csv[r];
  if (!row || row.length < 3) continue;
  const rankRaw = String(row[0] || "").replace(/^=/, "").trim();
  const name = String(row[2] || "").trim();
  if (!name || !/^\d/.test(rankRaw)) continue;
  const k = norm(name);
  if (k && !qsByKey.has(k)) qsByKey.set(k, rankRaw);
}

const hipoByKey = new Map();
for (const h of HIPO) {
  const k = norm(h.name);
  if (k && !hipoByKey.has(k)) hipoByKey.set(k, h);
}

function lookupQs(key) {
  return qsByKey.get(key) || qsByKey.get(ALIASES[key] || "") || null;
}

const extra = {};
let qsHits = 0, webHits = 0;
for (const u of DIR) {
  const key = norm(u.name);
  if (!key) continue;
  const rec = {};

  const qs = lookupQs(key);
  if (qs) { rec.qs = qs; qsHits++; }

  if (!u.website || !u.website.trim()) {
    const h = hipoByKey.get(key);
    if (h && h.web_pages && h.web_pages[0]) { rec.website = h.web_pages[0].replace(/\/+$/, ""); webHits++; }
  }

  if (Object.keys(rec).length) extra[u.id] = rec;
}

fs.writeFileSync(
  path.join(__dirname, "../src/data/university-extra.json"),
  JSON.stringify(extra, null, 0) + "\n",
);

console.log("directory rows:", DIR.length);
console.log("QS-rank matches:", qsHits, "rows");
console.log("website backfills:", webHits, "rows");
console.log("total enriched rows:", Object.keys(extra).length);
console.log("\nspot-checks:");
for (const name of ["University of Melbourne", "Monash University", "University of New South Wales", "Australian National University", "University of Sydney", "University of Auckland", "Flinders University"]) {
  const u = DIR.find((x) => x.name === name) || DIR.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  console.log("  " + name + " ->", u ? JSON.stringify(extra[u.id] || "(no match)") : "(not in directory)");
}
