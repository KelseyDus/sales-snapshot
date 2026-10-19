'use strict';
// Server-side pricing and review configuration. Values are USD.
// This file is never shipped to the browser directly: /api/config serves it only to signed-in users.
module.exports = {
  customSpendThreshold: 10000,
  contactEmails: ['kelsey@oswaldmarketing.com', 'jay@oswaldmarketing.com'],
  // Printed in the client report when "Waive setup fee" is checked.
  setupNote: 'Setup fees are waived.',
  hostingOptions: [
    { value: 250, label: 'Oswald-hosted · $250' },
    { value: 150, label: 'Self-hosted · $150' }
  ],
  packages: [
    { name: 'No Ads', social: 1000, seo: 500, retainer: 1250, min: 0, max: 0, perk: '' },
    { name: 'Base Ads', social: 1000, seo: 500, retainer: 1450, min: 2500, max: 2500, perk: '' },
    { name: 'Mid', social: 1700, seo: 750, retainer: 1750, min: 5000, max: 7500, perk: 'Mid includes 24 logo caps at no charge.' },
    { name: 'Premium', social: 2400, seo: 1000, retainer: 1950, min: 7500, max: 10000, perk: 'Premium includes 24 logo caps and 24 logo tees at no charge.' }
  ],
  // Quote PDF wording. Confirm the validity period and terms with Oswald before sending quotes.
  quoteValidDays: 30,
  quoteTerms: 'This quote is an estimate based on the information discussed. Final scope, pricing and start date are confirmed in a signed agreement. Advertising is billed as one monthly figure that includes platform spend and management. One client per trade per territory, subject to availability.',
  // Report card ratings, lowest to highest. Shown to clients: keep the wording friendly.
  scoreLabels: ['Poor', 'Average', 'Good', 'Better', 'Best'],
  depths: ['Surface', 'Twilight', 'Deep Ocean', 'Abyss'],
  descriptions: ['Visibility and brand foundation', 'Engagement and trust', 'Growth and performance', 'Category leadership and long-term advantage'],
  catalog: [
    { id: 'web', name: 'Template website build / rebuild', price: 6500, type: 'project', note: 'Scope confirmed before quoting' },
    { id: 'pages', name: 'Additional three-page bundle', price: 1500, type: 'project', note: 'One three-page block' },
    { id: 'logo', name: 'Logo refresh', price: 2500, type: 'project', group: 'brand' },
    { id: 'brand', name: 'Brand refresh', price: 5500, type: 'project', group: 'brand' },
    { id: 'rebrand', name: 'Full brand / rebrand', price: 9500, type: 'project', group: 'brand' },
    { id: 'video', name: 'One-off video', price: 1200, type: 'project', base: true, note: 'Base price; production scope confirmed' },
    { id: 'email', name: 'Email marketing', price: 750, type: 'monthly', group: 'capture', note: 'Based on number of sends' },
    { id: 'popup', name: 'Lead capture without integration', price: 250, type: 'monthly', group: 'capture' },
    { id: 'bundle', name: 'Integrated lead capture + email bundle', price: 1000, type: 'monthly', group: 'capture', note: 'Optional combined bundle' },
    { id: 'integrated', name: 'Integrated lead capture only', price: null, type: 'monthly', group: 'capture', note: 'Contact for pricing' },
    { id: 'store', name: 'Company store', price: 30, type: 'monthly', base: true, quote: true, note: 'From $30/month plus a quoted one-time setup fee' },
    { id: 'print', name: 'Print package', price: 250, type: 'project', base: true, note: 'From $250; business cards / email signature' },
    { id: 'promo', name: 'Promotional items', price: null, type: 'project', note: 'Quoted separately' },
    { id: 'hours', name: 'Creative hours', price: 175, type: 'hourly', note: 'Enter hours below' }
  ],
  areas: [
    { id: 'seo', name: 'Basic SEO and local visibility', depth: 0, title: 'Make service pages easier to understand and discover', why: 'Clear service and location information can help customers find a relevant answer.', next: 'Review titles and headings on priority pages and add useful service-area content.' },
    { id: 'brand', name: 'Brand and messaging', depth: 0, title: 'Clarify why a customer should choose you', why: 'Specific differentiators help prospects understand the value of your business.', next: 'Clarify your main promise and carry it consistently through your website and social content.' },
    { id: 'website', name: 'Website and contact experience', depth: 0, title: 'Give interested visitors a clear next step', why: 'A visible inquiry path makes it easier for someone to contact the business.', next: 'Review service-page calls to action and simplify the contact journey.' },
    { id: 'video', name: 'Video and photography', depth: 1, title: 'Use video to answer common customer questions', why: 'Helpful explanations can build familiarity and confidence before an inquiry.', next: 'Start with one short service explainer or customer story.' },
    { id: 'social', name: 'Social content and consistency', depth: 1, title: 'Turn social content into a useful buying resource', why: 'Educational content can help customers decide what service they need.', next: 'Create a repeatable mix of useful advice, project examples, and customer proof.' },
    { id: 'capture', name: 'Lead capture and follow-up', depth: 1, title: 'Build a clearer path from interest to inquiry', why: 'A useful contact offer can create more opportunities for follow-up.', next: 'Assess whether a simple lead capture offer and email follow-up fit the business.' },
    { id: 'reviews', name: 'Reviews and local listings', depth: 1, title: 'Make it easier for customers to trust you at a glance', why: 'Recent, well-answered reviews and complete listings help people choose a local business with confidence.', next: 'Complete the Google Business Profile, ask happy customers for reviews, and reply to the ones you receive.' },
    { id: 'performance', name: 'Campaign coordination and measurement', depth: 2, title: 'Connect campaigns to measurable business goals', why: 'A shared measurement plan helps the team decide where to improve marketing.', next: 'Confirm channels, lead tracking, reporting, and sales follow-up during discovery.' }
  ],
  // Audit checklist: what to look for. Answers are In place / Partly / Not in place; only answered items reach the report card. Each item names the review area (`area`) it helps rate.
  checklist: [
    { id: 'web', name: 'Website', items: [
      { id: 'web_phone', area: 'website', q: 'Phone number is visible at the top of every page', look: 'Tap-to-call on a phone, not buried in the footer.' },
      { id: 'web_cta', area: 'website', q: 'One clear call to action above the fold', look: 'Call, Get a quote or Book now, visible without scrolling.' },
      { id: 'web_form', area: 'website', q: 'Contact or quote form is short and works', look: 'Fewer than six fields, a confirmation message, no errors.' },
      { id: 'web_services', area: 'seo', q: 'Each main service has its own page', look: 'Separate pages for each service rather than one long list.' },
      { id: 'web_area', area: 'seo', q: 'Service area and cities are named', look: 'City or county names in headings and body text, not only a map.' },
      { id: 'web_titles', area: 'seo', q: 'Page titles and descriptions are unique and include service and city', look: 'Check the browser tab and the search result snippet.' },
      { id: 'web_mobile', area: 'website', q: 'Works well on a phone', look: 'Text readable, buttons easy to tap, nothing cut off.' },
      { id: 'web_speed', area: 'website', q: 'Pages load quickly', look: 'No long blank wait; large images are not slowing it down.' },
      { id: 'web_trust', area: 'website', q: 'Trust signals are shown', look: 'Licenses, insurance, guarantees, years in business, certifications.' },
      { id: 'web_capture', area: 'capture', q: 'A way to capture visitors who are not ready to call', look: 'Email signup, offer, chat or text option beyond the contact form.' },
      { id: 'web_tracking', area: 'performance', q: 'Analytics and ad tracking are installed and reviewed', look: 'Check with WhatRuns or the page source for Google Analytics, Tag Manager, Meta Pixel and call tracking.' },
      { id: 'web_photos', area: 'video', q: 'Real photos of the team and work, not only stock images', look: 'Crew, trucks, finished jobs.' }
    ] },
    { id: 'social', name: 'Social media', items: [
      { id: 'soc_present', area: 'social', q: 'Active profiles on the platforms their customers use', look: 'Usually Facebook plus Instagram, and Google or YouTube for video.' },
      { id: 'soc_linked', area: 'social', q: 'Profiles are linked from the website, and the website from the profiles', look: 'Icons in the header or footer; website link in each bio.' },
      { id: 'soc_brand', area: 'social', q: 'Name, logo and handle are consistent across profiles', look: 'Same logo and business name everywhere.' },
      { id: 'soc_recent', area: 'social', q: 'Posted within the last 30 days', look: 'Check the date of the latest post.' },
      { id: 'soc_cadence', area: 'social', q: 'Posts regularly, about weekly or better', look: 'Look at the last 10 posts for gaps.' },
      { id: 'soc_mix', area: 'social', q: 'Mix of helpful, local and proof content, not only promotions', look: 'Tips, project photos, team, reviews and community, alongside offers.' },
      { id: 'soc_real', area: 'video', q: 'Uses real photos and short video of their work', look: 'Before and after shots, crew at work.' },
      { id: 'soc_engage', area: 'social', q: 'Responds to comments and messages', look: 'Replies under posts; response badge on Facebook.' },
      { id: 'soc_info', area: 'social', q: 'Profile details are complete', look: 'Phone, hours, service area, website and a clear description.' }
    ] },
    { id: 'reviews', name: 'Reviews and local listings', items: [
      { id: 'rev_gbp', area: 'reviews', q: 'Google Business Profile is claimed and complete', look: 'Hours, services, photos, service area and website filled in.' },
      { id: 'rev_recent', area: 'reviews', q: 'New reviews in the last 90 days', look: 'Check the dates on the newest reviews.' },
      { id: 'rev_rating', area: 'reviews', q: 'Strong average rating with a healthy number of reviews', look: 'Note the rating and count in the note field.' },
      { id: 'rev_reply', area: 'reviews', q: 'Owner replies to reviews, including critical ones', look: 'Short, professional replies.' },
      { id: 'rev_platforms', area: 'reviews', q: 'Reviews on more than one platform', look: 'Google plus Facebook, Yelp, Angi or the trade association.' },
      { id: 'rev_words', area: 'reviews', q: 'Reviews mention specific services and places', look: 'Words like "water heater" or the city name appear in reviews.' },
      { id: 'rev_site', area: 'reviews', q: 'Reviews are shown on the website', look: 'Testimonials or a review feed on the homepage or service pages.' },
      { id: 'rev_nap', area: 'reviews', q: 'Name, address and phone match across listings', look: 'Compare Google, Facebook, Yelp and the website.' }
    ] },
    { id: 'brand', name: 'Branding and messaging', items: [
      { id: 'br_what', area: 'brand', q: 'It is clear what they do and where, within a few seconds', look: 'Read the homepage headline cold.' },
      { id: 'br_diff', area: 'brand', q: 'A reason to choose them is stated', look: 'A specific promise, speed, guarantee or specialty rather than "quality service".' },
      { id: 'br_offer', area: 'brand', q: 'A clear offer or guarantee is shown', look: 'Same-day service, upfront pricing, warranty.' },
      { id: 'br_visual', area: 'brand', q: 'Logo, colors and fonts are consistent across site, social and print', look: 'Compare the website, social profiles and any vehicle or print photos.' },
      { id: 'br_logo', area: 'brand', q: 'Logo is clean and readable at small sizes', look: 'Check it as a social profile picture.' },
      { id: 'br_voice', area: 'brand', q: 'Voice and tone are consistent and friendly', look: 'Same style on the site, social and review replies.' },
      { id: 'br_customer', area: 'brand', q: 'Copy speaks to the customer’s needs, not only company features', look: 'Look for "you" language and problems solved.' },
      { id: 'br_local', area: 'brand', q: 'Local identity is clear', look: 'Names the community, local team and local involvement.' },
      { id: 'br_about', area: 'brand', q: 'About page or story puts a face and name to the business', look: 'Owner or team photos and a short story.' }
    ] }
  ],
  // Fictional data for the "Training example" button only.
  sampleChecklist: { web_phone: { v: 'yes' }, web_cta: { v: 'yes' }, web_area: { v: 'no', note: 'Example only: cities are not named on the sample service pages.' }, soc_recent: { v: 'partial' }, rev_gbp: { v: 'yes' }, rev_reply: { v: 'no' }, br_diff: { v: 'partial', note: 'Example only: the sample headline is generic.' } },
  sampleFindings: {
    seo: { status: 'gap', evidence: 'Example only: two sample service pages use the same generic page title.' },
    brand: { status: 'strong', evidence: 'Example only: the sample homepage states a clear promise and a consistent logo and color palette.' },
    website: { status: 'strong', evidence: 'Example only: the sample homepage shows a phone number and a quote button at the top of the page.' },
    video: { status: 'gap', evidence: 'Example only: no explainer video appears on the sample homepage or inspected service page.' },
    social: { status: 'unknown' },
    capture: { status: 'gap', evidence: 'Example only: the sample homepage offers contact details but no optional email signup.' },
    performance: { status: 'unknown' }
  }
};
