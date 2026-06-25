# Live Well — Pages CMS demo

A code-built, **Pages-CMS-editable**, **free / walk-away** brochure site (lane B).

The site is a static Astro 5 build. All the words live in plain content files
in the repo, and a root `.pages.yml` turns those files into a friendly editing
panel at [app.pagescms.org](https://app.pagescms.org). Sandy edits text in the
browser → it commits to GitHub → the host rebuilds → done. No database, no
servers to babysit, no logins for us to hold, nothing to renew.

The design is reproduced verbatim from
`../design-demos/live-well-apothecary.html` — same CSS, fonts, layout, and
inline-SVG botanicals. The only change is that the content now comes from files
instead of being hardcoded.

---

## Local dev

```bash
npm install     # one time
npm run dev      # local preview at http://localhost:4321
npm run build    # static build into ./dist  (this is what the host runs)
```

Built with **Astro 5** (pinned to `5.18.2`) using the Content Layer API. No
other dependencies.

---

## Edit it in Pages CMS

Pages CMS reads the `.pages.yml` file at the **root of the repo**, on the
repo's **default branch**. To connect it:

1. **Push this repo to GitHub** (a normal repo on the account that will own the site).
2. Go to **[app.pagescms.org](https://app.pagescms.org)** and click **"Sign in with GitHub."**
3. **Install the Pages CMS GitHub App** on the GitHub account/org that owns the
   repo, and grant it access to **just this one repository**.
4. **Open the repo in Pages CMS.** It automatically finds and reads the root
   `.pages.yml` and shows the editing panel.
5. **Edit and Save.** Each save **commits to the default branch** on GitHub.

### What's editable in the panel

- **This Season's Picks** — the monthly feature cards (the part Sandy changes most).
  Add, edit, hide (the "Show on the website?" switch), and reorder them.
  Each pick has a name, a little label, a description, a store link, and a display order.
- **Home Page** — the small line above the headline, the big headline, the welcome
  paragraph, the button wording, **the doTERRA store link** (used by every button
  on the site — change it once here), and the three numbers with their captions.
- **About / Your Story** — the small label, the big quote, your story paragraphs,
  and your name + title.
- **Contact Details** — city/state, email, optional phone, and the Facebook link
  wording + address (these show in the footer).

All field labels in the panel are plain English (no code words), with short hints.

---

## Deploy free (walk-away)

Connect the GitHub repo to **Cloudflare Pages**:

- **Build command:** `npm run build`
- **Output directory:** `dist`

Cloudflare rebuilds automatically on every push — including every Save made in
Pages CMS — so edits go live on their own. Free tier, no ongoing upkeep.

---

## A note on accounts

The GitHub push, the Pages CMS GitHub App install, and the Cloudflare Pages
connection all happen under **Carson's own accounts** and can't be pre-done from
here — they each require signing in as the account owner. This repo is ready to
push as-is.
