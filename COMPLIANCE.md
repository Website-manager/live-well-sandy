# Compliance gate — Live Well with Sandy

This site belongs to an **independent doTERRA Wellness Advocate**. Essential-oil /
direct-sales advocate sites carry hard legal limits on what the words may claim.
The `compliance-lint` check enforces the two highest-risk limits automatically, on
every change, **before** anything can reach the live site.

> **It is a safety net, not a lawyer.** This is a **high-precision denylist** — it
> reliably catches the *common, clear* violations with near-zero false alarms on
> honest copy. It does **not** catch every possible non-compliant phrasing. Human
> review of new copy is still required; this gate is the floor, not the ceiling.

## What it blocks (the build fails)

The scanner (`scripts/compliance-lint.mjs`) reads the words Sandy edits
(`src/content/`) **and** the fully rendered site (`dist/` after `npm run build`,
including text inside `<meta>`/`og:` descriptions, `alt`/`title`/`aria-label`, and
JSON-LD — the parts a naive scan misses), and **blocks** on:

1. **Disease / medical ("drug") claims** — FDA. Saying a product *cures, diagnoses,
   treats / heals / relieves / gets rid of / kills / prevents* a disease or symptom,
   "anti-viral / antibacterial", "FDA approved", "clinically proven", or *naming a
   serious disease* (cancer, COVID, diabetes, asthma, …). Soft verbs like "treat",
   "heal", "help", "soothe" only block when they appear **next to a condition**
   ("treats your **headaches**") — so "**treat yourself**" and "a **healing**
   journey" are fine.

2. **Income / earnings guarantees** — FTC. "replace your income", "financial
   freedom", "passive/guaranteed income", "be your own boss", "get rich", "six
   figures", or specific earnings ("earn $5,000 a month"). Discount/retail copy is
   safe — "$20 **off**", "**save** $50 a month" do **not** block.

It also **guards the FDA disclaimer**: the footer line *"…not intended to diagnose,
treat, cure, or prevent any disease. Independent Wellness Advocate."* must remain on
every rendered page (matched tolerantly — comma style and "is/are" don't matter). If
an edit strips it, the build blocks.

## What it only flags (warnings — never blocks)

`anxiety`, `depression`, `insomnia`, `immune/immunity`, `inflammation`, `detox`,
`hormonal`, `blood pressure`, `cholesterol` — reported for a human glance, because
they *can* be used compliantly.

## Known limits (be honest about these)

- **Disease names are blocked ANYWHERE on the site** — including testimonials and
  personal stories ("my mother's battle with cancer"). This is intentional FDA
  caution. Rephrase to avoid naming the condition.
- **It is a denylist.** Novel phrasings with no listed trigger word can slip through
  (this is why human review still matters). Word-boundaries reduce, but do not
  eliminate, false positives — the real safeguard for soft verbs is the
  *condition-context* rule, not the boundary. When you add a rule, prefer
  "verb + condition" patterns over bare words.
- **Deliberately obfuscated HTML** (a claim split across inline tags like
  `cu<span>r</span>e`) is a residual gap the scanner can't fully see; the human PR
  review of the `.astro` diff is the backstop there.

## Rephrasing a blocked line

| Don't write | Write instead |
|---|---|
| "This oil **treats your** headaches" | "I reach for this when I want a calm moment" |
| "**Heals** your anxiety" | "A grounding scent I love for unwinding" |
| "**Cures** colds / fights infection" | "Part of my seasonal self-care routine" |
| "**Soothes** your everyday **aches**" | "A cozy ritual after a long day" |
| "**Helps** with seasonal **allergies**" | "A favorite of mine when the seasons change" |
| "**Replace your income** from home" | "Ask me about sharing what you love" |
| "Earn **$5,000/month**" | (remove — no earnings figures) |

> A **warning** (not a block) means a claim verb appears near a condition — it does
> **not** mean the line is safe. A human should read it and rephrase if it implies
> the product treats the condition.

## Running it locally

```bash
npm ci
npm run compliance:test    # self-test: proves the scanner catches what it should
npm run build              # produces dist/ — the scan needs it
npm run compliance         # scans source + rendered site
```

Exit `0` = clean (warnings allowed). Exit `1` = a blocking claim, a missing
disclaimer, or `dist/` wasn't built.

## How a change reaches the live site

There are two ways the site changes, and they are treated differently on purpose:

1. **Sandy edits in her CMS → publishes automatically.** No human approval. The
   compliance scan still runs on the deploy (see below), so a non-compliant edit fails
   the deploy and never goes live — but a *compliant* edit publishes on its own. It's
   her site; her words flow.
2. **Sandy asks Atlas to make a change → Atlas opens a pull request → Carson approves
   it in Atlas → it merges → it deploys.** The human approval here is the **Atlas merge
   step**, not a GitHub setting. `compliance-lint` runs on that PR and the merge is
   refused unless it passed.

**The compliance scan is the universal content gate** — it runs on every PR *and*
inside the deploy job (`deploy.yml`), so a disease/income claim is blocked no matter
which path a change took. **Do not remove the compliance scan step from `deploy.yml`.**
There is intentionally **no deploy-time approval gate** — Sandy's saves are not meant
to wait on anyone.

> **Sandy-facing note:** your saves **publish on their own** — usually live within a
> minute or two. If a save ever *doesn't* appear, it's because the compliance check
> flagged wording that could read as a medical or income claim — reword it (see the
> table above) and save again.

## Go-live checklist (do these once, in order)

1. **Merge the bootstrap PR first.** This PR *introduces* the `compliance-lint`
   workflow. Merge it and confirm the `compliance-lint` check shows green on it.
2. **Keep Sandy's direct path open.** Sandy's CMS commits straight to `main`, so do
   **not** put a "require a pull request" / "require status check" rule on `main` for
   everyone — that would freeze her saves. Her compliance protection is the deploy-job
   scan, which fails a deploy that carries a claim. The Atlas assistant reaches the
   repo only through pull requests (its code never pushes to `main` directly), and the
   human approval for that path is the Atlas merge card.
3. **One deploy path only.** Confirm the Cloudflare **Pages** project `live-well-sandy`
   is **NOT** also connected to Cloudflare's native Git auto-deploy. If it is, a push
   to `main` would trigger Cloudflare's own build+deploy directly — bypassing this
   Action *and* the compliance scan. Deploy must run **only** through `deploy.yml`.
   (Cloudflare dashboard → Pages → the project → Settings → Builds & deployments →
   disconnect Git integration if present.)

## Maintaining the rules (for the website team)

The rule lists are at the top of `scripts/compliance-lint.mjs`: `BLOCK_MEDICAL`,
`BLOCK_INCOME` (fail the build) and `WARN_TERMS` (advisory). The `ctx()` helper makes
"verb near a condition" rules — prefer those over bare words to avoid false positives.
`COND` is the shared condition/symptom list. **After ANY change, run
`npm run compliance:test`** — the suite in `scripts/compliance-lint.test.mjs` encodes
the real bypasses and the honest-copy cases; keep it green.

### Why a self-contained scanner (not Vale or another prose-linter)

A single Node script with **zero dependencies** (Node is already in CI) is easier to
read, test, and maintain on a client repo than an external prose-linting toolchain,
and it gives exact control over the doTERRA/FTC rule set, the rendered-HTML
attribute/JSON-LD extraction, and the disclaimer guard. If the rule set ever outgrows
a denylist, revisit this choice.
