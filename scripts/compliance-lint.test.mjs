#!/usr/bin/env node
/**
 * scripts/compliance-lint.test.mjs — regression suite for the compliance gate.
 *
 * Every case below came from an adversarial review of the gate: the BYPASS cases are
 * claims that an earlier version let through; the CLEAN cases are honest wellness /
 * retail copy an earlier version wrongly blocked. Run with: `node scripts/compliance-lint.test.mjs`.
 * Exits 1 on any mismatch. Keep these green — they are why the gate is trustworthy.
 */

import { scanText, htmlToScanText, hasDisclaimer, normalize } from "./compliance-lint.mjs";

const DISC = "Wellness content is for educational purposes and is not intended to diagnose, treat, cure, or prevent any disease. Independent Wellness Advocate.";
const DISC_NO_OXFORD = "These statements are not intended to diagnose, treat, cure or prevent any disease.";

// scanText helper (mirror the CLI: normalize + lowercase first).
const scan = (s) => scanText(normalize(s).toLowerCase());
const blocks = (s) => scan(s).errors.length > 0;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ FAIL: ${name}`); } };

// ── MUST BLOCK — disease / drug claims (incl. the bypasses the review found) ──
const MUST_BLOCK = [
  "This will cure you.",
  "It heals your eczema.",
  "This treats your headaches naturally.",
  "Gets rid of your migraines.",
  "Stops a headache in minutes.",
  "Kills the virus that causes colds.",
  "Lowers your blood sugar.",
  "Use this instead of your inhaler.",
  "It is FDA approved.",
  "Clinically proven to work.",
  "A powerful antiviral blend.",
  "Helps with cancer.",
  "The calm set helps your anxiety.",
  "Relieves your arthritis pain.",
  "It will prevent disease.",
  // PAST TENSE — the natural testimonial form (the v2.0 gap the re-review caught).
  "Frankincense relieved my chronic back pain.",
  "It eased my migraines completely.",
  "Lavender treated my insomnia.",
  "Peppermint soothed my nausea.",
  "This lowered my blood pressure.",
  "It reduced my inflammation.",
  "It healed my eczema.",
  // PADDED claim — adjectives between verb and condition (still within a clause).
  "This treats your stubborn daily recurring annoying headaches.",
];
// ── MUST BLOCK — income / earnings (FTC) ──
const MUST_BLOCK_INCOME = [
  "Replace your income from home.",
  "Achieve financial freedom.",
  "Build passive income.",
  "You will get rich.",
  "Make six figures.",
  "Be your own boss.",
  "Fire your boss and work from home.",
  "Earn $5,000 a month.",
  "You can make $500/week from your phone.",
  "A ground-floor opportunity.",
];
// ── MUST PASS — honest wellness + retail copy the gate must NOT block ──
const MUST_PASS = [
  "Natural wellness, shared simply.",
  "I help everyday people bring a little more calm and care into their routines.",
  "I treasured the plants around them.",
  "An uplifting blend that takes me to my favorite outdoor places.",
  "Treat yourself to a relaxing evening.",
  "A little treat for your senses.",
  "Our spa treatment menu.",
  "The AromaTouch treatment technique.",
  "A healing retreat in the mountains.",
  "Healing has been a journey for me.",
  "Save $50 a month on your wellness routine.",
  "Make $20 off your first order.",
  "$50 a month off your wellness box.",
  "Shop with me.",
  "Curious before you try something? Reach out anytime.",
  // "cold" is benign English — these must NOT block (the re-review false-positives).
  "Treat yourself to a relaxing cold-weather evening.",
  "Treat yourself after a cold day.",
  "Help yourself to a cold drink.",
  "I help families — even during cold season.",
  "A cozy treat for cold winter days.",
  // broadened soft-verb set must not block honest copy with no condition nearby.
  "Helps you feel your best.",
  "Soothing lavender for a calm evening.",
  "Aids relaxation and a sense of ease.",
  "Find balance in everyday life.",
  "Boost your mood naturally.",
  "Ease into your morning slowly.",
];

// ── MUST WARN (not block) — looser claims surface for human review, never hard-block ──
const MUST_WARN = [
  "This product heals. Your headaches fade away today.",      // two-sentence (period splits the BLOCK)
  "Lavender soothes me to sleep. My insomnia is finally gone.",
];

const warnsOnly = (s) => { const r = scan(s); return r.errors.length === 0 && r.warnings.length > 0; };

console.log("source-text cases:");
for (const s of MUST_BLOCK) ok(`BLOCK: ${s}`, blocks(s));
for (const s of MUST_BLOCK_INCOME) ok(`BLOCK income: ${s}`, blocks(s));
for (const s of MUST_PASS) ok(`PASS: ${s}`, !blocks(s));
for (const s of MUST_WARN) ok(`WARN-not-block: ${s}`, warnsOnly(s));

// ── RENDERED-HTML bypasses the review confirmed reach live ──
console.log("rendered-html bypass cases:");
const page = (inner) => `<html><head>${inner}</head><body><footer><p>${DISC}</p></footer></body></html>`;

ok("meta description claim blocks",
  scan(htmlToScanText(page(`<meta name="description" content="These oils cure anxiety and treat the flu.">`))).errors.length > 0);
ok("og:title income claim blocks",
  scan(htmlToScanText(page(`<meta property="og:title" content="Replace your income with oils">`))).errors.length > 0);
ok("img alt disease claim blocks",
  scan(htmlToScanText(`<body><img alt="this oil cures the flu"><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("aria-label claim blocks",
  scan(htmlToScanText(`<body><button aria-label="cures cancer">x</button><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("JSON-LD claim blocks",
  scan(htmlToScanText(`<body><script type="application/ld+json">{"description":"cures covid"}</script><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("numeric-entity c&#117;re blocks",
  scan(htmlToScanText(`<body><p>this will c&#117;re you</p><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("Greek-upsilon homoglyph cυre blocks",
  scan(htmlToScanText(`<body><p>our oils cυre you</p><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("unquoted attribute claim blocks",
  scan(htmlToScanText(`<body><meta name=description content=cures-cancer><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("itemprop meta claim blocks",
  scan(htmlToScanText(`<body><meta itemprop="description" content="treats your eczema"><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("backtick-quoted alt claim blocks",
  scan(htmlToScanText(`<body><img alt=\`cures cancer\`><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("JSON-LD object KEY claim blocks",
  scan(htmlToScanText(`<body><script type="application/ld+json">{"cures cancer":"x"}</script><footer>${DISC}</footer></body>`)).errors.length > 0);
ok("real claim adjacent to disclaimer still blocks (mask preserves boundaries)",
  scan(htmlToScanText(`<body><p>this heals your eczema</p><footer><p>${DISC}</p></footer></body>`)).errors.length > 0);
ok("weaponized/glued disclaimer fails the present-guard (fail-safe — can't launder a claim)",
  !hasDisclaimer(normalize(`helps you healis not intended to diagnose, treat, cure, or prevent any disease`).toLowerCase()));

// ── Disclaimer guard: present (both comma styles) and missing ──
console.log("disclaimer guard cases:");
ok("disclaimer present (oxford comma)", hasDisclaimer(normalize(DISC).toLowerCase()));
ok("disclaimer present (no oxford comma)", hasDisclaimer(normalize(DISC_NO_OXFORD).toLowerCase()));
ok("disclaimer-missing page flagged", !hasDisclaimer(normalize("<p>just some text, no disclaimer</p>").toLowerCase()));
ok("legit disclaimer does NOT self-flag its own treat/cure words",
  scan(htmlToScanText(`<body><p>welcome</p><footer><p>${DISC_NO_OXFORD} Independent Wellness Advocate.</p></footer></body>`)).errors.length === 0);

console.log(`\n${"─".repeat(48)}\ncompliance-lint tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
