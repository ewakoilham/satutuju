/* Generates src/data/university-extra.json by joining the partner directory
 * (universities.json) to:
 *   - THE World University Rankings  (rank, intl-student %, student:staff)
 *   - Hipolabs university-domains-list (authoritative website backfill)
 *
 * Inputs (downloaded to /tmp): /tmp/qs.json (THE), /tmp/hipo.json (Hipolabs).
 * Run: node scripts/gen-university-extra.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = require(path.join(__dirname, "../src/data/universities.json"));
const THE = require("/tmp/qs.json");
const HIPO = require("/tmp/hipo.json");

function norm(name) {
  let s = String(name || "").toLowerCase();
  s = s.split(" - ")[0]; // drop "- AECC", "- INTO UK", "- Kaplan"
  s = s.replace(/\(.*?\)/g, " "); // drop "(USYD)", "(KAPLAN)"
  s = s.replace(
    /\b(into|kaplan|navitas|study group|oncampus|study centre|international pathway college|international college|international study centre|international|pathway|academy|global|foundation|online)\b/g,
    " ",
  );
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/^the\s+/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// A few hand aliases where THE's name differs from the directory's.
const ALIASES = {
  "university of new south wales": "unsw sydney",
  "unsw": "unsw sydney",
  "university of queensland": "university of queensland",
};

const theByKey = new Map();
for (const t of THE) {
  const k = norm(t.name);
  if (k && !theByKey.has(k)) theByKey.set(k, t);
}
const hipoByKey = new Map();
for (const h of HIPO) {
  const k = norm(h.name);
  if (k && !hipoByKey.has(k)) hipoByKey.set(k, h);
}

function lookupThe(key) {
  return theByKey.get(key) || theByKey.get(ALIASES[key] || "") || null;
}

const extra = {};
let theHits = 0, webHits = 0;
for (const u of DIR) {
  const key = norm(u.name);
  if (!key) continue;
  const rec = {};

  const t = lookupThe(key);
  if (t) {
    const rank = parseInt(String(t.rank).replace(/[^0-9]/g, ""), 10);
    if (rank) {
      rec.the = rank;
      const intl = parseInt(String(t.intl_students).replace(/[^0-9]/g, ""), 10);
      if (intl) rec.intlPct = intl;
      const ratio = parseFloat(String(t.student_staff_ratio));
      if (ratio) rec.studentStaff = ratio;
      theHits++;
    }
  }

  // Website backfill only when the directory row has none.
  if (!u.website || !u.website.trim()) {
    const h = hipoByKey.get(key);
    if (h && h.web_pages && h.web_pages[0]) {
      rec.website = h.web_pages[0].replace(/\/+$/, "");
      webHits++;
    }
  }

  if (Object.keys(rec).length) extra[u.id] = rec;
}

fs.writeFileSync(
  path.join(__dirname, "../src/data/university-extra.json"),
  JSON.stringify(extra, null, 0) + "\n",
);

console.log("directory rows:", DIR.length);
console.log("THE-rank matches:", theHits, "rows");
console.log("website backfills:", webHits, "rows");
console.log("total enriched rows:", Object.keys(extra).length);
console.log("\nspot-checks:");
for (const name of ["University of Melbourne", "Monash University", "University of New South Wales", "Australian National University", "University of Sydney", "University of Oxford", "University of Toronto", "Flinders University"]) {
  const u = DIR.find((x) => x.name === name) || DIR.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  console.log("  " + name + " ->", u ? JSON.stringify(extra[u.id] || "(no match)") : "(not in directory)");
}
