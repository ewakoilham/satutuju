/* Builds src/data/universities-canonical.json — a deduplicated, name-cleaned,
 * correct-website university list for the MENTOR/MENTEE Kampus view.
 *
 * The raw universities.json is an agency *commission* directory: the same
 * institution appears many times (once per agency/pathway provider), names
 * carry provider tags, and websites are frequently wrong/copy-pasted. Admin
 * keeps the raw data (needs commission per agency); everyone else gets this.
 *
 * Strategy per institution:
 *   - clean the name (strip provider tags),
 *   - dedupe by cleaned-name + country,
 *   - take the AUTHORITATIVE website + canonical name from Hipolabs
 *     (university-domains-list) when matched — never the raw directory URL,
 *   - attach the QS 2026 rank when matched.
 *
 * Inputs (downloaded to /tmp): /tmp/hipo.json, /tmp/qs2026.csv
 * Run: node scripts/gen-universities-canonical.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = require(path.join(__dirname, "../src/data/universities.json"));
const HIPO = require("/tmp/hipo.json");

/* ---- name cleaning (mirrors cleanUniName in university-enrichment.ts) ---- */
const PROVIDER = /\b(kaplan|kic|into|navitas|oieg|oxford international|shorelight|study group|oncampus|on campus|up education|education group|times education|global education|laurus education|adelaide education group|imperial education group)\b/i;
const NOTE = /\b(students?|only|direct entry|under qs|all campuses?)\b/i;
const NOISE = /\b(international pathway college|international study centre|pathway college)\b/gi;
// commission/agency notes baked into names — cut the name at the first trigger.
const NOTE_TRIGGER = /\b(commission|sub-?agents?|agent code|agent id|po number|cricos|supplier id|w\.?e\.?f|direct tie|tie ?up|no commission|deposit|formerly|previously known|previously called|in partnership with|applications?\s+(are|not|accepted|from|should|to)|students?\s+(from|who|except)|except\s+students|agreement will be signed|comprising of|following institutions|in the following|memorandum of)\b/i;
const NOTE_PAREN = /\b(formerly|previously known|previously called|po number|cricos|agent|through|w\.?e\.?f|commission|sub-?agent|except|intake|applications|supplier|deposit|tie ?up|agent code|under qs|all campuses?|only|students?|direct entry)\b/i;
const looksUniTop = (p) => /(universit|college|institute|institut|school|academy of|polytechnic|conservatory|conservatoire)/i.test(p);
function cleanUniName(raw) {
  let s = String(raw || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const orig = s;
  // 1) leading provider tag + note/provider parentheticals (before dash-splitting)
  s = s.replace(/^\([^)]*\)\s*/, (m) => (PROVIDER.test(m) ? "" : m));
  s = s.replace(/\([^)]*\)/g, (m) => (PROVIDER.test(m) || NOTE_PAREN.test(m) ? " " : m));
  // 2) cut a trailing commission/agency note (keep the real-name head)
  {
    const mt = s.match(NOTE_TRIGGER);
    if (mt && mt.index > 0) {
      const head = s.slice(0, mt.index).replace(/[\s,\-–—(]+$/, "").trim();
      if (looksUniTop(head)) s = head;
    }
  }
  // 3) provider prefix before a slash
  if (s.includes("/")) {
    const parts = s.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const left = parts.slice(0, -1).join(" ");
      if (PROVIDER.test(left) || /\bkic\b/i.test(left)) s = parts[parts.length - 1];
    }
  }
  // 4) dash split — drop only pure provider/agency/note segments (keep real-uni segments)
  if (/\s[-–—]\s/.test(s)) {
    const segs = s.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
    const drop = (p) => !looksUniTop(p) && (PROVIDER.test(p) || /\bacademy\b/i.test(p) || NOTE.test(p) || NOTE_TRIGGER.test(p));
    const kept = segs.filter((p) => !drop(p));
    s = kept.length ? kept.join(" - ") : segs[0];
  }
  s = s.replace(NOISE, "");
  s = s.replace(/[-–—]\s*(kaplan|kic|into|navitas|oieg|oxford international|shorelight|study group|up education|times education|global education|laurus education|adelaide education group|imperial education group)\b.*$/i, " ");
  // 5) trailing ", City, State/Country" location
  if ((s.match(/,/g) || []).length >= 2) {
    const head = s.slice(0, s.indexOf(","));
    if (/(universit|college|institute|school|polytechnic)/i.test(head)) s = head;
  }
  s = s.replace(/\s*\([A-Za-z]{2,6}\)\s*$/, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s/,–—()-]+|[\s/,–—()-]+$/g, "").trim();
  // safety net: never turn a real university into a non-university name
  if (looksUniTop(orig) && !looksUniTop(s)) return orig;
  return s.length < 3 ? orig : s;
}

