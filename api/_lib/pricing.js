'use strict';
// Server-side pricing and review configuration. Values are USD.
// This file is never shipped to the browser directly: /api/config serves it only to signed-in users.
module.exports = {
  mediaFeeRate: 0.20,
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
    { id: 'performance', name: 'Campaign coordination and measurement', depth: 2, title: 'Connect campaigns to measurable business goals', why: 'A shared measurement plan helps the team decide where to improve marketing.', next: 'Confirm channels, lead tracking, reporting, and sales follow-up during discovery.' }
  ],
  // Fictional data for the "Training example" button only.
  sampleFindings: {
    seo: { status: 'gap', evidence: 'Example only: two sample service pages use the same generic page title.' },
    brand: { status: 'strong' },
    website: { status: 'strong' },
    video: { status: 'gap', evidence: 'Example only: no explainer video appears on the sample homepage or inspected service page.' },
    social: { status: 'unknown' },
    capture: { status: 'gap', evidence: 'Example only: the sample homepage offers contact details but no optional email signup.' },
    performance: { status: 'unknown' }
  }
};
