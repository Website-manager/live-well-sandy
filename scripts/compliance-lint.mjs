#!/usr/bin/env node
/**
 * scripts/compliance-lint.mjs — the `compliance-lint` gate for the
 * "Live Well with Sandy" site (an independent doTERRA Wellness Advocate site).
 *
 * WHY THIS EXISTS
 * ---------------
 * Sandy edits this site's words from a friendly CMS panel, and (Phase B) an
 * assistant can open edit PRs on her behalf. Essential-oil / MLM advocate sites
 * carry hard legal limits. This check is the safety net that runs on every pull
 * request AND inside the deploy job, and blocks the two highest-risk classes of
 * wording before they can reach the live site:
 *
 *   1. DISEASE / MEDICAL ("drug") CLAIMS — FDA. Describing an oil as something that
 *      treats / heals / cures / relieves / gets rid of a disease or symptom, or
 *      naming a disease, turns it into an unapproved drug. BLOCKS the build.
 *   2. INCOME / EARNINGS GUARANTEES — FTC. Promising income, "financial freedom",
 *      "be your own boss", specific earnings, etc. BLOCKS the build.
 *
 * It also GUARDS the FDA disclaimer (must remain on every rendered page) and WARNS
 * on context-dependent words for a human to glance at.
 *
 * THIS IS A HIGH-PRECISION DENYLIST, NOT AN EXHAUSTIVE CLAIM DETECTOR. It catches the
 * common, clear violations with near-zero false-positives on honest wellness copy —
 * it is NOT a substitute for human review. See COMPLIANCE.md.
 *
 * WHAT IT SCANS
 * ------------
 *   - src/content  (the .md files Sandy edits via the CMS) — raw, line-numbered.
 *   - dist         (the rendered .html after `astro build`) — including the text
 *                  inside meta/og/twitter descriptions, alt / title / aria-label
 *                  attributes, and JSON-LD, which a naive tag-strip would miss.
 *
 * Pure Node, zero dependencies. Exports its scan functions so the regression suite
 * (scripts/compliance-lint.test.mjs) can exercise the rules directly.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

// ── Disclaimer — TOLERANT regex on the load-bearing tokens (optional Oxford comma,
// is/are, flexible whitespace). Used for BOTH the presence guard and the mask, so a
// benign reword can't (a) fail the guard or (b) self-flag its own treat/cure words. ──
export const DISCLAIMER_RE =
  /\b(?:is|are)\s+not\s+intended\s+to\s+diagnose,?\s*treat,?\s*cure,?\s*(?:or\s+)?prevent\s+any\s+disease\b/i;
export const ADVOCATE_RE = /\bindependent\s+wellness\s+advocate\b/i;

// Condition / symptom / biomarker objects that turn a soft verb into a drug claim.
// NB: "stress" and "cold" are deliberately EXCLUDED — both are common, benign wellness
// words ("a stressful day", "cold-weather routine", "cold brew") that would over-block.
// Genuine claims about colds are still caught by the kill/stops/prevents-virus rules.
const COND =
  "(?:disease|illness|infection|virus|viral|bacteria|cancer|tumou?rs?|covid|coronavirus|flu|influenza|headaches?|migraines?|nausea|fevers?|coughs?|bronchitis|asthma|eczema|psoriasis|arthritis|herpes|diabetes|insomnia|anxiety|depression|pains?|aches?|inflammation|reflux|acne|allerg(?:y|ies|ic)|adhd|autism|hypertension|blood\\s+pressure|blood\\s+sugar|cholesterol|hormones?|symptoms?)";

// BLOCK window: verb adjacent to a condition with NO clause/sentence separator between
// them (high precision — "treats your headaches" blocks; "I help families, during cold
// season" does not). The separator class stops the match at . , ; : ! ? and en/em dash.
const SEP = "[^.,;:!?\\u2013\\u2014]";
function ctx(verbAlt, why) {
  return [
    { re: new RegExp(`\\b(?:${verbAlt})\\b${SEP}{0,60}\\b${COND}\\b`, "i"), why },
    { re: new RegExp(`\\b${COND}\\b${SEP}{0,60}\\b(?:${verbAlt})\\b`, "i"), why },
  ];
}

// ── BLOCK — drug / disease ("medical") claims (FDA). Verb groups carry the FULL
// conjugation set incl. PAST TENSE (testimonials are usually past tense — "it relieved
// my pain"). Keep these in lockstep with the regression suite's past-tense cases. ──
export const BLOCK_MEDICAL = [
  { re: /\bcure[sd]?\b/i, why: 'drug claim: "cure"' },
  { re: /\bdiagnos(?:e|es|ed|ing|is)\b/i, why: 'drug claim: "diagnose"' },
  { re: /\bfda[-\s]?approved\b/i, why: 'forbidden claim: "FDA approved"' },
  { re: /\bclinically proven\b/i, why: 'unsubstantiated claim: "clinically proven"' },
  { re: /\banti[-\s]?(?:viral|bacterial|biotic|fungal|inflammator)\w*\b/i, why: 'drug claim: "anti-viral / antibacterial / …"' },
  ...ctx("treat|treats|treated|treating|treatment|treatments", 'drug claim: "treat <condition>"'),
  ...ctx("heal|heals|healed|healing", 'drug claim: "heal <condition>"'),
  ...ctx("relieve|relieves|relieved|relieving|soothe|soothes|soothed|soothing|ease|eases|eased|easing", 'drug claim: "relieve / soothe <condition>"'),
  ...ctx("help|helps|helped|helping|aid|aids|aided|aiding|fix|fixes|fixed|fixing", 'drug claim: "helps with <condition>"'),
  ...ctx("stop|stops|stopped|stopping|eliminate|eliminates|eliminated|eliminating|kill|kills|killed|killing|knocks?\\s+out|knocked\\s+out|gets?\\s+rid\\s+of|got\\s+rid\\s+of|banish|banishes|banished|fights?\\s+off|fought\\s+off", 'drug claim: "stops / kills / gets rid of <condition>"'),
  ...ctx("lower|lowers|lowered|lowering|raise|raises|raised|raising|reduce|reduces|reduced|reducing|boost|boosts|boosted|boosting|balance|balances|balanced|balancing", 'physiological claim: "lowers / boosts <biomarker>"'),
  { re: /\bprevent(?:s|ed|ing|ion)?\b[^.]{0,40}\b(?:disease|illness|infection|virus|cancer|flu|colds?)\b/i, why: 'drug claim: "prevent <disease>"' },
  { re: /\binstead of (?:your |my )?(?:medication|medicine|inhaler|antibiotics?|prescription|doctor|medical care)\b/i, why: 'drug claim: "instead of your medication"' },
  { re: /\b(?:cancer|tumou?rs?|covid|coronavirus|influenza|diabetes|asthma|eczema|psoriasis|arthritis|herpes|adhd|autism|alzheimer'?s?|hypertension)\b/i, why: "names a disease / medical condition" },
];

// ── BLOCK — income / earnings guarantees (FTC). ──
export const BLOCK_INCOME = [
  { re: /\breplace (?:your |my )?income\b/i, why: 'income claim: "replace your income"' },
  { re: /\bfinancial freedom\b/i, why: 'income claim: "financial freedom"' },
  { re: /\b(?:passive|residual|guaranteed|unlimited|life[-\s]?changing|full[-\s]?time) income\b/i, why: "income claim: guaranteed / passive income" },
  { re: /\bget rich\b/i, why: 'income claim: "get rich"' },
  { re: /\bsix[-\s]?figures?\b/i, why: 'income claim: "six figures"' },
  { re: /\b(?:be your own|fire your|quit your|ditch your) (?:boss|job|9[-\s]?to[-\s]?5)\b/i, why: 'income claim: "be your own boss / quit your job"' },
  { re: /\bground[-\s]?floor (?:opportunity|business)\b/i, why: 'income claim: "ground-floor opportunity"' },
  { re: /\b(?:earn|make|income of|profit of|paid|paycheck|salary|commission)\b(?![^.]{0,24}\b(?:off|discount|save|saving|sale|coupon|deal|percent)\b)[^.]{0,24}\$\s?\d/i, why: "income claim: specific earnings ($)" },
  { re: /\$\s?\d[\d,]*\s?(?:\/|per |a |an )?(?:month|week|day|year|hour|mo\b)[^.]{0,24}\b(?:earn|earning|income|profit|paid|paycheck|salary|commission)\b/i, why: "income claim: earnings per period" },
  { re: /\b(?:earn|make|earning|income of|profit of)\b[^.]{0,24}\b(?:hundreds|thousands)\b[^.]{0,12}\b(?:a|per|each)\s+(?:month|week|day|year|hour)\b/i, why: "income claim: hundreds/thousands per period" },
];

// ── WARN — context-dependent words (reported, never blocks). ──
export const WARN_TERMS = [
  { re: /\b(?:anxiety|depression|insomnia)\b/i, why: "condition word — phrase as a feeling/support, not the disorder" },
  { re: /\b(?:immune|immunity)\b/i, why: 'immune claim — avoid "boosts immunity"' },
  { re: /\b(?:inflammation|inflammatory)\b/i, why: "inflammation claim — avoid" },
  { re: /\b(?:detox|detoxif\w+)\b/i, why: "detox claim — avoid" },
  { re: /\b(?:hormonal|blood pressure|cholesterol)\b/i, why: "physiological claim — review" },
];

const BLOCK = [...BLOCK_MEDICAL, ...BLOCK_INCOME];

// Looser co-occurrence: a soft claim-verb within ~120 chars of a condition (any
// punctuation, both orders) — only WARNS. Catches padded / two-sentence claims the
// tight BLOCK window deliberately skips, surfacing them for a human without blocking.
const SOFTV =
  "(?:treats?|treated|treating|treatments?|heals?|healed|healing|relieves?|relieved|relieving|soothes?|soothed|soothing|eases?|eased|easing|helps?|helped|helping|aids?|aided|aiding|fix(?:es|ed|ing)?|stops?|stopped|stopping|eliminat\\w+|kills?|killed|killing|reduces?|reduced|reducing|lowers?|lowered|lowering|boosts?|boosted|boosting|prevents?|prevented|preventing|cure[sd]?)";
const COOCCUR = [
  new RegExp(`\\b${SOFTV}\\b[\\s\\S]{0,160}\\b${COND}\\b`, "i"),
  new RegExp(`\\b${COND}\\b[\\s\\S]{0,160}\\b${SOFTV}\\b`, "i"),
];
const NON_LATIN = /[Ͱ-ϿЀ-ӿ԰-֏]/; // residual Greek/Cyrillic/Armenian letters

// ── Normalization — decode entities (named + numeric/hex), NFKC, fold homoglyphs,
// strip zero-width, collapse whitespace. Makes "c&#117;re" / fullwidth / common
// Greek-Cyrillic look-alikes scan as plain ASCII. The folding map covers the Greek &
// Cyrillic lowercase look-alikes; anything it MISSES still trips the NON_LATIN warn. ──
const HOMOGLYPH = {
  // Greek lowercase
  "α":"a","β":"b","γ":"y","δ":"d","ε":"e","ζ":"z","η":"n","θ":"o","ι":"i","κ":"k","λ":"l","μ":"u","ν":"v","ξ":"e","ο":"o","π":"n","ρ":"p","σ":"o","ς":"s","τ":"t","υ":"u","φ":"o","χ":"x","ψ":"w","ω":"w",
  // Cyrillic lowercase
  "а":"a","б":"b","в":"b","г":"r","д":"d","е":"e","ж":"x","з":"3","и":"u","й":"u","к":"k","л":"n","м":"m","н":"h","о":"o","п":"n","р":"p","с":"c","т":"t","у":"y","ф":"o","х":"x","ц":"u","ч":"4","ш":"w","щ":"w","ъ":"b","ы":"b","ь":"b","э":"e","ю":"o","я":"r","і":"i","ј":"j","ѕ":"s","ԁ":"d","ո":"n",
};
function safeCp(cp) { try { return String.fromCodePoint(cp); } catch { return " "; } }
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&(?:#39|apos|rsquo|lsquo);/gi, "'")
    .replace(/&(?:quot|ldquo|rdquo);/gi, '"');
}
export function normalize(s) {
  let t = decodeEntities(String(s));
  try { t = t.normalize("NFKC"); } catch {}
  t = t.replace(/[​-‍﻿­]/g, "");
  t = t.replace(/[Ͱ-ϿЀ-ӿ԰-֏]/g, (c) => HOMOGLYPH[c] ?? c);
  return t.replace(/\s+/g, " ").trim();
}

function maskDisclaimer(text) {
  return text.replace(DISCLAIMER_RE, " ___disclaimer___ ").replace(ADVOCATE_RE, " ___advocate___ ");
}

/** Run BLOCK + WARN rules over already-normalized, lowercased text. */
export function scanText(text) {
  const masked = maskDisclaimer(text);
  const hits = { errors: [], warnings: [] };
  for (const rule of BLOCK) if (rule.re.test(masked)) hits.errors.push(rule.why);
  for (const rule of WARN_TERMS) if (rule.re.test(masked)) hits.warnings.push(rule.why);
  if (!hits.errors.length && COOCCUR.some((re) => re.test(masked)))
    hits.warnings.push("a claim verb appears near a condition — review for a possible drug claim");
  if (NON_LATIN.test(masked))
    hits.warnings.push("non-Latin look-alike characters detected — review for disguised words");
  return hits;
}