/* ---- normalization for matching/grouping ---- */
function norm(name) {
  let s = String(name || "").toLowerCase();
  s = s.replace(/[^a-z0-9 ]+/g, " ").replace(/^the\s+/, "").replace(/\s+/g, " ").trim();
  return s;
}
const SMALL = new Set(["of", "the", "and", "for", "in", "at", "de", "di", "la", "le", "von", "van"]);
function titleCase(s) {
  return s.toLowerCase().split(" ").map((w, i) =>
    i > 0 && SMALL.has(w) ? w : (w ? w[0].toUpperCase() + w.slice(1) : w),
  ).join(" ");
}

const ALIASES = { "university of new south wales": "unsw sydney", unsw: "unsw sydney" };

/** Does a website's domain look like it belongs to this university name?
 *  Catches copy-paste errors (e.g. "Glasgow International College" → ichm.edu.au
 *  → false) while accepting correct ones (city.ac.uk for "City University"). */
function domainMatchesName(website, name) {
  if (!website) return false;
  const dom = String(website).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const root = dom.split(".")[0];
  if (root.length < 3) return false;
  // expand: unimelb→melb, uoregon→oregon (strip leading "university"/"uni"/"u")
  const roots = [...new Set([root, root.replace(/^university/, ""), root.replace(/^uni/, ""), root.replace(/^u/, "")])]
    .filter((r) => r.length >= 3);
  const words = norm(name).split(" ").filter((w) => w.length >= 4);
  // Strict: prefix/equality only — avoids "aut" matching inside "beauty".
  return words.some((w) =>
    roots.some((r) => w === r || w.startsWith(r) || r.startsWith(w) || (r.length >= 5 && w.includes(r))),
  );
}
const cleanSite = (s) => String(s).replace(/\s+/g, "").replace(/\/+$/, "");

