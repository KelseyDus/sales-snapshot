# Oswald Marketing Snapshot

Internal sales tool. Enter a prospect's website, get evidence-based findings from live research, edit them, and produce a client-ready report (download as PDF), a package and add-on price estimate, an internal sales brief, and an outreach draft.

## What it does

- **Sign-in.** One shared team password. Pricing and rules are served only to signed-in users, so they are not in public source.
- **Website research.** "Research website" reads the HTML of the homepage plus up to two service/contact pages and drafts findings for each review area (titles, descriptions, headings, structured data, contact paths, video embeds, email signup, social links, tracking tags). Every finding states what was seen. Brand, social content quality and measurement stay "unknown" for a human to judge.
- **Human review.** Research fills the Findings editor; you edit, then feature up to three gaps in the client report.
- **Pricing.** Packages, add-ons, hosting options, custom-scope routing. Advertising is one gross monthly figure; the management fee is not itemized, and totals match the pricing sheet. A "Waive setup fee" checkbox adds a "Setup fee: Waived" line to the investment table and the waiver sentence to the report footer; unchecked, the report says any one-time setup fees are confirmed during scoping.
- **PDF.** "Download PDF" builds the client report as a real PDF file (selectable text) on the server; "Print" still opens the browser print dialog.
- **Saved work.** Drafts autosave in the browser (cleared on sign-out). Export and import assessment JSON to keep or move them.

## Deploy (GitHub + Vercel)

1. Push this folder to the root of a GitHub repository.
2. Import the repository in Vercel. Framework preset: **Other**. Settings come from `vercel.json`.
3. Add environment variables (see `.env.example`): `APP_PASSWORD` and `SESSION_SECRET` (32+ random characters, e.g. `openssl rand -base64 32`). Apply to Production.
4. Deploy, open the URL, and sign in. Until both variables exist the tool shows "not configured" and nothing is served.

Local run: `npm install`, then `npx vercel dev` with a `.env` file copied from `.env.example`.

Research can run up to 60 seconds per request (`vercel.json`) when AI drafting is on; if your Vercel plan caps function duration lower, lower `maxDuration` for `api/research.js` or leave AI off.

## Audit checklist

The "Audit checklist" tab lists what to look for in four sections: Website, Social media, Reviews and local listings, and Branding and messaging. Mark each item In place, Partly in place or Not in place, and add a short note (for example the rating or the date of the last post). Leave anything you did not check blank. Answered items appear on the report card under "What we looked at", grouped as In place, Partly in place and Worth adding, with counts per section. Notes are shown to the client. Answers are saved with the draft and included in the exported assessment JSON. The items and the "what to look for" hints are `checklist` in `api/_lib/pricing.js`; keep item IDs stable. Each item helps rate one review area (the `area` field). Once an area has at least two answered items (one for areas with a single item), the app rates it Poor to Best: In place counts 1, Partly 0.5, Not in place 0, and the share in place sets the rating (under 20% Poor, 20-39% Average, 40-59% Good, 60-79% Better, 80%+ Best). Checklist ratings fill areas that research did not rate and stay current as you answer. They never overwrite a research or manual rating; the Findings editor shows "The Audit checklist suggests..." with a button to use it. This is the fallback when a site blocks automated research.

## Notices

A notice bar under the page header tells the team when something needs attention: automatic research failed (with the reason and a button to open the checklist), AI drafting was skipped or is switched off, or some pages could not be retrieved. Notices stay until dismissed or until a new assessment is started.

## How the app is organised

Three steps, shown across the top:

1. **Prospect**: business, website, socials and what you already know. Run research here, or skip it and start the checklist.
2. **Build the audit**: one card per review area (website, SEO, brand, video, social, capture, reviews, tracking). Each card holds its rating, source badge, the checks for that area, and an "Edit rating and wording" section.
3. **Outputs**: Report card, Client report, Quote and Sales brief, with PDF and print.

A bar under the steps shows **Report card strength** (areas rated and confirmed, checks answered) and the single best next action.

### Where each rating came from

Badges appear in the team view only and never in the PDFs, print output or client text.

- **AI draft**: written by AI during research, not yet checked.
- **Detected**: found by code in the site's pages.
- **Checklist**: rated from your checklist answers.
- **Edited by team**: typed or changed by a person.
- **Reviewed**: a person pressed Mark reviewed.

A rating counts as confirmed when a person set it, marked it reviewed, or answered checks that agree with it. Half credit toward the strength bar goes to unconfirmed drafts. The report card PDF is stamped "PRELIMINARY" until every area is rated and confirmed, and exporting an unfinished card or report shows a warning first (you can still continue).

### AI-suggested checklist answers

When AI is on, research also suggests answers for checks it can see in the page text (and, for social and review items, in the web notes). Suggestions show as "AI suggests" with a reason, and do not count toward any rating until you press Accept. Accepted answers are tagged "AI suggestion, confirmed". Checks that need a person (speed, mobile, logo quality and similar) are never suggested.

## Quote

The "Packages + add-ons" tab builds an itemized quote. Pick the package, hosting and monthly advertising figure at the top of the tab (these stay in sync with the sidebar), tick add-ons, creative hours and the ServiceTitan discount, and the quote preview updates. "Download quote PDF" produces a one-page quote with monthly lines, one-time lines, items still "to be quoted", the setup-fee status, terms, and a signature block. Advertising is one gross monthly figure. The validity period (30 days) and the terms text are `quoteValidDays` and `quoteTerms` in `api/_lib/pricing.js`: confirm both before sending quotes. Custom-scope prospects get no standard quote.

## Report card

The "Report card" tab is a one-page, no-pricing review to send before a proposal. Each area is rated Poor / Average / Good / Better / Best (wording is `scoreLabels` in `api/_lib/pricing.js`) with its evidence and a "what would help" line. There is no overall score. An area with no observed evidence, or marked Unknown, shows as "Not yet assessed" instead of being rated. Ratings come from the status by default (gap = Average, needs improvement = Good, strong = Better) or from the AI when it is on, and you can change any rating in the Findings editor under "Report card rating". Download PDF and Print follow the tab you are on.

## AI-written findings (optional)

Set `ANTHROPIC_API_KEY` (from console.anthropic.com) in Vercel, then redeploy. `ANTHROPIC_MODEL` is optional and overrides the default model.

- With a key, "Research website" also drafts client-facing titles, evidence, why-it-matters, next steps, the top three priorities, a strength line, and the outreach email. Code still detects the facts for video, email capture, social links and tracking tags; the AI judges SEO, brand clarity and website messaging from the page text and only writes wording for the rest.
- With a key, a first AI step also uses Anthropic's web search and page-reading tools to look for the business's social profiles and review listings and report what is publicly visible (about 4 searches, roughly 4 cents). Social sites often hide content from visitors; anything it cannot see stays Unknown. It cannot see rendered visuals, so branding judgments come from page text and what the site says.
- Without a key, or if the AI call fails, the tool falls back to rule-based findings and says so on the Research tab. Nothing blocks.
- Privacy: the company name and the public text of up to three pages are sent to Anthropic. No prices, passwords or client data are.
- Cost: roughly a few cents per audit.
- Findings are drafts. Review and edit every one before sharing the report.

## Maintaining prices and rules

Everything editable is in `api/_lib/pricing.js`: package components, ad-spend ranges, add-ons, hosting options, depth labels, review areas, custom-scope threshold, contact emails, and the wording printed when setup fees are waived. Commit and redeploy. Keep add-on and area IDs stable.

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
