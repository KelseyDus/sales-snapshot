# Oswald Marketing Snapshot

Internal sales tool. Enter a prospect's website, get evidence-based findings from live research, edit them, and produce a client-ready report (download as PDF), a package and add-on price estimate, an internal sales brief, and an outreach draft.

## What it does

- **Sign-in.** One shared team password. Pricing and rules are served only to signed-in users, so they are not in public source.
- **Website research.** "Research website" reads the HTML of the homepage plus up to two service/contact pages and drafts findings for each review area (titles, descriptions, headings, structured data, contact paths, video embeds, email signup, social links, tracking tags). Every finding states what was seen. Brand, social content quality and measurement stay "unknown" for a human to judge.
- **Human review.** Research fills the Findings editor; you edit, then feature up to three gaps in the client report.
- **Pricing.** Packages, add-ons, 20% media fee, hosting options, custom-scope routing. A "Waive setup fee" checkbox adds a "Setup fee: Waived" line to the investment table and the waiver sentence to the report footer; unchecked, the report says any one-time setup fees are confirmed during scoping.
- **PDF.** "Download PDF" builds the client report as a real PDF file (selectable text) on the server; "Print" still opens the browser print dialog.
- **Saved work.** Drafts autosave in the browser (cleared on sign-out). Export and import assessment JSON to keep or move them.

## Deploy (GitHub + Vercel)

1. Push this folder to the root of a GitHub repository.
2. Import the repository in Vercel. Framework preset: **Other**. Settings come from `vercel.json`.
3. Add environment variables (see `.env.example`): `APP_PASSWORD` and `SESSION_SECRET` (32+ random characters, e.g. `openssl rand -base64 32`). Apply to Production.
4. Deploy, open the URL, and sign in. Until both variables exist the tool shows "not configured" and nothing is served.

Local run: `npm install`, then `npx vercel dev` with a `.env` file copied from `.env.example`.

Research runs up to 30 seconds per request (`vercel.json`); your Vercel plan must allow that function duration.

## Maintaining prices and rules

Everything editable is in `api/_lib/pricing.js`: package components, ad-spend ranges, add-ons, hosting options, depth labels, review areas, media fee rate, custom-scope threshold, contact emails, and the wording printed when setup fees are waived. Commit and redeploy. Keep add-on and area IDs stable.

Report wording and recommendation rules live in `public/assets/app.js` (`reportHTML`, `priceHTML`, `recommendation`, `renderSales`, `outreach`). Research rules live in `api/_lib/analyze.js`.

## Before first use

- The setup-fee waiver is off by default for each assessment. Tick "Waive setup fee" only when it applies; the wording is `setupNote` in `pricing.js`.
- Check territory exclusivity internally before sending an offer; the tool does not check it.

## Safety notes

- Research only fetches public http/https sites on ports 80/443. Private, loopback and link-local addresses are blocked, including after redirects and DNS resolution. Pages are limited to 1.5 MB and 8 seconds.
- Sessions are signed HttpOnly cookies valid 12 hours. Failed sign-ins are rate limited (best effort per server instance).
- The research reads page source only. It does not see scripted content, logged-in areas, traffic, rankings, social post content, or ad and email performance. Confirm those with the prospect.

## Not included

CRM sync (no Monday.com connection), a database (drafts live in the browser; use JSON export to share), and per-user accounts.

## Tests

Run `npm install` once, then `npm test`. It covers pricing math, routing, report and PDF output, the setup waiver, sign-in, the network safety checks, the research analyzer, and the API handlers. Layout and print output still need a look in a real browser after each change.