/* ---- QS 2026 ---- */
function parseCSV(text) {
  const rows = []; let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const csv = parseCSV(fs.readFileSync("/tmp/qs2026.csv", "utf8").replace(/^﻿/, ""));
const qsByKey = new Map();
for (let r = 1; r < csv.length; r++) {
  const row = csv[r]; if (!row || row.length < 3) continue;
  const rank = String(row[0] || "").replace(/^=/, "").trim();
  const k = norm(cleanUniName(row[2] || ""));
  if (k && /^\d/.test(rank) && !qsByKey.has(k)) qsByKey.set(k, rank);
}

/* ---- Hipolabs (authoritative name + website) ---- */
const hipoByKey = new Map();
for (const h of HIPO) {
  const k = norm(h.name);
  if (k && !hipoByKey.has(k)) hipoByKey.set(k, h);
}
const lookupHipo = (k) => hipoByKey.get(k) || hipoByKey.get(ALIASES[k] || "") || null;
const lookupQs = (k) => qsByKey.get(k) || qsByKey.get(ALIASES[k] || "") || null;

/* ---- build canonical groups ---- */
const groups = new Map();
for (const u of DIR) {
  const cleaned = cleanUniName(u.name);
  const key = norm(cleaned);
  if (!key) continue;
  // Canonical name = cleaned directory name (title-cased if ALL-CAPS). We do
  // NOT rename to the Hipolabs name — ambiguous names (e.g. "City University")
  // would get mis-renamed. Hipolabs is used only as a website fallback.
  const canonName = /[a-z]/.test(cleaned) ? cleaned : titleCase(cleaned);
  const groupKey = norm(canonName) + "||" + String(u.country).toLowerCase();

  let g = groups.get(groupKey);
  if (!g) {
    g = { ids: [], name: canonName, country: u.country, levels: new Set(), programs: "", dirSite: "", hipoSite: "", qs: null };
    groups.set(groupKey, g);
  }
  g.ids.push(u.id);
  if (u.degreeLevel) g.levels.add(u.degreeLevel);
  if (!g.programs && u.programs) g.programs = u.programs;
  // Prefer a directory website whose domain matches the name (drops copy-paste errors).
  if (!g.dirSite && domainMatchesName(u.website, canonName)) g.dirSite = cleanSite(u.website);
  // Hipolabs authoritative site as fallback (only if it also looks consistent).
  const hipo = lookupHipo(key);
  if (!g.hipoSite && hipo && hipo.web_pages && hipo.web_pages[0] && domainMatchesName(hipo.web_pages[0], canonName)) {
    g.hipoSite = cleanSite(hipo.web_pages[0]);
  }
  const qs = lookupQs(key);
  if (qs && !g.qs) g.qs = qs;
}

const canonical = [];
for (const g of groups.values()) {
  // Drop agency meta-rows that aren't real institutions:
  //  - the OIEG group entity,
  //  - generic placeholders ("All campuses except Australia") with no uni word,
  //  - garbled rows listing many universities at once (3+ "university/college").
  const looksUni = (p) => /(universit|college|institute|institut|school|academy of|polytechnic|conservatory)/i.test(p);
  const uniTokens = (g.name.match(/\b(universit\w*|college)\b/gi) || []).length;
  const isJunk =
    /\boieg\b/i.test(g.name) ||
    (!looksUni(g.name) && /all campuses|following universities|^the following/i.test(g.name)) ||
    (!looksUni(g.name) && PROVIDER.test(g.name)) || // pure provider rows e.g. "Shorelight Education"
    (!looksUni(g.name) && /^(usa|uk|united states|united kingdom|singapore|malaysia|china|ireland|australia|canada|new zealand|nepal)$/i.test(g.name.trim())) || // bare-country residue ("USA")
    /applications must be submitted/i.test(g.name) || // application-note text
    uniTokens >= 3 ||
    g.name.length > 90;
  if (isJunk) continue;
  const levels = [...g.levels];
  const degreeLevel = levels.length === 1 ? levels[0] : "All";
  // representative id: prefer the smallest (stable); QS/site are already merged.
  const id = Math.min(...g.ids);
  const website = g.dirSite || g.hipoSite || "";
  const row = { id, name: g.name, country: g.country, degreeLevel, programs: g.programs || "", website };
  if (g.qs) row.qs = g.qs;
  canonical.push(row);
}
canonical.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(
  path.join(__dirname, "../src/data/universities-canonical.json"),
  JSON.stringify(canonical) + "\n",
);

const withSite = canonical.filter((u) => u.website).length;
const withQs = canonical.filter((u) => u.qs).length;
console.log("raw rows:", DIR.length, "→ canonical:", canonical.length, `(removed ${DIR.length - canonical.length} dup rows)`);
console.log("canonical with authoritative website:", withSite);
console.log("canonical with QS rank:", withQs);
console.log("\nspot-checks:");
for (const name of ["Flinders University", "University of Glasgow", "Glasgow International College", "Monash University", "University of Westminster", "City University", "Nottingham Trent"]) {
  const m = canonical.find((u) => u.name.toLowerCase() === name.toLowerCase()) || canonical.find((u) => u.name.toLowerCase().includes(name.toLowerCase()));
  console.log("  " + name + " ->", m ? JSON.stringify({ name: m.name, country: m.country, website: m.website, qs: m.qs }) : "(none)");
}
