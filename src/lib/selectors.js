// Centralized DOM selector strategies
// Extracted from scraper.js during modularization

// Main result container selectors (ordered by specificity)
const resultSelectors = [
  "div[data-chameleon-result-urn]", // Profile data divs - get parent li elements (most reliable)
  "main ul li", // Main search results container
  "main div ul li", // One level deeper
  "main div div ul li", // Two levels deeper
  "main div div div ul li", // Three levels deeper
  "main div div div div ul li", // Four levels deeper (based on your XPath)
  "ul[role='list'] li", // Less specific - can pick up navigation elements
  ".search-results-container li", // Fallback for older structure
];

// Profile link selectors (ordered by reliability)
const profileLinkSelectors = [
  'a.dGCAEBVXgkGQKLntuWxHvfKkpBSICAYQaUlZpU[href*="/in/"]', // Current working class from sample data
  'div.mb1 a[href*="/in/"]', // Profile link within mb1 container (mb1 is semantic)
  'a[href*="/in/"]:not([href*="search"])', // Any /in/ link that's not a search link
  'a[href*="linkedin.com/in/"]', // Absolute fallback
];

// Name extraction selectors (ordered by priority)
const nameSelectors = [
  "img[alt]", // HIGHEST PRIORITY: Image alt attribute (works for majority of profiles)
  'span[dir="ltr"] > span[aria-hidden="true"]', // Exact structure: <span dir="ltr"><span aria-hidden="true">Name</span>
  'span[dir="ltr"] span[aria-hidden="true"]', // Same but less strict
  'span > span[aria-hidden="true"]', // Direct child fallback
  'span span[aria-hidden="true"]', // General nested span
  'span[aria-hidden="true"]:not(.visually-hidden)', // Exclude visually-hidden spans
  'span[aria-hidden="true"]', // Broad fallback
];

// Headline/title selectors (ordered by specificity)
const headlineSelectors = [
  ".WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV.t-14.t-black.t-normal", // Current working class from sample data
  "div.mb1 .WQvDaGLgJAxxIvMgRXKtFRwauNhWHvbLmKV", // With context
  "div.mb1 div.t-14.t-black.t-normal", // Semantic fallback
  "div.t-14.t-black.t-normal", // Direct semantic match
  'div[class*="t-14"][class*="t-black"][class*="t-normal"]', // Pattern matching
  ".entity-result__primary-subtitle", // Legacy fallback
];

// Location selectors (ordered by specificity)
const locationSelectors = [
  ".DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw.t-14.t-normal", // Current working class from sample data
  "div.mb1 .DtvjKFRzdrPWFAkJEOCmaeJlenAlYxLEw", // With context
  "div.mb1 div.t-14.t-normal:not(.t-black)", // Semantic fallback
  "div.t-14.t-normal:not(.t-black)", // Direct semantic match
  'div[class*="t-14"][class*="t-normal"]:not([class*="t-black"])', // Pattern matching
  ".entity-result__secondary-subtitle", // Legacy fallback
];

// Pagination selectors (for getTotalPages function)
const paginationSelectors = [
  "div.artdeco-pagination__page-state", // Current structure: "Page 2 of 6"
  ".artdeco-pagination__pages li:last-child button",
  ".artdeco-pagination__indicator--number:last-child",
];

// Export selectors using consolidated namespace
if (window.LinkedInScraper && window.LinkedInScraper.registerModule) {
  window.LinkedInScraper.registerModule('Selectors', {
    resultSelectors,
    profileLinkSelectors,
    nameSelectors,
    headlineSelectors,
    locationSelectors,
    paginationSelectors
  });
} else {
  // Fallback for backward compatibility during transition
  window.LinkedInScraperSelectors = {
    resultSelectors,
    profileLinkSelectors,
    nameSelectors,
    headlineSelectors,
    locationSelectors,
    paginationSelectors
  };
}

console.log('selectors.js module loaded');