/** Extract ALL scannable text from rendered HTML: visible body + the text inside
 *  meta/og/twitter/itemprop descriptions, alt/title/aria-label (quoted, unquoted, or
 *  backtick), and JSON-LD keys + string values. */
export function htmlToScanText(html) {
  const parts = [];
  for (const m of html.matchAll(/<script[^>]*type=["'`]?application\/ld\+json["'`]?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectStrings(JSON.parse(m[1].trim()), parts); }
    catch { parts.push(m[1]); }
  }
  const attrVal = (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
  for (const m of html.matchAll(/\b(?:alt|title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s">]+))/gi)) {
    parts.push(attrVal(m));
  }
  for (const m of html.matchAll(/<meta\b[^>]*\b(?:name|property|itemprop)\s*=\s*["'`]?(?:description|og:[\w:]+|twitter:[\w:]+)["'`]?[^>]*>/gi)) {
    const cm = m[0].match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s">]+))/i);
    if (cm) parts.push(attrVal(cm));
  }
  parts.push(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
  return normalize(parts.join("  \n  ")).toLowerCase();
}
function collectStrings(node, out) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { out.push(k); collectStrings(v, out); }
}

export function hasDisclaimer(normLowerText) {
  return DISCLAIMER_RE.test(normLowerText);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — scan the repo. Only runs when invoked directly (not when imported by tests).
// ─────────────────────────────────────────────────────────────────────────────
function collect(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}
function annotate(level, file, line, message) {
  process.stdout.write(`::${level} ${line ? `file=${file},line=${line}` : `file=${file}`}::${message}\n`);
}

function runCli() {
  const ROOT = process.cwd();
  const errors = [];
  const warnings = [];

  const mdFiles = collect(join(ROOT, "src", "content"), ".md");
  for (const file of mdFiles) {
    const rel = relative(ROOT, file);
    readFileSync(file, "utf8").split("\n").forEach((raw, i) => {
      const { errors: e, warnings: w } = scanText(normalize(raw).toLowerCase());
      for (const why of e) { errors.push({ file: rel, line: i + 1, why }); annotate("error", rel, i + 1, `compliance: ${why}`); }
      for (const why of w) { warnings.push({ file: rel, line: i + 1, why }); annotate("warning", rel, i + 1, `compliance (review): ${why}`); }
    });
  }

  const htmlFiles = collect(join(ROOT, "dist"), ".html");
  const seen = new Set();
  for (const file of htmlFiles) {
    const rel = relative(ROOT, file);
    const text = htmlToScanText(readFileSync(file, "utf8"));
    if (!hasDisclaimer(text)) {
      errors.push({ file: rel, line: 0, why: "FDA disclaimer missing" });
      annotate("error", rel, 0, "compliance: required FDA disclaimer missing from this page's footer");
    }
    const { errors: e, warnings: w } = scanText(text);
    for (const why of e) {
      const k = rel + "|" + why; if (seen.has(k)) continue; seen.add(k);
      errors.push({ file: rel, line: 0, why }); annotate("error", rel, 0, `compliance (rendered): ${why}`);
    }
    for (const why of w) {
      const k = rel + "|w|" + why; if (seen.has(k)) continue; seen.add(k);
      warnings.push({ file: rel, line: 0, why }); annotate("warning", rel, 0, `compliance (rendered, review): ${why}`);
    }
  }

  console.log("\n" + "─".repeat(64));
  console.log(`compliance-lint — scanned ${mdFiles.length} content file(s) + ${htmlFiles.length} rendered page(s)`);
  if (htmlFiles.length === 0) {
    console.error("BLOCK: dist/ has no rendered HTML — run `npm run build` before the scan.");
    process.exit(1);
  }
  console.log(`  blocking issues: ${errors.length}\n  warnings (review): ${warnings.length}`);
  console.log("─".repeat(64));
  if (warnings.length) {
    console.log("\nWARNINGS (do not block — a human should glance at these):");
    for (const w of warnings) console.log(`  • ${w.file}${w.line ? ":" + w.line : ""} — ${w.why}`);
  }
  if (errors.length) {
    console.log("\nBLOCKING (this PR cannot merge / deploy until these are removed):");
    for (const e of errors) console.log(`  ✗ ${e.file}${e.line ? ":" + e.line : ""} — ${e.why}`);
    console.log("\nSee COMPLIANCE.md for what's allowed and how to rephrase.");
    process.exit(1);
  }
  console.log("\n✓ compliance-lint passed — no disease, drug, or income claims; disclaimer intact.");
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
